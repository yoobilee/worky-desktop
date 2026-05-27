import { useState, useEffect, useRef, useCallback } from 'react'
import {
  IconBuilding, IconSearch,
  IconLoader2, IconCalendar,
  IconMessageCircle, IconPencil, IconCheck, IconX,
  IconCopy, IconChevronDown, IconLogout, IconSettings, IconUser,
  IconRefresh, IconPhone, IconArrowsSort,
} from '@tabler/icons-react'
import type { Client, ReportStatus, SortOrder } from '../types'
import { fetchClients, updateKakaoChat, updateReportTemplate } from '../lib/clients'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useDark } from '../hooks/useDark'

/* ── 테마 색상 팔레트 ── */
function palette(dark: boolean) {
  return {
    bg:           dark ? '#080810'                    : '#efefff',
    card:         dark ? 'rgba(255,255,255,0.05)'     : 'rgba(255,255,255,0.40)',
    cardHover:    dark ? 'rgba(255,255,255,0.09)'     : 'rgba(255,255,255,0.85)',
    border:       dark ? 'rgba(255,255,255,0.10)'     : 'rgba(108,99,255,0.15)',
    borderHover:  dark ? 'rgba(108,99,255,0.40)'      : 'rgba(108,99,255,0.45)',
    textPrimary:  dark ? '#ffffff'                    : '#1a1a2e',
    textSub:      dark ? '#a0a0c0'                    : '#4a4a6a',
    textMuted:    dark ? 'rgba(160,160,200,0.85)'      : 'rgba(74,74,106,0.80)',
    inputBg:      dark ? 'rgba(255,255,255,0.05)'     : 'rgba(108,99,255,0.06)',
    inputBorder:  dark ? 'rgba(255,255,255,0.09)'     : 'rgba(108,99,255,0.20)',
    popupBg:      dark ? '#111118'                    : '#ffffff',
    popupBorder:  dark ? 'rgba(255,255,255,0.10)'     : 'rgba(108,99,255,0.18)',
    divider:      dark ? 'rgba(255,255,255,0.06)'     : 'rgba(108,99,255,0.10)',
    tagBg:        dark ? 'rgba(108,99,255,0.13)'      : 'rgba(108,99,255,0.10)',
    tagText:      dark ? 'rgba(155,143,255,0.85)'     : '#6C63FF',
    accentBg:     dark ? 'rgba(108,99,255,0.15)'      : 'rgba(108,99,255,0.12)',
    accentText:   '#9B8FFF',
  }
}

/* ── 상태 팔레트 ── */
const STATUS_CONFIG: Record<ReportStatus, {
  label: string
  line: string
  dot: string
  badgeDark: string
  badgeLight: string
}> = {
  inprogress: {
    label: '진행 중',
    line: '#6C63FF',
    dot: 'bg-[#6C63FF]',
    badgeDark:  'color:#9B8FFF;background:rgba(108,99,255,0.15);border-color:rgba(108,99,255,0.25)',
    badgeLight: 'color:#5c54d4;background:rgba(108,99,255,0.10);border-color:rgba(108,99,255,0.30)',
  },
  pending: {
    label: '대기 중',
    line: '#6b6b8a',
    dot: 'bg-[#6b6b8a]',
    badgeDark:  'color:#8888aa;background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.10)',
    badgeLight: 'color:#4a4a6a;background:rgba(74,74,106,0.08);border-color:rgba(74,74,106,0.20)',
  },
  complete: {
    label: '완료',
    line: '#22c55e',
    dot: 'bg-[#22c55e]',
    badgeDark:  'color:#4ade80;background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.25)',
    badgeLight: 'color:#16a34a;background:rgba(34,197,94,0.10);border-color:rgba(34,197,94,0.30)',
  },
  stopped: {
    label: '중단',
    line: '#ef4444',
    dot: 'bg-[#ef4444]',
    badgeDark:  'color:#f87171;background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.25)',
    badgeLight: 'color:#dc2626;background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.25)',
  },
}

const STATUS_ORDER: ReportStatus[] = ['inprogress', 'pending', 'complete', 'stopped']

const SORT_LABELS: Record<SortOrder, string> = {
  inprogress: '진행 중 우선',
  pending:    '대기 중 우선',
  expiry:     '만료 임박순',
  name:       '거래처명순',
}
const SORT_CYCLE: SortOrder[] = ['inprogress', 'pending', 'expiry', 'name']

