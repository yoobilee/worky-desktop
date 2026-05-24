import { execSync, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const isWindows = process.platform === 'win32'
const SW_RESTORE = 9

/* ── ffi-rs 초기화 ──────────────────────────────── */
let libReady = false

function ensureLib(): boolean {
  if (!isWindows) return false
  if (libReady) return true
  try {
    const { open } = require('ffi-rs') as typeof import('ffi-rs')
    open({ library: 'user32', path: 'user32.dll' })
    libReady = true
    return true
  } catch {
    return false
  }
}

/* ── Windows API 래퍼 ──────────────────────────── */

function showWindow(hwnd: bigint): void {
  const { load, DataType } = require('ffi-rs') as typeof import('ffi-rs')
  load({
    library: 'user32',
    funcName: 'ShowWindow',
    retType: DataType.Boolean,
    paramsType: [DataType.I64, DataType.I32],
    paramsValue: [hwnd, SW_RESTORE],
  })
}

function setForegroundWindow(hwnd: bigint): void {
  const { load, DataType } = require('ffi-rs') as typeof import('ffi-rs')
  load({
    library: 'user32',
    funcName: 'SetForegroundWindow',
    retType: DataType.Boolean,
    paramsType: [DataType.I64],
    paramsValue: [hwnd],
  })
}

/* ── PowerShell로 창 제목 검색 ──────────────────── */
const PS_ENUM_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinEnum {
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc e, IntPtr p);
    private delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr h);
    public static long FindByTitle(string title) {
        long found = 0;
        EnumWindows((h, p) => {
            if (!IsWindowVisible(h)) return true;
            var sb = new StringBuilder(512);
            GetWindowText(h, sb, sb.Capacity);
            if (sb.ToString() == title) { found = h.ToInt64(); return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@
`

function runPS(script: string): string {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
    encoding: 'utf8',
    timeout: 8000,
    windowsHide: true,
  }).trim()
}

function findWindowByTitle(title: string): bigint | null {
  const escaped = title.replace(/'/g, "''")
  const script = `${PS_ENUM_SCRIPT}\n[WinEnum]::FindByTitle('${escaped}')`
  try {
    const result = runPS(script)
    const val = parseInt(result, 10)
    return isNaN(val) || val === 0 ? null : BigInt(val)
  } catch {
    return null
  }
}

/* ── 카카오톡 상태 확인 ──────────────────────────── */
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

/* ── 카카오톡 실행 ────────────────────────────────── */
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

/* ── 채팅방 열기 ─────────────────────────────────── */
export async function openKakaoChat(
  chatName: string,
): Promise<{ success: boolean; message: string }> {
  if (!isWindows) {
    return { success: false, message: 'Windows에서만 지원됩니다.' }
  }
  if (!ensureLib()) {
    return { success: false, message: 'ffi-rs 초기화 실패.' }
  }

  if (!isKakaoRunning()) {
    const launched = launchKakao()
    if (!launched) {
      return {
        success: false,
        message: '카카오톡을 찾을 수 없습니다. 설치 경로를 확인하세요.',
      }
    }
    // 카카오톡 로딩 대기
    await new Promise<void>((resolve) => setTimeout(resolve, 3500))
  }

  const hwnd = findWindowByTitle(chatName)
  if (!hwnd) {
    return {
      success: false,
      message: `'${chatName}' 채팅방을 찾을 수 없습니다.\n카카오톡에서 채팅방을 한 번 열어두면 목록에 표시됩니다.`,
    }
  }

  showWindow(hwnd)
  setForegroundWindow(hwnd)
  return { success: true, message: '채팅방을 열었습니다.' }
}
