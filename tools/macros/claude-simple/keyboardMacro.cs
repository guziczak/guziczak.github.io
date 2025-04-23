using System;
using System.Windows.Forms;
using System.Threading;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;

namespace KeyboardMacro
{
    public class KeyboardMacroApp : Form
    {
        // Import funkcji Windows API
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
        
        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();
        
        [DllImport("user32.dll")]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
        
        [DllImport("user32.dll")]
        private static extern int GetWindowTextLength(IntPtr hWnd);
        
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
        
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        // Delegat dla funkcji EnumWindows
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        
        // Stałe potrzebne do symulacji klawiszy
        const byte VK_LWIN = 0x5B;    // Lewy klawisz Windows
        const byte VK_H = 0x48;       // Klawisz H
        const uint KEYEVENTF_KEYDOWN = 0x0000;
        const uint KEYEVENTF_KEYUP = 0x0002;
        
        // Maksymalny czas oczekiwania na Claude w milisekundach (5 sekund)
        const int MAX_WAIT_TIME = 5000;
        
        public KeyboardMacroApp()
        {
            // Ukryj okno aplikacji
            this.ShowInTaskbar = false;
            this.WindowState = FormWindowState.Minimized;
            this.FormBorderStyle = FormBorderStyle.None;
            this.Opacity = 0;
            
            // Uruchom makro po załadowaniu formularza
            this.Load += (sender, e) => 
            {
                System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
                timer.Interval = 100;
                timer.Tick += (s, args) => 
                {
                    timer.Stop();
                    RunMacro();
                    Application.Exit();
                };
                timer.Start();
            };
        }
        
        // Pobiera tytuł aktywnego okna
        private string GetActiveWindowTitle()
        {
            IntPtr handle = GetForegroundWindow();
            return GetWindowTitle(handle);
        }
        
        // Pobiera tytuł okna na podstawie jego uchwytu
        private string GetWindowTitle(IntPtr hWnd)
        {
            int length = GetWindowTextLength(hWnd);
            if (length == 0) return "";
            
            StringBuilder builder = new StringBuilder(length + 1);
            GetWindowText(hWnd, builder, builder.Capacity);
            return builder.ToString();
        }
        
        // Sprawdza, czy tytuł okna wskazuje na okno Claude
        private bool IsClaudeWindow(string windowTitle)
        {
            // Dostosuj tę linię do rzeczywistego tytułu okna Claude
            return windowTitle.Contains("Claude");
        }
        
        // Pobiera listę wszystkich widocznych okien Claude
        private List<IntPtr> GetAllClaudeWindows()
        {
            List<IntPtr> claudeWindows = new List<IntPtr>();
            
            EnumWindows((hWnd, lParam) => {
                if (IsWindowVisible(hWnd))
                {
                    string title = GetWindowTitle(hWnd);
                    if (IsClaudeWindow(title))
                    {
                        claudeWindows.Add(hWnd);
                    }
                }
                return true;
            }, IntPtr.Zero);
            
            return claudeWindows;
        }
        
        private void RunMacro()
        {
            // Pobierz początkową zawartość schowka
            string initialClipboard = "";
            try
            {
                initialClipboard = Clipboard.GetText();
            }
            catch (Exception)
            {
                initialClipboard = "";
            }
            
            // Symuluj Ctrl+C aby skopiować zaznaczoną zawartość
            SendKeys.SendWait("^c");
            
            // Poczekaj chwilę, aby operacja kopiowania się zakończyła
            Thread.Sleep(50);
            
            // Sprawdź, czy zawartość schowka się zmieniła
            bool clipboardChanged = false;
            try
            {
                string currentClipboard = Clipboard.GetText();
                clipboardChanged = !string.Equals(initialClipboard, currentClipboard);
            }
            catch (Exception)
            {
                clipboardChanged = false;
            }
            
            // Zapamiętaj aktywne okno przed wywołaniem Claude
            IntPtr activeWindowBefore = GetForegroundWindow();
            string activeWindowTitleBefore = GetWindowTitle(activeWindowBefore);
            
            // Pobierz listę istniejących okien Claude przed wywołaniem skrótu
            List<IntPtr> claudeWindowsBefore = GetAllClaudeWindows();
            
            // Symuluj Ctrl+Alt+Space aby uruchomić Claude
            SendKeys.SendWait("^% ");
            
            // Czekaj na zmianę aktywnego okna
            Stopwatch stopwatch = new Stopwatch();
            stopwatch.Start();
            bool newClaudeDetected = false;
            
            while (stopwatch.ElapsedMilliseconds < MAX_WAIT_TIME && !newClaudeDetected)
            {
                // Pobierz aktualnie aktywne okno
                IntPtr currentActiveWindow = GetForegroundWindow();
                string currentTitle = GetWindowTitle(currentActiveWindow);
                
                // Sprawdź, czy to jest okno Claude
                if (IsClaudeWindow(currentTitle))
                {
                    // Jeśli okno się zmieniło i to jest Claude
                    if (currentActiveWindow != activeWindowBefore)
                    {
                        // Dodatkowe sprawdzenie - czy to okno jest nowe (nie było na wcześniejszej liście)
                        bool isNewWindow = true;
                        foreach (IntPtr oldWindow in claudeWindowsBefore)
                        {
                            if (currentActiveWindow == oldWindow)
                            {
                                isNewWindow = false;
                                break;
                            }
                        }
                        
                        // Jeśli to nowe okno Claude lub to jest inne okno niż poprzednie aktywne okno
                        if (isNewWindow || !IsClaudeWindow(activeWindowTitleBefore))
                        {
                            newClaudeDetected = true;
                            break;
                        }
                    }
                }
                
                // Krótka pauza, aby nie obciążać procesora
                Thread.Sleep(10);
            }
            
            // Jeśli nie wykryto nowego okna Claude, poczekaj trochę (awaryjne opóźnienie)
            if (!newClaudeDetected)
            {
                Thread.Sleep(800);
            }
            
            // Wykonaj sekwencję klawiszy bardzo szybko
            // Symuluj Ctrl+A (Zaznacz wszystko)
            SendKeys.SendWait("^a");
            Thread.Sleep(20);
            
            // Jeśli zawartość schowka się zmieniła, symuluj Ctrl+V (Wklej)
            if (clipboardChanged)
            {
                SendKeys.SendWait("^v");
                Thread.Sleep(20);
            }
            
            // Symuluj Space (Spacja)
            SendKeys.SendWait(" ");
            Thread.Sleep(20);
            
            // Symuluj Shift+Enter
            SendKeys.SendWait("+{ENTER}");
            Thread.Sleep(20);
            
            // Symuluj Space (Spacja)
            SendKeys.SendWait(" ");
            Thread.Sleep(20);
            
            // Symuluj Windows+H używając Windows API
            SimulateWinH();
        }
        
        private void SimulateWinH()
        {
            // Naciśnij klawisz Windows
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
            
            // Naciśnij klawisz H
            keybd_event(VK_H, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
            
            // Zwolnij klawisz H
            keybd_event(VK_H, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            
            // Zwolnij klawisz Windows
            keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }
        
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new KeyboardMacroApp());
        }
    }
}