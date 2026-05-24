import { execSync, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const isWindows = process.platform === 'win32'
const SW_RESTORE = 9

// KakaoTalk 채팅방 창 클래스명 후보 (우선순위 순)
const KAKAO_CHAT_CLASSES = ['EVA_ChildWindow', 'EVA_Window', 'EVA_Window_Dblclk']

/* ── ffi-rs 초기화 ── */
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

/* ── Windows API 래퍼 ── */

// FindWindowW(lpClassName, lpWindowName) → HWND
// 클래스명 null: 첫 번째 파라미터를 I64(0)으로 전달
function findWindowByClass(className: string, windowTitle: string): bigint {
  const { load, DataType } = require('ffi-rs') as typeof import('ffi-rs')
  return load({
    library: 'user32',
    funcName: 'FindWindowW',
    retType: DataType.I64,
    paramsType: [DataType.WString, DataType.WString],
    paramsValue: [className, windowTitle],
  }) as bigint
}

function findWindowByTitleOnly(windowTitle: string): bigint {
  // 클래스명 없이 제목만으로 검색: lpClassName = NULL (0)
  const { load, DataType } = require('ffi-rs') as typeof import('ffi-rs')
  return load({
    library: 'user32',
    funcName: 'FindWindowW',
    retType: DataType.I64,
    paramsType: [DataType.I64, DataType.WString],
    paramsValue: [BigInt(0), windowTitle],
  }) as bigint
}

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

/* ── 채팅방 창 핸들 찾기 ── */
function findChatWindow(chatName: string): bigint | null {
  // 1단계: 알려진 클래스명으로 직접 찾기 (빠름)
  for (const cls of KAKAO_CHAT_CLASSES) {
    try {
      const hwnd = findWindowByClass(cls, chatName)
      if (hwnd !== BigInt(0)) return hwnd
    } catch {
      // 해당 클래스 실패 시 다음 시도
    }
  }

  // 2단계: 클래스명 없이 제목만으로 찾기
  try {
    const hwnd = findWindowByTitleOnly(chatName)
    if (hwnd !== BigInt(0)) return hwnd
  } catch {
    // ignore
  }

  return null
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

  // stdout을 UTF-8로 고정 후 C# EnumWindows로 창 목록 수집
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
`.trim()

  try {
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    // stdout을 buffer로 받아서 utf8로 디코딩 (CP949 우회)
    const raw = execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
      encoding: 'buffer',
      timeout: 10000,
      windowsHide: true,
    })
    const output = raw.toString('utf8').trim()
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
  if (!ensureLib()) {
    return { success: false, message: 'Windows API 초기화 실패. 앱을 재시작해 주세요.' }
  }

  if (!isKakaoRunning()) {
    const launched = launchKakao()
    if (!launched) {
      return { success: false, message: '카카오톡을 찾을 수 없습니다. 설치 경로를 확인하세요.' }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 3500))
  }

  // 5초 타임아웃으로 창 찾기
  const hwnd = await Promise.race<bigint | null>([
    Promise.resolve(findChatWindow(chatName)),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ])

  if (!hwnd) {
    return {
      success: false,
      message: `'${chatName}' 채팅방을 찾을 수 없습니다.\n카카오톡에서 채팅방을 열어둔 상태여야 합니다.`,
    }
  }

  showWindow(hwnd)
  setForegroundWindow(hwnd)
  return { success: true, message: '채팅방을 열었습니다.' }
}
