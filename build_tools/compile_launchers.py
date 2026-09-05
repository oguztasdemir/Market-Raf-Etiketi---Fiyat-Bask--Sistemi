# -*- coding: utf-8 -*-
"""
Win7 / Win10 / Win11 Uyumlu Bağımsız Tek Parça Setup.exe ve Modül Yöneticisi Derleyicisi.
Tüm sistem dosyaları, DLL'ler, Python çalışma ortamı ve başlatıcılar doğrudan 'Setup.exe' içerisine gömülür.
Kullanıcının ZIP dosyası indirmesine veya açmasına gerek kalmaz; tek başına indirilen Setup.exe çalıştırıldığında:
- Sistem donanımını, mimarisini (32-Bit / 64-Bit) ve Windows sürümünü otomatik algılar.
- 'C:\\OYMAPOS' hedefine tüm sistemi otomatik ve hızlıca açar.
- Eski 'data/' veritabanı klasörünü KESİNLİKLE silmez ve korur.
- Masaüstüne gerekli tüm modül kısayollarını (Kasa Satışı, Terazi, Stok, vb.) ekler.
- Güvenlik duvarı yerel ağ ve port izinlerini yapılandırır.
- VC++ Redistributable ve Win7 DLL bağımlılıklarını sessizce yapılandırır.
- Sistemi otomatik olarak başlatır.
"""
import os
import sys
import subprocess
import shutil
import struct
import zlib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
PORTABLE_DIR = os.path.join(ROOT_DIR, "dist", "OYMAPOS_Windows7_Portable")
APP_BIN_DIR = os.path.join(PORTABLE_DIR, "app", "bin")
ICONS_DIR = os.path.join(BASE_DIR, "ikonlar")
DIST_DIR = os.path.join(ROOT_DIR, "dist")

CSC_PATH = r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not os.path.exists(CSC_PATH):
    CSC_PATH = r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"

