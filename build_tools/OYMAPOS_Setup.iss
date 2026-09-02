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
; Kaynak dosyalar ve seed katalogları
Source: "backend\katalog\seed_urunler.json"; DestDir: "{app}\backend\katalog"; Flags: ignoreversion onlyifdoesntexist
Source: "backend\katalog\seed_manav_urunleri.json"; DestDir: "{app}\backend\katalog"; Flags: ignoreversion onlyifdoesntexist

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\logo.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\logo.ico"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\logo.ico"; Tasks: startupicon

[Run]
; Güvenlik duvarı kuralını ekle
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""OYMAPOS Local Server"" dir=in action=allow protocol=TCP localport=5000,5001 profile=any"; StatusMsg: "Windows Güvenlik Duvarı ayarlanıyor..."; Tasks: firewallrule; Flags: runhidden
; Kurulum bitince uygulamayı çalıştırma seçeneği
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
; Kaldırırken güvenlik duvarı kuralını temizle
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""OYMAPOS Local Server"""; Flags: runhidden

[Code]
// Kurulum öncesi açık OYMAPOS sürecini kontrol et ve kapat
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  Exec('taskkill', '/F /IM OYMAPOS.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
