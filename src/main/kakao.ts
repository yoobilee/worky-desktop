import { spawn, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { execSync } from 'child_process'

const isWindows = process.platform === 'win32'

/* ── PS1 파일로 실행 ── */
function runPSTempFile(scriptBody: string, timeout = 15000): string {
  const ps1Path = path.join(os.tmpdir(), `worky_kakao_${Date.now()}.ps1`)
  try {
    fs.writeFileSync(ps1Path, '﻿' + scriptBody, { encoding: 'utf8' })
    const proc = spawnSync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1Path],
      { encoding: 'buffer', timeout, windowsHide: true },
    )
    const raw = proc.stdout?.toString('utf8').trim() ?? ''
    return raw.split('\n').map((l) => l.trim()).filter(Boolean).pop() ?? ''
  } finally {
    try { fs.unlinkSync(ps1Path) } catch { /* ignore */ }
  }
}

/* ── 한글 → PowerShell [char]0xXXXX 변환 ── */
function toPSUnicode(str: string): string {
  return [...str].map((c) => {
    const code = c.charCodeAt(0)
    return code > 127 ? `[char]0x${code.toString(16)}` : c
  }).join('+')
}

/* ── 채팅방: 찾기 + 활성화 ── */
function findAndActivateWindow(chatName: string): 'ok' | 'not_found' | 'error' {
  const escaped = toPSUnicode(chatName)
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$chatName = ${escaped}
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
[WinActivate]::FindAndActivate($chatName)
`.trimStart()

  try {
    const result = runPSTempFile(script, 8000)
    if (result === 'ok') return 'ok'
    if (result === 'not_found') return 'not_found'
    return 'error'
  } catch {
    return 'error'
  }
}

/* ── 카카오톡 실행 여부 확인 ── */
export function isKakaoRunning(): boolean {
  if (!isWindows) return false
  try {
    const result = execSync(
      'tasklist /FI "IMAGENAME eq KakaoTalk.exe" /FO CSV /NH',
      { encoding: 'utf8', timeout: 3000, windowsHide: true },
    )
    return result.toLowerCase().includes('kakaotalk.exe')
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
`.trimStart()

  try {
    const ps1Path = path.join(os.tmpdir(), `worky_kakao_list_${Date.now()}.ps1`)
    fs.writeFileSync(ps1Path, '﻿' + script, { encoding: 'utf8' })
    const proc = spawnSync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ps1Path],
      { encoding: 'buffer', timeout: 10000, windowsHide: true },
    )
    try { fs.unlinkSync(ps1Path) } catch { /* ignore */ }
    const output = proc.stdout?.toString('utf8').trim() ?? ''
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

  if (!isKakaoRunning()) {
    const launched = launchKakao()
    if (!launched) {
      return { success: false, message: '카카오톡을 찾을 수 없습니다. 설치 경로를 확인하세요.' }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 3500))
  }

  const result = findAndActivateWindow(chatName)

  if (result === 'ok') {
    return { success: true, message: '채팅방을 열었습니다.' }
  }

  if (result === 'not_found') {
    return {
      success: false,
      message: `'${chatName}' 채팅방을 찾을 수 없습니다.\n카카오톡에서 해당 채팅방이 존재하는지 확인하세요.`,
    }
  }

  return { success: false, message: '창 활성화 중 오류가 발생했습니다.' }
}