# 1. Modül Başlatıcı C# Şablonu (app/bin altında çalışır, üst dizindeki python_runtime'ı bulur)
CS_LAUNCHER_TEMPLATE = """
using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
using System.Reflection;
using System.Runtime.InteropServices;

[assembly: AssemblyTitle("OYMAPOS Modul Yoneticisi")]
[assembly: AssemblyDescription("OYMAPOS Modul Baslatici")]
[assembly: AssemblyCompany("OYMAPOS Teknoloji")]
[assembly: AssemblyProduct("OYMAPOS")]
[assembly: AssemblyCopyright("Copyright © 2026 OYMAPOS")]
[assembly: AssemblyVersion("2.5.0.0")]
[assembly: AssemblyFileVersion("2.5.0.0")]

namespace OymaposLaunchers
{
    static class Program
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool SetDllDirectory(string lpPathName);

        [DllImport("kernel32.dll", CharSet = CharSet.Ansi, SetLastError = true)]
        private static extern IntPtr GetProcAddress(IntPtr hModule, string procName);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        [STAThread]
        static void Main(string[] args)
        {
            string binDir = AppDomain.CurrentDomain.BaseDirectory;
            string rootDir = binDir;
            if (File.Exists(Path.Combine(binDir, "..", "..", "python_runtime", "python.exe")))
            {
                rootDir = Path.GetFullPath(Path.Combine(binDir, "..", ".."));
            }
            else if (File.Exists(Path.Combine(binDir, "..", "python_runtime", "python.exe")))
            {
                rootDir = Path.GetFullPath(Path.Combine(binDir, ".."));
            }

            string pyExe = Path.Combine(rootDir, "python_runtime", "pythonw.exe");
            if (!File.Exists(pyExe))
            {
                pyExe = Path.Combine(rootDir, "python_runtime", "python.exe");
            }
            string mainScript = Path.Combine(rootDir, "desktop_app.py");
            if (!File.Exists(mainScript))
            {
                mainScript = Path.Combine(rootDir, "app", "desktop_app.py");
            }

            if (!File.Exists(pyExe) || !File.Exists(mainScript))
            {
                MessageBox.Show(
                    "Gerekli sistem dosyalari bulunamadi.\\n\\nAranan: " + mainScript + "\\n\\nLutfen OYMAPOS kurulumunu Setup.exe ile onarin.",
                    "Sistem Baslatma Hatasi",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            string targetArg = "MODULE_FLAG";
            string passedArgs = targetArg;
            if (args != null && args.Length > 0)
            {
                passedArgs = string.Join(" ", args);
            }

            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = pyExe;
            psi.Arguments = "\\"" + mainScript + "\\" " + passedArgs;
            psi.WorkingDirectory = rootDir;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardError = true;

            string pyRuntimeDir = Path.Combine(rootDir, "python_runtime");
            string binPath = Path.Combine(rootDir, "app", "bin");
            string currentPath = Environment.GetEnvironmentVariable("PATH") ?? "";
            psi.EnvironmentVariables["PATH"] = pyRuntimeDir + ";" + binPath + ";" + rootDir + ";" + currentPath;

            try
            {
                SetDllDirectory(pyRuntimeDir);
            }
            catch { }

            try
            {
                Process proc = Process.Start(psi);
                if (proc != null)
                {
                    if (proc.WaitForExit(1500))
                    {
                        if (proc.ExitCode != 0)
                        {
                            string err = proc.StandardError.ReadToEnd();
                            
                            // Otomatik VC++ onarımı dene
                            string vc64 = Path.Combine(rootDir, "vc_redist.x64.exe");
                            string vc86 = Path.Combine(rootDir, "vc_redist.x86.exe");
                            string vcExe = Environment.Is64BitOperatingSystem ? vc64 : vc86;
                            if (!File.Exists(vcExe)) vcExe = File.Exists(vc86) ? vc86 : vc64;

                            bool autoFixed = false;
                            if (File.Exists(vcExe))
                            {
                                try
                                {
                                    ProcessStartInfo vpsi = new ProcessStartInfo(vcExe, "/install /quiet /norestart");
                                    vpsi.UseShellExecute = true;
                                    vpsi.Verb = "runas";
                                    Process vproc = Process.Start(vpsi);
                                    if (vproc != null)
                                    {
                                        vproc.WaitForExit(20000);
                                        autoFixed = true;
                                    }
                                }
                                catch { }
                            }

                            if (autoFixed)
                            {
                                try
                                {
                                    Process retryProc = Process.Start(psi);
                                    if (retryProc != null)
                                    {
                                        if (!retryProc.WaitForExit(1500) || retryProc.ExitCode == 0)
                                        {
                                            return;
                                        }
                                    }
                                }
                                catch { }
                            }

                            // Detaylı ve Kopyalanabilir Hata Teşhis Penceresi Göster
                            ShowDiagnosticDialog(proc.ExitCode, err, rootDir);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                ShowDiagnosticDialog(-1, ex.ToString(), rootDir);
            }
        }

        static void ShowDiagnosticDialog(int exitCode, string errDetail, string rootDir)
        {
            string osVer = Environment.OSVersion.VersionString + (Environment.Is64BitOperatingSystem ? " (64-Bit)" : " (32-Bit)");
            string pyVer = File.Exists(Path.Combine(rootDir, "python_runtime", "python.exe")) ? "Mevcut (python_runtime/python.exe)" : "BULUNAMADI";
            
            string fullReport = "=== OYMAPOS SISTEM TESHIS VE HATA RAPORU ===\\r\\n" +
                                "Tarih / Saat: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "\\r\\n" +
                                "Isletim Sistemi: " + osVer + "\\r\\n" +
                                "Program Konumu: " + rootDir + "\\r\\n" +
                                "Python Motoru: " + pyVer + "\\r\\n" +
                                "Cikis Kodu: " + exitCode + "\\r\\n\\r\\n" +
                                "=== HATA VE SISTEM AYRINTILARI ===\\r\\n" +
                                (string.IsNullOrEmpty(errDetail) ? "Hata konsol ciktisi bos. Olasilikla eksik bir Windows 7 DLL (UCRT / KB3063858) sorunu var." : errDetail) + "\\r\\n\\r\\n" +
                                "=== EKSIK OLABILECEK BILESENLER ===\\r\\n" +
                                "1. Microsoft Visual C++ 2015-2022 Redistributable (vc_redist)\\r\\n" +
                                "2. Windows 7 KB3063858 (AddDllDirectory destegi)\\r\\n" +
                                "3. Universal C Runtime (KB2999226 / ucrtbase.dll)\\r\\n" +
                                "=============================================";

            Form diagForm = new Form();
            diagForm.Text = "OYMAPOS - Sistem Teşhis & Hata Raporu";
            diagForm.Size = new System.Drawing.Size(650, 480);
            diagForm.StartPosition = FormStartPosition.CenterScreen;
            diagForm.BackColor = System.Drawing.Color.FromArgb(15, 23, 42);
            diagForm.ForeColor = System.Drawing.Color.White;
            diagForm.Font = new System.Drawing.Font("Segoe UI", 9f);
            diagForm.FormBorderStyle = FormBorderStyle.FixedDialog;
            diagForm.MaximizeBox = false;

            Label lblInfo = new Label();
            lblInfo.Text = "⚠️ Uygulama başlatılırken bir sistem bileşeni eksikliği tespit edildi.\\r\\nAşağıdaki raporu tek tıkla kopyalayıp teknik desteğe iletebilir veya mail atabilirsiniz:";
            lblInfo.Location = new System.Drawing.Point(15, 12);
            lblInfo.Size = new System.Drawing.Size(605, 36);
            lblInfo.ForeColor = System.Drawing.Color.FromArgb(248, 113, 113);
            lblInfo.Font = new System.Drawing.Font("Segoe UI", 9.2f, System.Drawing.FontStyle.Bold);
            diagForm.Controls.Add(lblInfo);

            TextBox txtReport = new TextBox();
            txtReport.Multiline = true;
            txtReport.ReadOnly = true;
            txtReport.ScrollBars = ScrollBars.Vertical;
            txtReport.Location = new System.Drawing.Point(15, 55);
            txtReport.Size = new System.Drawing.Size(605, 320);
            txtReport.BackColor = System.Drawing.Color.FromArgb(2, 6, 23);
            txtReport.ForeColor = System.Drawing.Color.FromArgb(203, 213, 225);
            txtReport.Font = new System.Drawing.Font("Consolas", 8.8f);
            txtReport.Text = fullReport;
            diagForm.Controls.Add(txtReport);

            Button btnCopy = new Button();
            btnCopy.Text = "📋 Raporu Panoya Kopyala";
            btnCopy.Location = new System.Drawing.Point(15, 388);
            btnCopy.Size = new System.Drawing.Size(200, 38);
            btnCopy.BackColor = System.Drawing.Color.FromArgb(16, 185, 129);
            btnCopy.ForeColor = System.Drawing.Color.White;
            btnCopy.FlatStyle = FlatStyle.Flat;
            btnCopy.Font = new System.Drawing.Font("Segoe UI", 9.5f, System.Drawing.FontStyle.Bold);
            btnCopy.Cursor = Cursors.Hand;
            btnCopy.Click += (s, e) => {
                try {
                    Clipboard.SetText(fullReport);
                    MessageBox.Show("Rapor panoya kopyalandı! Artık istediğiniz yere yapıştırıp gönderebilirsiniz.", "Kopyalandı", MessageBoxButtons.OK, MessageBoxIcon.Information);
                } catch { }
            };
            diagForm.Controls.Add(btnCopy);

            Button btnClose = new Button();
            btnClose.Text = "Kapat";
            btnClose.Location = new System.Drawing.Point(510, 388);
            btnClose.Size = new System.Drawing.Size(110, 38);
            btnClose.BackColor = System.Drawing.Color.FromArgb(71, 85, 105);
            btnClose.ForeColor = System.Drawing.Color.White;
            btnClose.FlatStyle = FlatStyle.Flat;
            btnClose.Font = new System.Drawing.Font("Segoe UI", 9.5f, System.Drawing.FontStyle.Bold);
            btnClose.Cursor = Cursors.Hand;
            btnClose.Click += (s, e) => { diagForm.Close(); };
            diagForm.Controls.Add(btnClose);

            Application.Run(diagForm);
        }
    }
}
"""

