; OYMAPOS - Inno Setup 6 Profesyonel Kurulum Betiği
; Çıktı: OYMAPOS_Full_Setup_v2.5.0.exe

#define MyAppName "OYMAPOS"
#define MyAppVersion "2.5.0"
#define MyAppPublisher "OYMAPOS Yazılım"
#define MyAppURL "https://github.com/oguztasdemir/Market-Raf-Etiketi---Fiyat-Bask--Sistemi"
#define MyAppExeName "OYMAPOS.exe"

[Setup]
; Temel Uygulama Tanımları
AppId={{E8D2A145-8C1B-4E38-A268-E165F939B9F0}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName=C:\OYMAPOS
DisableDirPage=no
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=OYMAPOS_Setup_v2.5.0
SetupIconFile=logo.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\logo.ico
UninstallDisplayName={#MyAppName} - Market Raf Etiketi & Satış Sistemi

[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "startupicon"; Description: "Windows başladığında otomatik çalıştır"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "firewallrule"; Description: "Windows Güvenlik Duvarında Yerel Ağ İzni Aç (Port 5000/5001 - Mobil POS ve Teraziler İçin)"; GroupDescription: "Ağ Ayarları"

[Files]
Source: "dist\OYMAPOS.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "logo.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "build_tools\redist\*.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "build_tools\redist\vc_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "build_tools\redist\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
; Kaynak dosyalar ve seed katalogları
Source: "backend\katalog\seed_urunler.json"; DestDir: "{app}\backend\katalog"; Flags: ignoreversion onlyifdoesntexist
Source: "backend\katalog\seed_manav_urunleri.json"; DestDir: "{app}\backend\katalog"; Flags: ignoreversion onlyifdoesntexist

[Icons]
Name: "{autoprograms}\{#MyAppName}\OYMAPOS - Ana Sistem"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\logo.ico"
Name: "{autoprograms}\{#MyAppName}\OYMAPOS - Barkodlu Terazi"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--module=manav"; IconFilename: "{app}\logo.ico"
Name: "{autoprograms}\{#MyAppName}\OYMAPOS - Toplu Stok & Katalog"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--module=catalog"; IconFilename: "{app}\logo.ico"
Name: "{autoprograms}\{#MyAppName}\OYMAPOS - Hızlı Fiyat & Ürün"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--module=sync"; IconFilename: "{app}\logo.ico"

Name: "{autodesktop}\OYMAPOS - Ana Sistem"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\logo.ico"; Tasks: desktopicon
Name: "{autodesktop}\OYMAPOS - Barkodlu Terazi"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--module=manav"; IconFilename: "{app}\logo.ico"; Tasks: desktopicon
Name: "{autodesktop}\OYMAPOS - Toplu Stok & Katalog"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--module=catalog"; IconFilename: "{app}\logo.ico"; Tasks: desktopicon
Name: "{autodesktop}\OYMAPOS - Hızlı Fiyat & Ürün"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--module=sync"; IconFilename: "{app}\logo.ico"; Tasks: desktopicon

Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\logo.ico"; Tasks: startupicon

[Run]
; VC++ Redistributable 2015-2022 Sessiz Kurulumu
Filename: "{tmp}\vc_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Microsoft Visual C++ Kütüphaneleri kuruluyor..."; Flags: runhidden
; WebView2 Evergreen Runtime Sessiz Kurulumu
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "Microsoft WebView2 Çalışma Zamanı kuruluyor..."; Flags: runhidden
; Güvenlik duvarı kuralını ekle
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""OYMAPOS Local Server"" dir=in action=allow protocol=TCP localport=5000,5001 profile=any"; StatusMsg: "Windows Güvenlik Duvarı ayarlanıyor..."; Tasks: firewallrule; Flags: runhidden
; Kurulum bitince uygulamayı çalıştırma seçeneği
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Kaldırırken güvenlik duvarı kuralını temizle
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""OYMAPOS Local Server"""; Flags: runhidden

[Code]
// Windows 7 / 2008 R2 sistemlerde kernel32.dll AddDllDirectory kontrolü (KB2533623 / KB3063858)
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
  Version: TWindowsVersion;
  KernelModule: THandle;
  ProcAddr: FarProc;
begin
  Result := True;
  
  // 1. Varsa açık OYMAPOS sürecini kapat
  Exec('taskkill', '/F /IM OYMAPOS.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  
  // 2. Windows Sürüm ve AddDllDirectory Uyumluluk Denetimi
  GetWindowsVersionEx(Version);
  // Windows 7 / Server 2008 R2 (Major: 6, Minor: 1)
  if (Version.Major = 6) and (Version.Minor = 1) then
  begin
    KernelModule := LoadDLL('kernel32.dll');
    if KernelModule <> 0 then
    begin
      ProcAddr := GetProcAddress(KernelModule, 'AddDllDirectory');
      FreeDLL(KernelModule);
      
      if ProcAddr = 0 then
      begin
        SuppressibleMsgBox(
          'DİKKAT: Bilgisayarınızda (Windows 7) Microsoft KB2533623 / KB3063858 güvenlik güncellemesi eksik!' + #13#10 + #13#10 +
          'Bu güncelleme eksik olduğunda program açılırken "AddDllDirectory yordam giriş noktası bulunamadı" hatası verecektir.' + #13#10 + #13#10 +
          'Lütfen Microsoft''un resmi sitesinden Windows 7 için KB3063858 x64 güncellemesini kurunuz.' + #13#10 +
          'Kuruluma yine de devam ediliyor...',
          mbInformation, MB_OK, MB_OK
        );
      end;
    end;
  end;
end;

