param(
  [string]$Out = "screenshot.png",
  [string]$TitleLike = "*DeepSeek Harness*",
  [string]$Mode = "print"   # print (PrintWindow, works while occluded) | screen (CopyFromScreen)
)
# Dev helper for step evidence screenshots (PLAN §7.5). Windows only.
#   powershell -ExecutionPolicy Bypass -File scripts/capture-window.ps1 -Out shots/x.png
# Not shipped in the npm package (package.json "files" excludes scripts/).
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class DshCap {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
[DshCap]::SetProcessDPIAware() | Out-Null

$script:found = [IntPtr]::Zero
$script:title = ""
$cb = [DshCap+EnumWindowsProc]{
  param($h, $l)
  $sb = New-Object System.Text.StringBuilder 1024
  [DshCap]::GetWindowText($h, $sb, 1024) | Out-Null
  $t = $sb.ToString()
  if ($t -like $TitleLike -and [DshCap]::IsWindowVisible($h)) { $script:found = $h; $script:title = $t; return $false }
  return $true
}
[DshCap]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
if ($script:found -eq [IntPtr]::Zero) { Write-Output "WINDOW_NOT_FOUND"; exit 2 }

$rect = New-Object DshCap+RECT
[DshCap]::GetWindowRect($script:found, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
if ($w -le 0 -or $h -le 0) { Write-Output "BAD_RECT ${w}x${h}"; exit 3 }
$dir = Split-Path -Parent $Out
if ($dir -ne "") { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
if ([DshCap]::IsIconic($script:found)) { [DshCap]::ShowWindow($script:found, 9) | Out-Null; Start-Sleep -Milliseconds 250 }

$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
if ($Mode -eq "screen") {
  [DshCap]::SetForegroundWindow($script:found) | Out-Null
  Start-Sleep -Milliseconds 500
  $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($w, $h)))
} else {
  $hdc = $g.GetHdc()
  $ok = [DshCap]::PrintWindow($script:found, $hdc, 2)   # PW_RENDERFULLCONTENT
  $g.ReleaseHdc($hdc)
  Write-Output "PRINTWINDOW=$ok"
}
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "OK mode=$Mode title=[$($script:title)] size=${w}x${h} out=$Out"