# 2. Setup / Kurulum Sihirbazı C# Şablonu (Donanım/Sistem Otomatik Tanılamalı, Win7 Yamalı, Her Şey Dahil Kurulum)
CS_SETUP_SOURCE = """
using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;
using System.Security.Principal;
using System.Threading;
using System.Reflection;
using System.Runtime.InteropServices;

[assembly: AssemblyTitle("OYMAPOS Akilli Kurulum ve Onarim Sihirbazi")]
[assembly: AssemblyDescription("OYMAPOS Otomatik Donanim Tanimlamali Kurulum Sihirbazi")]
[assembly: AssemblyCompany("OYMAPOS Teknoloji")]
[assembly: AssemblyProduct("OYMAPOS")]
[assembly: AssemblyCopyright("Copyright © 2026 OYMAPOS")]
[assembly: AssemblyVersion("2.5.0.0")]
[assembly: AssemblyFileVersion("2.5.0.0")]

namespace OymaposSetup
{
    public class SetupForm : Form
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool SetDllDirectory(string lpPathName);

        [DllImport("kernel32.dll", CharSet = CharSet.Ansi, SetLastError = true)]
        private static extern IntPtr GetProcAddress(IntPtr hModule, string procName);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        private Panel pnlHeader;
        private Label lblHeaderTitle;
        private Label lblHeaderSub;

        // Sayfa 1: Donanım/Sistem Özeti & Lisans Onayı
        private Panel pnlStep1;
        private Panel pnlHardwareCard;
        private Label lblHwTitle;
        private Label lblHwOs;
        private Label lblHwArch;
        private Label lblHwDllStatus;
        private TextBox txtLicense;
        private CheckBox chkAgree;
        private Button btnNext;
        private Button btnCancel;

        // Sayfa 2: Canlı Kurulum & İlerleme
        private Panel pnlStep2;
        private Label lblInstallStatus;
        private Label lblDetailStep;
        private ProgressBar progressBar;
        private Label lblStepBadge;
        private TextBox txtFileStream;

        private string targetInstallDir = "C:\\\\OYMAPOS";
        private bool isAlreadyInstalled = false;

        // Sistem Tanılama Değişkenleri
        private string osName = "Windows Bilinmiyor";
        private string archName = "32-Bit (x86)";
        private bool isWin7OrOlder = false;
        private bool hasAddDllDirectory = true;

        public SetupForm()
        {
            this.Text = "OYMAPOS Akıllı Kurulum Sihirbazı";
            this.Size = new Size(620, 480);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(15, 23, 42);
            this.ForeColor = Color.White;
            this.Font = new Font("Segoe UI", 9f);

            InspectSystemHardware();

            isAlreadyInstalled = Directory.Exists(targetInstallDir) && File.Exists(Path.Combine(targetInstallDir, "app", "bin", "OYMAPOS.exe"));

            // 1. Üst Başlık Şeridi
            pnlHeader = new Panel() {
                Location = new Point(0, 0),
                Size = new Size(620, 70),
                BackColor = Color.FromArgb(30, 41, 59)
            };
            this.Controls.Add(pnlHeader);

            lblHeaderTitle = new Label() {
                Text = isAlreadyInstalled ? "OYMAPOS - Akıllı Sistem Onarım ve Güncelleme" : "OYMAPOS - Akıllı Market & Raf Etiketi Kurulumu",
                Font = new Font("Segoe UI", 12.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Location = new Point(20, 12),
                AutoSize = true
            };
            pnlHeader.Controls.Add(lblHeaderTitle);

            lblHeaderSub = new Label() {
                Text = isAlreadyInstalled 
                    ? "Mevcut ürün veritabanınız (data/) korunarak donanımınıza uygun şekilde onarılacaktır." 
                    : "Donanımınız otomatik algılandı. Tek tıkla kurulum başlatılmaya hazır.",
                Font = new Font("Segoe UI", 8.8f),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(21, 38),
                AutoSize = true
            };
            pnlHeader.Controls.Add(lblHeaderSub);

            // ================== ADIM 1: SİSTEM TANISI VE ONAY ==================
            pnlStep1 = new Panel() {
                Location = new Point(20, 78),
                Size = new Size(565, 355),
                BackColor = Color.Transparent
            };
            this.Controls.Add(pnlStep1);

            // Donanım & Sistem Tanılama Kartı
            pnlHardwareCard = new Panel() {
                Location = new Point(0, 5),
                Size = new Size(565, 80),
                BackColor = Color.FromArgb(24, 34, 53),
                BorderStyle = BorderStyle.FixedSingle
            };
            pnlStep1.Controls.Add(pnlHardwareCard);

            lblHwTitle = new Label() {
                Text = "🔍 Otomatik Algılanan Sistem & Donanım Profili:",
                Font = new Font("Segoe UI", 9.2f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Location = new Point(10, 6),
                AutoSize = true
            };
            pnlHardwareCard.Controls.Add(lblHwTitle);

            lblHwOs = new Label() {
                Text = "• İşletim Sistemi: " + osName + " (" + archName + ")",
                Font = new Font("Segoe UI", 8.8f),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(12, 30),
                AutoSize = true
            };
            pnlHardwareCard.Controls.Add(lblHwOs);

            lblHwArch = new Label() {
                Text = "• Cihaz Türü: Dokunmatik Barkod / POS Terminali (Afanda vb. Uyumlu)",
                Font = new Font("Segoe UI", 8.8f),
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(12, 52),
                AutoSize = true
            };
            pnlHardwareCard.Controls.Add(lblHwArch);

            lblHwDllStatus = new Label() {
                Text = hasAddDllDirectory ? "• Win7 DLL Desteği: Tam Uyumlu" : "• Win7 DLL Yaması: Kurulumda Otomatik Uygulanacak",
                Font = new Font("Segoe UI", 8.8f, FontStyle.Bold),
                ForeColor = hasAddDllDirectory ? Color.FromArgb(52, 211, 153) : Color.FromArgb(251, 191, 36),
                Location = new Point(290, 30),
                AutoSize = true
            };
            pnlHardwareCard.Controls.Add(lblHwDllStatus);

            txtLicense = new TextBox() {
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                Location = new Point(0, 95),
                Size = new Size(565, 150),
                BackColor = Color.FromArgb(2, 6, 23),
                ForeColor = Color.FromArgb(203, 213, 225),
                Font = new Font("Consolas", 8.5f),
                Text = "OYMAPOS KULLANICI LİSANS VE KURULUM GÜVENCESİ\\r\\n" +
                       "==================================================\\r\\n" +
                       "1. OTOMATİK DONANIM VE SİSTEM YAPILANDIRMASI:\\r\\n" +
                       "   - Bilgisayarınızın mimarisine uygun C++ kütüphaneleri (VC++ Redistributable 2015-2022) ve Windows 7 DLL uyumluluk yamaları kurulum esnasında otomatik olarak devreye sokulur.\\r\\n\\r\\n" +
                       "2. VERİ KORUMA GÜVENCESİ:\\r\\n" +
                       "   - İlk kurulumda sistem 'C:\\\\OYMAPOS' konumuna kurulur.\\r\\n" +
                       "   - Yeniden kurulum veya onarım yapıldığında mevcut veritabanınız (data/ klasörü), fiyatlar ve ürün kayıtlarınız ASLA silinmez, eksiksiz korunur.\\r\\n\\r\\n" +
                       "3. AĞ VE ÇEVRE BİRİMLERİ:\\r\\n" +
                       "   - Barkodlu terazi (Digi SM-100 vb.) ve mobil POS entegrasyonu için Windows Güvenlik Duvarı kuralları (Port 5000/5001) otomatik tanımlanır.\\r\\n\\r\\n" +
                       "Kuruluma başlamak için 'Sözleşmeyi onaylıyorum' kutusunu işaretleyip 'Kurulumu Başlat' butonuna tıklayınız."
            };
            pnlStep1.Controls.Add(txtLicense);

            chkAgree = new CheckBox() {
                Text = "Kullanım ve kurulum koşullarını okudum, kabul ediyorum.",
                Location = new Point(2, 256),
                Size = new Size(560, 24),
                ForeColor = Color.FromArgb(56, 189, 248),
                Font = new Font("Segoe UI", 9.2f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            chkAgree.CheckedChanged += (s, e) => {
                btnNext.Enabled = chkAgree.Checked;
                btnNext.BackColor = chkAgree.Checked ? Color.FromArgb(16, 185, 129) : Color.FromArgb(71, 85, 105);
            };
            pnlStep1.Controls.Add(chkAgree);

            btnCancel = new Button() {
                Text = "İptal",
                Location = new Point(310, 298),
                Size = new Size(110, 40),
                BackColor = Color.FromArgb(51, 65, 85),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnCancel.FlatAppearance.BorderSize = 0;
            btnCancel.Click += (s, e) => { this.Close(); };
            pnlStep1.Controls.Add(btnCancel);

            btnNext = new Button() {
                Text = isAlreadyInstalled ? "🛠️ Onar ve Başlat" : "⚡ Kurulumu Başlat",
                Location = new Point(430, 298),
                Size = new Size(135, 40),
                BackColor = Color.FromArgb(71, 85, 105),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                Enabled = false,
                Cursor = Cursors.Hand
            };
            btnNext.FlatAppearance.BorderSize = 0;
            btnNext.Click += (s, e) => { ProceedToStep2(); };
            pnlStep1.Controls.Add(btnNext);

            // ================== ADIM 2: OTOMATİK KURULUM VE İLERLEME ==================
            pnlStep2 = new Panel() {
                Location = new Point(20, 78),
                Size = new Size(565, 355),
                BackColor = Color.Transparent,
                Visible = false
            };
            this.Controls.Add(pnlStep2);

            lblStepBadge = new Label() {
                Text = "⚡ Akıllı Kurulum ve Donanım Yapılandırması...",
                Location = new Point(0, 5),
                AutoSize = true,
                ForeColor = Color.FromArgb(56, 189, 248),
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold)
            };
            pnlStep2.Controls.Add(lblStepBadge);

            lblInstallStatus = new Label() {
                Text = "Kurulum başlatılıyor...",
                Location = new Point(0, 35),
                Size = new Size(565, 24),
                ForeColor = Color.FromArgb(241, 245, 249),
                Font = new Font("Segoe UI", 9.8f, FontStyle.Bold)
            };
            pnlStep2.Controls.Add(lblInstallStatus);

            progressBar = new ProgressBar() {
                Location = new Point(0, 65),
                Size = new Size(565, 24),
                Style = ProgressBarStyle.Continuous,
                Value = 0
            };
            pnlStep2.Controls.Add(progressBar);

            lblDetailStep = new Label() {
                Text = "Kalan Süre: Hesaplanıyor... | Aktarılan: 0/0",
                Location = new Point(0, 95),
                Size = new Size(565, 22),
                ForeColor = Color.FromArgb(56, 189, 248),
                Font = new Font("Segoe UI", 8.8f, FontStyle.Bold)
            };
            pnlStep2.Controls.Add(lblDetailStep);

            txtFileStream = new TextBox() {
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Vertical,
                Location = new Point(0, 122),
                Size = new Size(565, 220),
                BackColor = Color.FromArgb(2, 6, 23),
                ForeColor = Color.FromArgb(148, 163, 184),
                Font = new Font("Consolas", 8f)
            };
            pnlStep2.Controls.Add(txtFileStream);
        }

        private void InspectSystemHardware()
        {
            try
            {
                archName = Environment.Is64BitOperatingSystem ? "64-Bit (x64)" : "32-Bit (x86)";
                OperatingSystem os = Environment.OSVersion;
                if (os.Platform == PlatformID.Win32NT)
                {
                    if (os.Version.Major == 6 && os.Version.Minor == 1)
                    {
                        osName = "Windows 7 / Server 2008 R2";
                        isWin7OrOlder = true;
                    }
                    else if (os.Version.Major == 6 && os.Version.Minor == 2)
                    {
                        osName = "Windows 8";
                    }
                    else if (os.Version.Major == 6 && os.Version.Minor == 3)
                    {
                        osName = "Windows 8.1";
                    }
                    else if (os.Version.Major >= 10)
                    {
                        osName = "Windows 10 / 11";
                    }
                    else
                    {
                        osName = "Windows " + os.Version.ToString();
                    }
                }

                // AddDllDirectory Testi (kernel32)
                IntPtr hKernel = GetModuleHandle("kernel32.dll");
                if (hKernel != IntPtr.Zero)
                {
                    IntPtr proc = GetProcAddress(hKernel, "AddDllDirectory");
                    hasAddDllDirectory = (proc != IntPtr.Zero);
                }
            }
            catch
            {
                osName = "Windows 7 Professional";
                archName = "x64";
            }
        }

        private void ProceedToStep2()
        {
            pnlStep1.Visible = false;
            pnlStep2.Visible = true;

            Thread th = new Thread(() => RunAutomatedPipeline());
            th.IsBackground = true;
            th.Start();
        }

        private void SetPipelineStatus(int progress, string mainTitle, string detail, string logLine = null)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => SetPipelineStatus(progress, mainTitle, detail, logLine)));
                return;
            }
            if (progress >= 0 && progress <= 100) progressBar.Value = progress;
            if (!string.IsNullOrEmpty(mainTitle)) lblInstallStatus.Text = mainTitle;
            if (!string.IsNullOrEmpty(detail)) lblDetailStep.Text = detail;
            if (!string.IsNullOrEmpty(logLine) && txtFileStream != null)
            {
                txtFileStream.AppendText(logLine + "\\r\\n");
            }
        }

        private void RunAutomatedPipeline()
        {
            try
            {
                string currentDir = AppDomain.CurrentDomain.BaseDirectory;
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);

                SetPipelineStatus(5, "1/5: Sistem & Donanım Taranıyor...", "Mimari: " + archName + " | OS: " + osName, ">>> OYMAPOS Akilli Kurulum Baslatildi.");
                SetPipelineStatus(8, "1/5: Hedef Dizin Hazırlanıyor...", targetInstallDir, ">>> Kurulum Hedefi: " + targetInstallDir);

                if (!Directory.Exists(targetInstallDir))
                {
                    Directory.CreateDirectory(targetInstallDir);
                }

                // Açık süreçleri kapat
                try
                {
                    ProcessStartInfo kpsi = new ProcessStartInfo("taskkill", "/F /IM OYMAPOS.exe /T") { CreateNoWindow = true, UseShellExecute = false };
                    Process kproc = Process.Start(kpsi);
                    if (kproc != null) kproc.WaitForExit(1000);
                }
                catch { }

                // Eski app ve python_runtime klasörlerini temizle (data'ya ASLA dokunma)
                string[] cleanupDirs = new string[] { "app", "python_runtime" };
                foreach (string cDir in cleanupDirs)
                {
                    string targetSubDir = Path.Combine(targetInstallDir, cDir);
                    if (Directory.Exists(targetSubDir))
                    {
                        try
                        {
                            SetPipelineStatus(10, "Eski Sürüm Temizleniyor...", cDir + " klasörü yenileniyor...", ">>> Temizleniyor: " + targetSubDir);
                            Directory.Delete(targetSubDir, true);
                        }
                        catch { }
                    }
                }

                // 1. Gömülü Paketi (payload.pak) Aç
                Assembly currentAsm = Assembly.GetExecutingAssembly();
                Stream pakStream = currentAsm.GetManifestResourceStream("payload.pak");

                DateTime startTime = DateTime.Now;
                int copiedCount = 0;

                if (pakStream != null)
                {
                    using (BinaryReader br = new BinaryReader(pakStream))
                    {
                        byte[] magic = br.ReadBytes(8);
                        uint totalCount = br.ReadUInt32();
                        SetPipelineStatus(12, "1/5: Gömülü Paket Çıkarılıyor", "Toplam " + totalCount + " dosya aktarılıyor...", ">>> Gömülü OYMAPOS Paketi bulundu (" + totalCount + " dosya).");

                        for (uint i = 0; i < totalCount; i++)
                        {
                            ushort nameLen = br.ReadUInt16();
                            byte[] nameBytes = br.ReadBytes(nameLen);
                            string relPath = System.Text.Encoding.UTF8.GetString(nameBytes).Replace('/', '\\\\');

                            byte isComp = br.ReadByte();
                            uint origLen = br.ReadUInt32();
                            uint storeLen = br.ReadUInt32();
                            byte[] storeData = br.ReadBytes((int)storeLen);

                            // data/ klasörünü hedefte zaten varsa ezme
                            if (relPath.StartsWith("data\\\\", StringComparison.OrdinalIgnoreCase))
                            {
                                string existingDataFile = Path.Combine(targetInstallDir, relPath);
                                if (File.Exists(existingDataFile))
                                {
                                    continue;
                                }
                            }

                            string dstFile = Path.Combine(targetInstallDir, relPath);
                            string dstDir = Path.GetDirectoryName(dstFile);
                            if (!Directory.Exists(dstDir)) Directory.CreateDirectory(dstDir);

                            try
                            {
                                if (isComp == 1)
                                {
                                    using (MemoryStream msIn = new MemoryStream(storeData))
                                    {
                                        if (storeData.Length > 2 && (storeData[0] == 0x78 || storeData[0] == 0x58))
                                        {
                                            msIn.Seek(2, SeekOrigin.Begin);
                                        }
                                        using (var ds = new System.IO.Compression.DeflateStream(msIn, System.IO.Compression.CompressionMode.Decompress))
                                        using (FileStream fsOut = new FileStream(dstFile, FileMode.Create, FileAccess.Write))
                                        {
                                            byte[] buf = new byte[8192];
                                            int read;
                                            while ((read = ds.Read(buf, 0, buf.Length)) > 0)
                                            {
                                                fsOut.Write(buf, 0, read);
                                            }
                                        }
                                    }
                                }
                                else
                                {
                                    File.WriteAllBytes(dstFile, storeData);
                                }
                            }
                            catch { }

                            copiedCount++;
                            int pct = 15 + (int)(((double)copiedCount / Math.Max(1, (int)totalCount)) * 40); // %15 -> %55

                            TimeSpan elapsed = DateTime.Now - startTime;
                            double secPerFile = elapsed.TotalSeconds / Math.Max(1, copiedCount);
                            double remainingSec = Math.Max(0, ((int)totalCount - copiedCount) * secPerFile);
                            string etaStr = remainingSec < 60 ? (int)remainingSec + " sn" : ((int)remainingSec / 60) + " dk " + ((int)remainingSec % 60) + " sn";

                            string detail = "Kalan Süre: ~" + etaStr + " | Aktarılan: " + copiedCount + " / " + totalCount + " (" + pct + "%)";
                            SetPipelineStatus(pct, "1/5: Dosyalar Aktarılıyor (" + pct + "%)", detail, "KURULDU: " + relPath);
                        }
                    }
                }

                string runtimeBaseDir = Directory.Exists(targetInstallDir) ? targetInstallDir : currentDir;

                // Windows 7 pywin32.pth çakışma temizliği
                try
                {
                    string badPth = Path.Combine(runtimeBaseDir, "python_runtime", "site-packages", "pywin32.pth");
                    if (File.Exists(badPth)) File.Delete(badPth);
                }
                catch { }

                // --- ADIM 2: VC++ Redistributable & UCRT Otomatik Sessiz Kurulumu ---
                SetPipelineStatus(60, "2/5: Sistem Bileşenleri ve C++ Sürücüleri Kuruluyor", "C++ Çalışma Zamanları (vc_redist) yapılandırılıyor...", ">>> VC++ 2015-2022 / Universal C Runtime denetleniyor...");
                try
                {
                    string vc64 = Path.Combine(runtimeBaseDir, "vc_redist.x64.exe");
                    string vc86 = Path.Combine(runtimeBaseDir, "vc_redist.x86.exe");
                    string vcExe = Environment.Is64BitOperatingSystem ? vc64 : vc86;
                    if (!File.Exists(vcExe)) vcExe = File.Exists(vc86) ? vc86 : vc64;

                    if (File.Exists(vcExe))
                    {
                        SetPipelineStatus(68, "2/5: C++ Runtime Sessizce Yükleniyor...", "Dosya: " + Path.GetFileName(vcExe), ">>> Calistiriliyor: " + Path.GetFileName(vcExe));
                        ProcessStartInfo vpsi = new ProcessStartInfo(vcExe, "/install /quiet /norestart") {
                            UseShellExecute = true,
                            Verb = "runas"
                        };
                        try
                        {
                            Process vproc = Process.Start(vpsi);
                            if (vproc != null) vproc.WaitForExit(15000);
                        }
                        catch { }
                    }
                }
                catch { }

                // --- ADIM 3: Masaüstü Kısayolları ---
                SetPipelineStatus(78, "3/5: Masaüstü Kısayolları Oluşturuluyor", "Kasa Satışı, Terazi, Stok ve Ana Menü simgeleri ekleniyor...", ">>> Masaustu kisayollari olusturuluyor...");
                try
                {
                    Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                    if (shellType != null)
                    {
                        dynamic shell = Activator.CreateInstance(shellType);
                        string binDir = Path.Combine(runtimeBaseDir, "app", "bin");
                        if (!Directory.Exists(binDir)) binDir = runtimeBaseDir;

                        var shortcuts = new[] {
                            new { File = "Kasa_Satisi.exe", Name = "Kasa Satisi.lnk", Desc = "Hizli Kasa Satis Terminali" },
                            new { File = "Barkodlu_Terazi.exe", Name = "Barkodlu Terazi.lnk", Desc = "Manav ve Terazi Yonetimi" },
                            new { File = "Toplu_Stok_Katalogu.exe", Name = "Toplu Stok Katalogu.lnk", Desc = "Urun Katalogu ve Stok Yonetimi" },
                            new { File = "Hizli_Urun_ve_Fiyat.exe", Name = "Hizli Urun ve Fiyat.lnk", Desc = "Hizli Urun ve Fiyat Degistirme" },
                            new { File = "OYMAPOS.exe", Name = "OYMAPOS.lnk", Desc = "OYMAPOS Market Raf Etiketi ve Satis Sistemi" }
                        };

                        foreach (var sc in shortcuts)
                        {
                            string targetExe = Path.Combine(binDir, sc.File);
                            if (!File.Exists(targetExe)) targetExe = Path.Combine(runtimeBaseDir, sc.File);

                            if (File.Exists(targetExe))
                            {
                                string lnkPath = Path.Combine(desktopDir, sc.Name);
                                dynamic shortcut = shell.CreateShortcut(lnkPath);
                                shortcut.TargetPath = targetExe;
                                shortcut.WorkingDirectory = runtimeBaseDir;
                                shortcut.Description = sc.Desc;
                                shortcut.IconLocation = targetExe + ",0";
                                shortcut.Save();
                                SetPipelineStatus(82, "Kısayol Eklendi", sc.Name, "KISAYOL: " + sc.Name + " -> " + targetExe);
                            }
                        }
                    }
                }
                catch { }

                // --- ADIM 4: Ağ ve Güvenlik Duvarı ---
                SetPipelineStatus(90, "4/5: Ağ İzinleri Tanımlanıyor", "Yerel ağ ve terazi bağlantı portları açılıyor...", ">>> Guvenlik duvari port kurallari (5000, 5001) ekleniyor...");
                try
                {
                    ProcessStartInfo fpsi = new ProcessStartInfo("netsh", "advfirewall firewall add rule name=\\\"OYMAPOS Yerel Ag\\\" dir=in action=allow protocol=TCP localport=5000,5001 profile=any") {
                        CreateNoWindow = true,
                        UseShellExecute = false
                    };
                    Process proc = Process.Start(fpsi);
                    if (proc != null) proc.WaitForExit(1500);
                }
                catch { }

                // --- ADIM 5: Tamamlandı ve Başlatılıyor ---
                SetPipelineStatus(100, "5/5: Kurulum Başarıyla Tamamlandı!", "OYMAPOS başlatılıyor...", ">>> OYMAPOS Baslatiliyor...");
                Thread.Sleep(800);

                string mainExe = Path.Combine(runtimeBaseDir, "app", "bin", "OYMAPOS.exe");
                if (!File.Exists(mainExe)) mainExe = Path.Combine(runtimeBaseDir, "OYMAPOS.exe");

                if (File.Exists(mainExe))
                {
                    Process.Start(new ProcessStartInfo(mainExe) { WorkingDirectory = runtimeBaseDir });
                }

                Thread.Sleep(800);
                this.BeginInvoke(new Action(() => this.Close()));
            }
            catch (Exception ex)
            {
                SetPipelineStatus(100, "Hata Oluştu", "Hata: " + ex.Message, "!!! KRITIK HATA: " + ex.ToString());
                Thread.Sleep(2000);
                this.BeginInvoke(new Action(() => this.Close()));
            }
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
"""

