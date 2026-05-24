import { execSync, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const isWindows = process.platform === 'win32'

/* ── PowerShell 헬퍼 ── */
function runPS(script: string, timeout = 8000): Buffer {
  const encoded = Buffer.from(script.trim(), 'utf16le').toString('base64')
  return execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
    encoding: 'buffer',
    timeout,
    windowsHide: true,
  })
}

function psText(script: string, timeout = 8000): string {
  return runPS(script, timeout).toString('utf8').trim()
}

/* ── 채팅방: 찾기 + 활성화 한 번에 (PowerShell 단일 호출) ── */
// 찾기(EnumWindows)와 활성화(ShowWindow+SetForegroundWindow)를
// 하나의 C# 클래스에서 처리해서 ffi-rs 블로킹 없이 완료.
function findAndActivateWindow(chatName: string): 'ok' | 'not_found' | 'error' {
  const escaped = chatName.replace(/'/g, "''")
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinActivate {
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc e, IntPtr p);
    private delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr h);
    public static string FindAndActivate(string title) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, p) => {
            if (!IsWindowVisible(h)) return true;
            var sb = new StringBuilder(512);
            GetWindowText(h, sb, sb.Capacity);
            if (sb.ToString() == title) { found = h; return false; }
            return true;
        }, IntPtr.Zero);
        if (found == IntPtr.Zero) return "not_found";
        ShowWindow(found, 9);
        SetForegroundWindow(found);
        return "ok";
    }
}
"@
[WinActivate]::FindAndActivate('${escaped}')
`
  try {
    console.log(`[kakao] findAndActivate start: "${chatName}"`)
    const result = psText(script, 8000)
    console.log(`[kakao] findAndActivate result: "${result}"`)
    if (result === 'ok') return 'ok'
    if (result === 'not_found') return 'not_found'
    return 'error'
  } catch (e) {
    console.error('[kakao] findAndActivate exception:', e)
    return 'error'
  }
}

/* ── 카카오톡 실행 여부 확인 ── */
export function isKakaoRunning(): boolean {
  if (!isWindows) return false
  try {
    console.log('[kakao] isKakaoRunning check...')
    const result = execSync(
      'tasklist /FI "IMAGENAME eq KakaoTalk.exe" /FO CSV /NH',
      { encoding: 'utf8', timeout: 3000, windowsHide: true },
    )
    const running = result.toLowerCase().includes('kakaotalk.exe')
    console.log(`[kakao] isKakaoRunning: ${running}`)
    return running
  } catch {
    return false
  }
}

/* ── 카카오톡 실행 ── */
const KAKAO_PATHS = [
  path.join(process.env.LOCALAPPDATA ?? '', 'Kakao', 'KakaoTalk', 'KakaoTalk.exe'),
  'C:\\Program Files\\Kakao\\KakaoTalk\\KakaoTalk.exe',
  'C:\\Program Files (x86)\\Kakao\\KakaoTalk\\KakaoTalk.exe',
]

export function launchKakao(): boolean {
  if (!isWindows) return false
  const execPath = KAKAO_PATHS.find((p) => fs.existsSync(p))
  console.log(`[kakao] launchKakao: ${execPath ?? 'not found'}`)
  if (!execPath) return false
  spawn(execPath, [], { detached: true, stdio: 'ignore' }).unref()
  return true
}

/* ── 디버그: KakaoTalk 관련 창 목록 ── */
export function listKakaoWindows(): string[] {
  if (!isWindows) return []
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
public class WinList {
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc e, IntPtr p);
    private delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    public static string[] List() {
        var results = new List<string>();
        EnumWindows((h, p) => {
            if (!IsWindowVisible(h)) return true;
            var sb = new StringBuilder(512);
            int len = GetWindowText(h, sb, sb.Capacity);
            if (len == 0) return true;
            string title = sb.ToString();
            uint pid = 0;
            GetWindowThreadProcessId(h, out pid);
            bool isKakao = false;
            try {
                var proc = Process.GetProcessById((int)pid);
                isKakao = proc.ProcessName.IndexOf("KakaoTalk", StringComparison.OrdinalIgnoreCase) >= 0;
            } catch {}
            bool titleMatch = title.IndexOf("kakao", StringComparison.OrdinalIgnoreCase) >= 0;
            if (isKakao || titleMatch) results.Add(title);
            return true;
        }, IntPtr.Zero);
        return results.ToArray();
    }
}
"@
[WinList]::List() | ForEach-Object { $_ }
`
  try {
    const output = psText(script, 10000)
    return output ? output.split('\n').map((l) => l.trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

/* ── 카카오톡 메인 창 검색 자동화 ── */
// findAndActivate 결과가 not_found일 때 호출.
// 메인 창(EVA_Window_Dblclk)을 활성화 후 UI Automation으로 검색창에 텍스트 입력,
// 첫 번째 결과를 클릭해 채팅방을 연다.
function searchAndOpenChat(chatName: string): 'ok' | 'not_found' | 'error' {
  const escaped = chatName.replace(/'/g, "''")

  // SendKeys 특수문자 이스케이프 (+^%~(){}[] → 중괄호로 감싸기)
  const sendKeysEscaped = chatName
    .replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`)
    .replace(/'/g, "''")

  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;
public class KakaoSearch {
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc e, IntPtr p);
    private delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    private static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr h);

    // 메인 창: 클래스 EVA_Window_Dblclk, 제목 짧음(카카오톡)
    public static IntPtr FindMainWindow() {
        IntPtr result = IntPtr.Zero;
        EnumWindows((h, p) => {
            if (!IsWindowVisible(h)) return true;
            var cls = new StringBuilder(256);
            GetClassName(h, cls, cls.Capacity);
            if (cls.ToString() != "EVA_Window_Dblclk") return true;
            var sb = new StringBuilder(512);
            GetWindowText(h, sb, sb.Capacity);
            string title = sb.ToString();
            // 채팅방 창은 제목이 채팅 상대 이름 → 메인은 짧은 제목
            if (title.Length > 0 && title.Length <= 20) {
                result = h;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return result;
    }

    public static string Search(string chatName) {
        IntPtr hwnd = FindMainWindow();
        if (hwnd == IntPtr.Zero) return "no_main_window";

        ShowWindow(hwnd, 9);
        SetForegroundWindow(hwnd);
        Thread.Sleep(600);

        // UI Automation으로 검색 Edit 컨트롤 찾기
        AutomationElement mainElem = AutomationElement.FromHandle(hwnd);
        if (mainElem == null) return "automation_failed";

        var editCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit);
        AutomationElement searchBox = mainElem.FindFirst(TreeScope.Descendants, editCond);

        if (searchBox != null) {
            searchBox.SetFocus();
            Thread.Sleep(200);
            // ValuePattern으로 텍스트 설정
            object vpObj;
            if (searchBox.TryGetCurrentPattern(ValuePattern.Pattern, out vpObj)) {
                ((ValuePattern)vpObj).SetValue(chatName);
            }
        } else {
            // Fallback: 검색 단축키 후 SendKeys
            return "no_search_box";
        }

        Thread.Sleep(800);

        // 첫 번째 검색 결과 ListItem 찾아서 클릭
        var listCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem);
        AutomationElementCollection items = mainElem.FindAll(TreeScope.Descendants, listCond);

        foreach (AutomationElement item in items) {
            string name = item.Current.Name;
            if (name.Contains(chatName)) {
                object ipObj;
                if (item.TryGetCurrentPattern(InvokePattern.Pattern, out ipObj)) {
                    ((InvokePattern)ipObj).Invoke();
                    return "ok";
                }
                // Fallback: 클릭
                System.Windows.Point pt = item.GetClickablePoint();
                SetForegroundWindow(hwnd);
                Thread.Sleep(100);
                return "click_needed:" + (long)pt.X + "," + (long)pt.Y;
            }
        }
        return "not_found";
    }
}
"@

$result = [KakaoSearch]::Search('${escaped}')
Write-Output $result

# click_needed:x,y 반환 시 마우스 클릭
if ($result -like "click_needed:*") {
    $coords = $result.Replace("click_needed:", "").Split(",")
    $x = [int]$coords[0]; $y = [int]$coords[1]
    Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class Mouse2 {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int c, int e);
}
"@
    [Mouse2]::SetCursorPos($x, $y)
    Start-Sleep -Milliseconds 100
    [Mouse2]::mouse_event(0x0002, 0, 0, 0, 0)
    [Mouse2]::mouse_event(0x0004, 0, 0, 0, 0)
    Write-Output "ok"
}
`
  try {
    console.log(`[kakao] searchAndOpenChat start: "${chatName}"`)
    const raw = psText(script, 12000)
    // 마지막 줄이 실제 결과
    const result = raw.split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? ''
    console.log(`[kakao] searchAndOpenChat result: "${result}"`)
    if (result === 'ok') return 'ok'
    if (result === 'not_found') return 'not_found'
    return 'error'
  } catch (e) {
    console.error('[kakao] searchAndOpenChat exception:', e)
    return 'error'
  }
}

/* ── 채팅방 열기 (메인 진입점) ── */
export async function openKakaoChat(
  chatName: string,
): Promise<{ success: boolean; message: string }> {
  if (!isWindows) {
    return { success: false, message: 'Windows에서만 지원됩니다.' }
  }

  console.log(`[kakao] openKakaoChat: "${chatName}"`)

  if (!isKakaoRunning()) {
    console.log('[kakao] KakaoTalk not running, launching...')
    const launched = launchKakao()
    if (!launched) {
      return { success: false, message: '카카오톡을 찾을 수 없습니다. 설치 경로를 확인하세요.' }
    }
    console.log('[kakao] waiting for KakaoTalk to start...')
    await new Promise<void>((resolve) => setTimeout(resolve, 3500))
  }

  console.log('[kakao] calling findAndActivate...')
  const result = findAndActivateWindow(chatName)

  if (result === 'ok') {
    return { success: true, message: '채팅방을 열었습니다.' }
  }

  if (result === 'not_found') {
    // 채팅방 창이 열려있지 않음 → 메인 창에서 검색 시도
    console.log('[kakao] not_found → trying searchAndOpenChat...')
    const searchResult = searchAndOpenChat(chatName)
    if (searchResult === 'ok') {
      return { success: true, message: '채팅방을 검색해서 열었습니다.' }
    }
    return {
      success: false,
      message: `'${chatName}' 채팅방을 찾을 수 없습니다.\n카카오톡에서 해당 채팅방이 존재하는지 확인하세요.`,
    }
  }

  return { success: false, message: '창 활성화 중 오류가 발생했습니다.' }
}
