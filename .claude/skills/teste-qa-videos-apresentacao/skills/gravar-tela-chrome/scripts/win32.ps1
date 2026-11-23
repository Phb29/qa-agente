# Interop Win32 compartilhado pelos scripts de gravacao.
if (-not ("Win32Grav" -as [type])) {
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class JanelaGrav { public long Hwnd; public string Titulo; public int X, Y, W, H; }
public static class Win32Grav {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  // O Windows recusa SetForegroundWindow de processo em segundo plano; um toque de Alt libera a troca.
  public static bool TrazerParaFrente(long h) {
    var p = new IntPtr(h);
    if (GetForegroundWindow() == p) return true;
    keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);
    SetForegroundWindow(p);
    System.Threading.Thread.Sleep(200);
    return GetForegroundWindow() == p;
  }
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static List<JanelaGrav> ListarChrome() {
    SetProcessDPIAware();
    var lista = new List<JanelaGrav>();
    EnumWindows((h, l) => {
      var c = new StringBuilder(256); GetClassName(h, c, 256);
      if (c.ToString() != "Chrome_WidgetWin_1" || !IsWindowVisible(h)) return true;
      var t = new StringBuilder(512); GetWindowText(h, t, 512);
      string titulo = t.ToString();
      if (!titulo.EndsWith("Google Chrome") && !titulo.EndsWith("Brave")) return true;
      RECT r; DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT)));
      lista.Add(new JanelaGrav { Hwnd = h.ToInt64(), Titulo = titulo, X = r.L, Y = r.T, W = r.R - r.L, H = r.B - r.T });
      return true;
    }, IntPtr.Zero);
    return lista;
  }
  public static bool Minimizada(long h) { return IsIconic(new IntPtr(h)); }
  public static string Titulo(long h) { var t = new StringBuilder(512); GetWindowText(new IntPtr(h), t, 512); return t.ToString(); }
}
"@
}