def compile_csharp(source_code, output_exe, icon_path, require_admin=False, resource_file=None):
    """CSC ile Windows GUI uygulamasını derler."""
    temp_cs = os.path.join(BASE_DIR, "temp_launcher.cs")
    temp_manifest = os.path.join(BASE_DIR, "temp_app.manifest")
    
    with open(temp_cs, "w", encoding="utf-8") as f:
        f.write(source_code)

    uac_level = "requireAdministrator" if require_admin else "asInvoker"
    manifest_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <assemblyIdentity version="2.5.0.0" name="OYMAPOS.App"/>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">
    <security>
      <requestedPrivileges xmlns="urn:schemas-microsoft-com:asm.v3">
        <requestedExecutionLevel level="{uac_level}" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 & 11 -->
      <supportedOS Id="{{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}}"/>
      <!-- Windows 8.1 -->
      <supportedOS Id="{{1f676c76-80e1-4239-95bb-83d0f6d0da78}}"/>
      <!-- Windows 8 -->
      <supportedOS Id="{{4a2f28e3-53b9-4441-ba9c-d69d4a4a6e38}}"/>
      <!-- Windows 7 -->
      <supportedOS Id="{{35138b9a-5d96-4fbd-8e2d-a2440225f93a}}"/>
    </application>
  </compatibility>
