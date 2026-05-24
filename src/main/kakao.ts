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
    return {
      success: false,
      message: `'${chatName}' 채팅방을 찾을 수 없습니다.\n카카오톡에서 채팅방을 열어둔 상태여야 합니다.`,
    }
  }
  return { success: false, message: '창 활성화 중 오류가 발생했습니다.' }
}