/* ── 헬퍼 ── */
function addBusinessDays(start: string, days: number): string {
  const d = new Date(start + 'T00:00:00')
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d.toISOString().slice(0, 10)
}

function getContractEnd(c: Client): string | null {
  if (!c.contractStart || !c.contractDays) return null
  return addBusinessDays(c.contractStart, c.contractDays)
}

function getDday(endDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(endDate + 'T00:00:00').getTime() - today.getTime()) / 86400000)
}

function formatDday(dday: number): { text: string; color: string } {
  if (dday < 0)   return { text: `D+${Math.abs(dday)}`, color: '#6b6b8a' }
  if (dday === 0) return { text: 'D-Day', color: '#ef4444' }
  if (dday <= 3)  return { text: `D-${dday}`, color: '#ef4444' }
  if (dday <= 7)  return { text: `D-${dday}`, color: '#f97316' }
  return { text: `D-${dday}`, color: '#6b6b8a' }
}

/* ── 토스트 훅 ── */
function useToast() {
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function show(ok: boolean, msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ ok, msg })
    timerRef.current = setTimeout(() => setToast(null), 2200)
  }
  return { toast, show }
}

/* ── 거래처 리스트 아이템 ── */
function ClientItem({
  client,
  dark,
  onKakaoChatSaved,
  onReportTemplateSaved,
}: {
  client: Client
  dark: boolean
  onKakaoChatSaved: (id: string, name: string) => void
  onReportTemplateSaved: (id: string, tpl: string) => void
}) {
  const p = palette(dark)
  const [expanded, setExpanded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [kakaoEditing, setKakaoEditing] = useState(false)
  const [kakaoVal, setKakaoVal] = useState(client.kakaoChat)
  const [kakaoLoading, setKakaoLoading] = useState(false)
  const kakaoInputRef = useRef<HTMLInputElement>(null)

  const [tplEditing, setTplEditing] = useState(false)
  const [tplVal, setTplVal] = useState(client.reportTemplate)
  const [copied, setCopied] = useState(false)
  const tplInputRef = useRef<HTMLTextAreaElement>(null)

  const { toast, show: showToast } = useToast()

  const cfg = STATUS_CONFIG[client.status]
  const contractEnd = getContractEnd(client)
  const dday = contractEnd ? getDday(contractEnd) : null
  const ddayFmt = dday != null ? formatDday(dday) : null


  async function handleKakaoOpen() {
    if (!client.kakaoChat) {
      setExpanded(true); setKakaoEditing(true)
      setTimeout(() => kakaoInputRef.current?.focus(), 80)
      return
    }
    setKakaoLoading(true)
    const result = await window.electronAPI.kakao.openChat(client.kakaoChat)
    setKakaoLoading(false)
    if (!result.success) showToast(false, result.message)
  }

  async function handleKakaoSave() {
    const name = kakaoVal.trim()
    await updateKakaoChat(client.id, name)
    onKakaoChatSaved(client.id, name)
    setKakaoEditing(false)
    if (name) showToast(true, `'${name}' 등록 완료`)
  }

  async function handleTplSave() {
    const tpl = tplVal.trim()
    await updateReportTemplate(client.id, tpl)
    onReportTemplateSaved(client.id, tpl)
    setTplEditing(false)
  }

  async function handleCopy() {
    const text = client.reportTemplate.trim()
    if (!text) {
      setExpanded(true); setTplEditing(true)
      setTimeout(() => tplInputRef.current?.focus(), 80)
      return
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    showToast(true, '복사 완료')
    setTimeout(() => setCopied(false), 2000)
  }

  const badgeStyle = (() => {
    const raw = dark ? cfg.badgeDark : cfg.badgeLight
    const obj: Record<string, string> = {}
    raw.split(';').forEach((part) => {
      const [k, v] = part.split(':')
      if (k && v) obj[k.trim()] = v.trim()
    })
    return obj as React.CSSProperties
  })()

  return (
    <div className="relative">
      {toast && (
        <div
          className="absolute -top-1 left-4 right-4 z-50 -translate-y-full px-3 py-1 rounded-lg text-[10px] font-medium text-center pointer-events-none shadow-lg"
          style={toast.ok
            ? { background: dark ? '#0d2018' : '#d1fae5', color: dark ? '#4ade80' : '#15803d', border: '1px solid rgba(34,197,94,0.3)' }
            : { background: dark ? '#1f0d0d' : '#fee2e2', color: dark ? '#f87171' : '#dc2626', border: '1px solid rgba(239,68,68,0.3)' }
          }
        >
          {toast.msg}
        </div>
      )}

      <div
        className="relative overflow-hidden rounded-2xl transition-all duration-200"
        style={{
          background: hovered ? p.cardHover : p.card,
          border: `1px solid ${hovered ? p.borderHover : p.border}`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* 왼쪽 상태 컬러 라인 — 3px, 카드 높이 전체 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[5px] rounded-l-2xl"
          style={{ background: cfg.line }}
        />

        {/* 메인 행 */}
        <div className="flex items-center gap-2 pl-4 pr-2 py-2.5">
          <button
            className="flex-1 min-w-0 text-left flex items-center gap-2"
            onClick={() => setExpanded((v) => !v)}
          >
            <span className="text-[14px] font-bold truncate leading-none" style={{ color: p.textPrimary }}>
              {client.name}
            </span>
            {ddayFmt && dday! <= 30 && (
              <span className="text-[11px] font-medium shrink-0" style={{ color: ddayFmt.color }}>{ddayFmt.text}</span>
            )}
          </button>

          {/* 상태 뱃지 */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border shrink-0" style={badgeStyle}>
            <div className={`w-1 h-1 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </div>

          {/* 액션 버튼 */}
          {kakaoEditing ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                ref={kakaoInputRef}
                value={kakaoVal}
                onChange={(e) => setKakaoVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleKakaoSave()
                  if (e.key === 'Escape') { setKakaoEditing(false); setKakaoVal(client.kakaoChat) }
                }}
                placeholder="채팅방 이름"
                className="w-20 px-2 py-0.5 rounded-lg text-[11px] focus:outline-none"
                style={{ background: p.accentBg, border: `1px solid rgba(108,99,255,0.3)`, color: p.textPrimary }}
              />
              <button onClick={handleKakaoSave} style={{ color: '#6C63FF' }}><IconCheck size={11} /></button>
              <button onClick={() => { setKakaoEditing(false); setKakaoVal(client.kakaoChat) }} style={{ color: p.textMuted }}><IconX size={11} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={handleKakaoOpen}
                disabled={kakaoLoading}
                title={client.kakaoChat ? `${client.kakaoChat} 열기` : '채팅방 등록'}
                className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors"
                style={{ color: client.kakaoChat ? '#6C63FF' : p.textMuted, background: client.kakaoChat ? 'rgba(108,99,255,0.12)' : 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(108,99,255,0.20)'; e.currentTarget.style.color = '#6C63FF' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = client.kakaoChat ? 'rgba(108,99,255,0.12)' : 'transparent'; e.currentTarget.style.color = client.kakaoChat ? '#6C63FF' : p.textMuted }}
              >
                {kakaoLoading ? <IconLoader2 size={12} className="animate-spin" /> : <IconMessageCircle size={12} />}
              </button>
              <button
                onClick={handleCopy}
                title={client.reportTemplate ? '보고 메시지 복사' : '템플릿 등록'}
                className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors"
                style={{ color: copied ? '#22c55e' : p.textMuted, background: copied ? 'rgba(34,197,94,0.12)' : 'transparent' }}
                onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.background = p.inputBg; e.currentTarget.style.color = p.textSub } }}
                onMouseLeave={(e) => { if (!copied) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = p.textMuted } }}
              >
                {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors"
                style={{ color: p.textMuted }}
                onMouseEnter={(e) => { e.currentTarget.style.color = p.textSub }}
                onMouseLeave={(e) => { e.currentTarget.style.color = p.textMuted }}
              >
                <IconChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }} />
              </button>
            </div>
          )}
        </div>

        {/* 확장 패널 */}
        <div style={{ maxHeight: expanded ? '400px' : '0', opacity: expanded ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease' }}>
          <div className="pl-4 pr-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${p.divider}`, paddingTop: '10px' }}>
            {(client.contact || client.phone) && (
              <div className="flex items-center gap-3 text-[11px]" style={{ color: p.textSub }}>
                {client.contact && <span className="flex items-center gap-1"><IconUser size={10} className="shrink-0" />{client.contact}</span>}
                {client.phone && <span className="flex items-center gap-1"><IconPhone size={10} className="shrink-0" />{client.phone}</span>}
              </div>
            )}
            {contractEnd && ddayFmt && (
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: p.textSub }}>
                <IconCalendar size={10} className="shrink-0" />
                <span>{contractEnd}</span>
                <span className="ml-auto text-[10px] font-semibold" style={{ color: ddayFmt.color }}>{ddayFmt.text}</span>
              </div>
            )}
            {client.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {client.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: p.tagBg, color: p.tagText }}>{t}</span>
                ))}
              </div>
            )}
            {client.memo && <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: p.textSub }}>{client.memo}</p>}
            {client.kakaoChat && (
              <div className="flex items-center gap-1.5 text-[11px]" style={{ color: p.textSub }}>
                <IconMessageCircle size={10} style={{ color: '#6C63FF', flexShrink: 0 }} />
                <span className="truncate" style={{ color: '#9B8FFF' }}>{client.kakaoChat}</span>
                <button onClick={() => { setKakaoEditing(true); setTimeout(() => kakaoInputRef.current?.focus(), 50) }} className="ml-auto" style={{ color: p.textMuted }}>
                  <IconPencil size={10} />
                </button>
              </div>
            )}
            {/* 보고 템플릿 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: p.textMuted }}>보고 템플릿</span>
                <div className="flex items-center gap-1.5">
                  {tplEditing ? (
                    <>
                      <button onClick={handleTplSave} className="text-[10px] flex items-center gap-0.5" style={{ color: '#22c55e' }}><IconCheck size={10} />저장</button>
                      <button onClick={() => { setTplEditing(false); setTplVal(client.reportTemplate) }} className="text-[10px]" style={{ color: p.textMuted }}>취소</button>
                    </>
                  ) : (
                    <button onClick={() => { setTplEditing(true); setTimeout(() => tplInputRef.current?.focus(), 50) }} style={{ color: p.textMuted }}>
                      <IconPencil size={10} />
                    </button>
                  )}
                </div>
              </div>
              {tplEditing ? (
                <textarea
                  ref={tplInputRef}
                  value={tplVal}
                  onChange={(e) => setTplVal(e.target.value)}
                  rows={3}
                  placeholder="복사할 보고 메시지 입력..."
                  className="w-full px-2.5 py-2 rounded-lg text-[11px] focus:outline-none resize-none leading-relaxed"
                  style={{ background: p.inputBg, border: `1px solid ${p.inputBorder}`, color: p.textPrimary }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(108,99,255,0.45)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = p.inputBorder }}
                />
              ) : client.reportTemplate ? (
                <p className="text-[11px] leading-relaxed line-clamp-3 whitespace-pre-wrap" style={{ color: p.textSub }}>{client.reportTemplate}</p>
              ) : (
                <p className="text-[11px]" style={{ color: p.textMuted }}>등록된 템플릿 없음</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function ClientsPage({ user }: { user: User }) {
  const dark = useDark()
  const p = palette(dark)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('inprogress')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [themeSource, setThemeSource] = useState<'light' | 'dark' | 'system'>('dark')
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadClients()
    window.electronAPI.theme.get().then(({ source }) => setThemeSource(source))
  }, [user.id])

  useEffect(() => {
    if (!settingsOpen) return
    const h = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setSettingsOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [settingsOpen])

  async function loadClients() {
    setLoading(true)
    const data = await fetchClients(user.id)
    setClients(data)
    setLoading(false)
  }

  async function handleThemeChange(t: 'light' | 'dark' | 'system') {
    setThemeSource(t)
    await window.electronAPI.theme.set(t)
    setSettingsOpen(false)
  }

  const handleKakaoChatSaved = useCallback((id: string, name: string) => {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, kakaoChat: name } : c))
  }, [])

  const handleReportTemplateSaved = useCallback((id: string, tpl: string) => {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, reportTemplate: tpl } : c))
  }, [])

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase()),
  )

  const sorted = [...filtered].sort((a, b) => {
    const order: Record<ReportStatus, number> =
      sortOrder === 'pending'
        ? { pending: 0, inprogress: 1, stopped: 2, complete: 3 }
        : { inprogress: 0, pending: 1, stopped: 2, complete: 3 }
    if (sortOrder === 'inprogress' || sortOrder === 'pending') {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    }
    if (sortOrder === 'expiry') {
      const ea = getContractEnd(a), eb = getContractEnd(b)
      if (!ea && !eb) return a.name.localeCompare(b.name, 'ko')
      if (!ea) return 1; if (!eb) return -1
      if (ea !== eb) return ea.localeCompare(eb)
    }
    return a.name.localeCompare(b.name, 'ko')
  })

  const total = clients.length
  const cInprogress = clients.filter((c) => c.status === 'inprogress').length
  const cComplete   = clients.filter((c) => c.status === 'complete').length
  const cStopped    = clients.filter((c) => c.status === 'stopped').length

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'transparent' }}>
      {/* 헤더 */}
      <div className="px-3 pt-2.5 pb-2 shrink-0 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <IconSearch size={11} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: p.textMuted }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="거래처 검색"
              className="w-full pl-7 pr-3 py-1.5 rounded-full text-[12px] focus:outline-none transition-colors"
              style={{ background: p.inputBg, border: `1px solid ${p.inputBorder}`, color: p.textPrimary }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(108,99,255,0.45)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = p.inputBorder }}
            />
          </div>
          <button
            onClick={() => setSortOrder((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length])}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-colors whitespace-nowrap"
            style={{ background: p.inputBg, border: `1px solid ${p.inputBorder}`, color: p.textSub }}
          >
            <IconArrowsSort size={10} />
            {SORT_LABELS[sortOrder]}
          </button>
          <button onClick={loadClients} className="flex items-center justify-center w-7 h-7 rounded-full transition-colors" style={{ color: p.textMuted }}>
            <IconRefresh size={12} />
          </button>
        </div>

        {/* 프로그레스 바 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[2px] rounded-full overflow-hidden flex" style={{ background: p.divider }}>
            {total > 0 && (
              <>
                <div style={{ width: `${(cInprogress / total) * 100}%`, background: '#6C63FF', transition: 'width 0.4s ease' }} />
                <div style={{ width: `${(cComplete / total) * 100}%`, background: '#22c55e', transition: 'width 0.4s ease' }} />
                <div style={{ width: `${(cStopped / total) * 100}%`, background: '#ef4444', transition: 'width 0.4s ease' }} />
              </>
            )}
          </div>
          <span className="text-[10px] shrink-0 tabular-nums" style={{ color: p.textMuted }}>{total}개</span>
        </div>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <IconLoader2 size={18} className="animate-spin" style={{ color: 'rgba(108,99,255,0.5)' }} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: p.textMuted }}>
            <IconBuilding size={28} className="mb-2" />
            <p className="text-[12px]">{search ? '검색 결과 없음' : '등록된 거래처 없음'}</p>
          </div>
        ) : (
          sorted.map((c) => (
            <ClientItem
              key={c.id}
              client={c}
              dark={dark}
              onKakaoChatSaved={handleKakaoChatSaved}
              onReportTemplateSaved={handleReportTemplateSaved}
            />
          ))
        )}
      </div>

      {/* 푸터 */}
      <div className="shrink-0 px-3 py-2 flex items-center gap-2 relative" style={{ borderTop: `1px solid ${p.divider}` }}>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold"
          style={{ background: 'rgba(108,99,255,0.2)', color: '#9B8FFF' }}
        >
          {(user.email ?? '?')[0].toUpperCase()}
        </div>
        <span className="flex-1 text-[11px] truncate" style={{ color: p.textMuted }}>{user.email}</span>

        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex items-center justify-center w-6 h-6 rounded-lg transition-colors"
            style={{ color: p.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.background = p.inputBg }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <IconSettings size={12} />
          </button>

          {settingsOpen && (
            <div
              className="absolute bottom-full right-0 mb-1 rounded-xl shadow-2xl overflow-hidden min-w-[156px] z-50"
              style={{ background: p.popupBg, border: `1px solid ${p.popupBorder}` }}
            >
              <div className="px-3 py-2" style={{ borderBottom: `1px solid ${p.divider}` }}>
                <p className="text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: p.textMuted }}>테마</p>
                <div className="flex gap-1">
                  {(['dark', 'light', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      className="flex-1 py-1 rounded-lg text-[10px] font-semibold transition-colors"
                      style={themeSource === t
                        ? { background: 'rgba(108,99,255,0.25)', color: '#9B8FFF' }
                        : { color: p.textSub }
                      }
                    >
                      {t === 'dark' ? '다크' : t === 'light' ? '라이트' : '시스템'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="flex items-center gap-2 w-full px-3 py-2.5 text-[11px] transition-colors"
                style={{ color: '#ef4444' }}
                onClick={() => supabase.auth.signOut()}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <IconLogout size={12} />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