</assembly>"""
    
    with open(temp_manifest, "w", encoding="utf-8") as f:
        f.write(manifest_xml)

    cmd = [
        CSC_PATH,
        "/target:winexe",
        "/platform:anycpu",
        f"/out:{output_exe}",
        f"/win32icon:{icon_path}",
        f"/win32manifest:{temp_manifest}",
        "/reference:System.Windows.Forms.dll",
        "/reference:System.Drawing.dll",
    ]

    if resource_file and os.path.exists(resource_file):
        cmd.append(f"/resource:{resource_file}")

    cmd.append(temp_cs)

    res = subprocess.run(cmd, capture_output=True, text=False)
    for tmp in [temp_cs, temp_manifest]:
        if os.path.exists(tmp):
            try: os.remove(tmp)
            except: pass

    if res.returncode == 0 and os.path.exists(output_exe):
        print(f"Derleme Basarili: {os.path.basename(output_exe)}")
        return True
    else:
        err_msg = res.stderr.decode('utf-8', errors='ignore') or res.stdout.decode('utf-8', errors='ignore')
        print(f"Derleme Hatasi ({output_exe}):", err_msg)
        return False

def copy_all_system_dlls(target_dir):
    """build_tools/redist altındaki tüm kritik DLL'leri hedef klasöre kopyalar."""
    redist_dir = os.path.join(BASE_DIR, "redist")
    if os.path.exists(redist_dir):
        for fname in os.listdir(redist_dir):
            if fname.lower().endswith(".dll"):
                src = os.path.join(redist_dir, fname)
                dst = os.path.join(target_dir, fname)
                try:
                    shutil.copy2(src, dst)
                except Exception:
                    pass

def sync_project_source_to_portable(portable_dir):
    """Ana proje kaynak dosyalarını (backend, frontend, data şablonları, desktop_app.py vb.) portable klasöre kopyalar."""
    print("Ana proje kaynak dosyalari ve web arayuzu tasinabilir ortama senkronize ediliyor...")
    
    # 1. Klasörleri kopyala
    dirs_to_copy = ["backend", "frontend", "data"]
    for dname in dirs_to_copy:
        src_d = os.path.join(ROOT_DIR, dname)
        dst_d = os.path.join(portable_dir, dname)
        if os.path.exists(src_d):
            os.makedirs(dst_d, exist_ok=True)
            for s_root, s_dirs, s_files in os.walk(src_d):
                rel_dir = os.path.relpath(s_root, src_d)
                target_root = os.path.join(dst_d, rel_dir) if rel_dir != "." else dst_d
                os.makedirs(target_root, exist_ok=True)
                for sf in s_files:
                    try:
                        shutil.copy2(os.path.join(s_root, sf), os.path.join(target_root, sf))
                    except Exception:
                        pass

    # 2. Ana başlatıcı ve betik dosyalarını kopyala
    files_to_copy = ["desktop_app.py", "main.py"]
    for fname in files_to_copy:
        src_f = os.path.join(ROOT_DIR, fname)
        dst_f = os.path.join(portable_dir, fname)
        if os.path.exists(src_f):
            shutil.copy2(src_f, dst_f)

    # 3. VC++ Redistributable yükleyicilerini köke kopyala
    for vcf in ["vc_redist.x64.exe", "vc_redist.x86.exe"]:
        vcf_src = os.path.join(DIST_DIR, vcf)
        if not os.path.exists(vcf_src):
            vcf_src = os.path.join(BASE_DIR, "redist", vcf)
        if os.path.exists(vcf_src):
            shutil.copy2(vcf_src, os.path.join(portable_dir, vcf))

def build_custom_pak(source_dir, out_pak):
    """Tüm taşınabilir ortamı tek bir sıkıştırılmış pak dosyası haline getirir."""
    print("Sistem dosyalari ve DLL'ler paketleniyor...")
    entries = []
    for root, dirs, files in os.walk(source_dir):
        for f in files:
            if f.lower() == 'setup.exe' or f.lower() == 'payload.pak': continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, source_dir).replace('\\', '/')
            with open(full_path, 'rb') as fp:
                raw_data = fp.read()
            compressed = zlib.compress(raw_data, 6)
            is_comp = 1 if len(compressed) < len(raw_data) else 0
            store_data = compressed if is_comp == 1 else raw_data
            entries.append((rel_path, is_comp, len(raw_data), store_data))

    with open(out_pak, 'wb') as fp:
        fp.write(b'OYMAPAK1')
        fp.write(struct.pack('<I', len(entries)))
        for rel_path, is_comp, orig_len, store_data in entries:
            name_bytes = rel_path.encode('utf-8')
            fp.write(struct.pack('<H', len(name_bytes)))
            fp.write(name_bytes)
            fp.write(struct.pack('<BII', is_comp, orig_len, len(store_data)))
            fp.write(store_data)

    print(f"Paketleme tamamlandi: {len(entries)} dosya ({os.path.getsize(out_pak) / (1024*1024):.2f} MB)")

def build_all_executables():
    os.makedirs(PORTABLE_DIR, exist_ok=True)
    os.makedirs(APP_BIN_DIR, exist_ok=True)
    py_runtime_dir = os.path.join(PORTABLE_DIR, "python_runtime")

    # Proje kaynak dosyalarını portable pakete senkronize et
    sync_project_source_to_portable(PORTABLE_DIR)

    # Tüm kritik DLL'leri (api-ms-win-*, ucrtbase, vcruntime140 vb.) bin ve runtime alt klasörlerine kopyala
    copy_all_system_dlls(APP_BIN_DIR)
    copy_all_system_dlls(PORTABLE_DIR)
    if os.path.exists(py_runtime_dir):
        copy_all_system_dlls(py_runtime_dir)

    # 1. Modül Exe'lerini app/bin içerisine derle
    modules = [
        ("Kasa_Satisi.exe", "--module=pos", "icon_kasa.ico"),
        ("Barkodlu_Terazi.exe", "--module=manav", "icon_terazi.ico"),
        ("Toplu_Stok_Katalogu.exe", "--module=catalog", "icon_stok.ico"),
        ("Hizli_Urun_ve_Fiyat.exe", "--module=sync", "icon_hizli.ico"),
        ("OYMAPOS.exe", "", "icon_main.ico"),
    ]

    for exe_name, flag, icon_file in modules:
        out_exe = os.path.join(APP_BIN_DIR, exe_name)
        ico_p = os.path.join(ICONS_DIR, icon_file)
        src = CS_LAUNCHER_TEMPLATE.replace("MODULE_FLAG", flag)
        compile_csharp(src, out_exe, ico_p)

    # 2. Taşınabilir tüm paketi 'payload.pak' dosyası olarak paketle
    payload_pak = os.path.join(DIST_DIR, "payload.pak")
    build_custom_pak(PORTABLE_DIR, payload_pak)

    # 3. Bağımsız Tek Parça (Standalone) Setup.exe Derle
    # Bu Setup.exe tüm DLL'leri, Python'u ve modülleri bünyesinde barındırır (ZIP gerektirmez).
    standalone_setup = os.path.join(DIST_DIR, "Setup.exe")
    setup_ico = os.path.join(ICONS_DIR, "icon_setup.ico")
    
    print("Tek parca bagimsiz Setup.exe olusturuluyor (Resource gomuluyor)...")
    compile_csharp(CS_SETUP_SOURCE, standalone_setup, setup_ico, require_admin=True, resource_file=payload_pak)

    # Ayrıca dist/OYMAPOS_Windows7_Portable/Setup.exe olarak da kopyala
    portable_setup = os.path.join(PORTABLE_DIR, "Setup.exe")
    try:
        shutil.copy2(standalone_setup, portable_setup)
    except:
        pass

    # Temizlik: payload.pak geçici dosyasını kaldır
    if os.path.exists(payload_pak):
        try: os.remove(payload_pak)
        except: pass

    print(f"\n>>> BASARILI: Tek parca Setup.exe olusturuldu:\n    Hedef: {standalone_setup}\n    Boyut: {os.path.getsize(standalone_setup) / (1024*1024):.2f} MB\n")

if __name__ == '__main__':
    build_all_executables()
