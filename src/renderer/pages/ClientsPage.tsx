import { useState, useEffect, useRef, useCallback } from 'react'
import {
  IconBuilding, IconSearch, IconArrowsSort,
  IconLoader2, IconCircleCheck, IconCircleX, IconClock, IconPlayerPlay,
  IconCalendar, IconMessageCircle, IconPencil, IconCheck, IconX,
  IconCopy, IconChevronDown, IconLogout, IconSettings, IconUser,
  IconRefresh, IconPhone,
} from '@tabler/icons-react'
import type { Client, ReportStatus, SortOrder } from '../types'
import { fetchClients, updateClientStatus, updateKakaoChat, updateReportTemplate } from '../lib/clients'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/* ── 상태 설정 ── */
const STATUS_CONFIG: Record<ReportStatus, {
  label: string
  dot: string
  badge: string
}> = {
  pending:    { label: '대기 중', dot: 'bg-slate-500',   badge: 'text-slate-400 bg-slate-800/80 border-slate-700' },
  inprogress: { label: '진행 중', dot: 'bg-blue-500',    badge: 'text-blue-400 bg-blue-950/60 border-blue-800/60' },
  complete:   { label: '완료',   dot: 'bg-emerald-500', badge: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' },
  stopped:    { label: '중단',   dot: 'bg-red-500',     badge: 'text-red-400 bg-red-950/60 border-red-800/60' },
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
  const end = new Date(endDate + 'T00:00:00')
  return Math.ceil((end.getTime() - today.getTime()) / 86400000)
}

function formatDday(dday: number): { text: string; cls: string } {
  if (dday < 0)  return { text: `D+${Math.abs(dday)}`, cls: 'text-slate-600' }
  if (dday === 0) return { text: 'D-Day', cls: 'text-red-400 font-bold' }
  if (dday <= 3)  return { text: `D-${dday}`, cls: 'text-red-400 font-semibold' }
  if (dday <= 7)  return { text: `D-${dday}`, cls: 'text-orange-400' }
  return { text: `D-${dday}`, cls: 'text-slate-500' }
}

/* ── 토스트 훅 ── */
function useToast() {
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function show(ok: boolean, msg: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ ok, msg })
    timerRef.current = setTimeout(() => setToast(null), 2500)
  }

  return { toast, show }
}

/* ── 거래처 리스트 아이템 ── */
function ClientItem({
  client,
  onStatusChange,
  onKakaoChatSaved,
  onReportTemplateSaved,
}: {
  client: Client
  onStatusChange: (id: string, status: ReportStatus) => void
  onKakaoChatSaved: (id: string, name: string) => void
  onReportTemplateSaved: (id: string, tpl: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  /* 카카오 상태 */
  const [kakaoEditing, setKakaoEditing] = useState(false)
  const [kakaoVal, setKakaoVal] = useState(client.kakaoChat)
  const [kakaoLoading, setKakaoLoading] = useState(false)
  const kakaoInputRef = useRef<HTMLInputElement>(null)

  /* 보고 템플릿 상태 */
  const [tplEditing, setTplEditing] = useState(false)
  const [tplVal, setTplVal] = useState(client.reportTemplate)
  const [copied, setCopied] = useState(false)
  const tplInputRef = useRef<HTMLTextAreaElement>(null)

  const { toast, show: showToast } = useToast()

  const cfg = STATUS_CONFIG[client.status]
  const contractEnd = getContractEnd(client)
  const dday = contractEnd ? getDday(contractEnd) : null
  const ddayFmt = dday != null ? formatDday(dday) : null

  /* 상태 드롭다운 외부 클릭 닫기 */
  useEffect(() => {
    if (!statusOpen) return
    const h = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node))
        setStatusOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [statusOpen])

  async function handleKakaoOpen() {
    if (!client.kakaoChat) {
      setKakaoEditing(true)
      setTimeout(() => kakaoInputRef.current?.focus(), 50)
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
      setTplEditing(true)
      setTimeout(() => tplInputRef.current?.focus(), 50)
      return
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    showToast(true, '클립보드에 복사됐습니다')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      {/* 토스트 */}
      {toast && (
        <div
          className={[
            'absolute top-0 left-0 right-0 z-50 mx-2 -translate-y-full -mt-1 px-3 py-1.5 rounded-lg text-xs font-medium text-center shadow-lg pointer-events-none',
            toast.ok
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
              : 'bg-red-950 text-red-300 border border-red-800/60',
          ].join(' ')}
        >
          {toast.msg}
        </div>
      )}

      <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden hover:border-white/[0.12] transition-colors">
        {/* 메인 행 */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* 상태 점 + 이름 */}
          <button
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            <span className="text-[13px] font-semibold text-white/90 truncate">{client.name}</span>
            {ddayFmt && dday! <= 7 && (
              <span className={`text-[10px] font-bold shrink-0 ${ddayFmt.cls}`}>{ddayFmt.text}</span>
            )}
          </button>

          {/* 상태 뱃지 드롭다운 */}
          <div className="relative shrink-0" ref={statusRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setStatusOpen((v) => !v) }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badge} transition-colors`}
            >
              {cfg.label}
            </button>
            {statusOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1d24] rounded-xl border border-white/10 shadow-2xl overflow-hidden min-w-[100px]">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(client.id, s); setStatusOpen(false) }}
                    className={[
                      'flex items-center gap-2 w-full px-3 py-2 text-[11px] font-semibold transition-colors',
                      client.status === s
                        ? `${STATUS_CONFIG[s].badge} bg-white/5`
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5',
                    ].join(' ')}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[s].dot}`} />
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 카톡 버튼 */}
          {kakaoEditing ? (
            <div className="flex items-center gap-1 shrink-0">
              <input
                ref={kakaoInputRef}
                value={kakaoVal}
                onChange={(e) => setKakaoVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleKakaoSave(); if (e.key === 'Escape') { setKakaoEditing(false); setKakaoVal(client.kakaoChat) } }}
                placeholder="채팅방 이름"
                className="w-24 px-2 py-0.5 rounded-lg bg-white/5 border border-[#FAD709]/30 text-[11px] text-white/80 placeholder-white/20 focus:outline-none focus:border-[#FAD709]/60"
              />
              <button onClick={handleKakaoSave} className="p-0.5 text-[#FAD709]/70 hover:text-[#FAD709]"><IconCheck size={11} /></button>
              <button onClick={() => { setKakaoEditing(false); setKakaoVal(client.kakaoChat) }} className="p-0.5 text-white/30 hover:text-white/60"><IconX size={11} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleKakaoOpen}
                disabled={kakaoLoading}
                title={client.kakaoChat ? `${client.kakaoChat} 열기` : '채팅방 등록'}
                className={[
                  'flex items-center justify-center w-6 h-6 rounded-lg transition-colors',
                  client.kakaoChat
                    ? 'text-[#FAD709]/80 bg-[#FAD709]/10 hover:bg-[#FAD709]/20'
                    : 'text-white/20 bg-white/5 hover:bg-white/10',
                ].join(' ')}
              >
                {kakaoLoading ? <IconLoader2 size={12} className="animate-spin" /> : <IconMessageCircle size={12} />}
              </button>
              {/* 보고 복사 버튼 */}
              <button
                onClick={handleCopy}
                title={client.reportTemplate ? '보고 메시지 복사' : '보고 템플릿 등록'}
                className={[
                  'flex items-center justify-center w-6 h-6 rounded-lg transition-colors',
                  client.reportTemplate
                    ? copied
                      ? 'text-emerald-400 bg-emerald-500/15'
                      : 'text-white/50 bg-white/5 hover:bg-white/10 hover:text-white/80'
                    : 'text-white/20 bg-white/5 hover:bg-white/10',
                ].join(' ')}
              >
                {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
              </button>
              {/* 펼치기 */}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center justify-center w-6 h-6 rounded-lg text-white/20 hover:text-white/50 transition-colors"
              >
                <IconChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {/* 확장 패널 */}
        {expanded && (
          <div className="px-3 pb-3 border-t border-white/[0.05] pt-2.5 space-y-2">
            {/* 담당자 / 전화 */}
            {(client.contact || client.phone) && (
              <div className="flex items-center gap-3 text-[11px] text-white/40">
                {client.contact && (
                  <span className="flex items-center gap-1">
                    <IconUser size={10} className="shrink-0" />
                    {client.contact}
                  </span>
                )}
                {client.phone && (
                  <span className="flex items-center gap-1">
                    <IconPhone size={10} className="shrink-0" />
                    {client.phone}
                  </span>
                )}
              </div>
            )}

            {/* D-day + 날짜 */}
            {contractEnd && ddayFmt && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                <IconCalendar size={10} className="shrink-0" />
                <span>{contractEnd}</span>
                <span className={`ml-auto text-[10px] font-semibold ${ddayFmt.cls}`}>{ddayFmt.text}</span>
              </div>
            )}

            {/* 태그 */}
            {client.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {client.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6C63FF]/15 text-[#9B8FFF]/80">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* 메모 */}
            {client.memo && (
              <p className="text-[11px] text-white/30 leading-relaxed line-clamp-2">{client.memo}</p>
            )}

            {/* 카카오 채팅방 편집 (확장 시) */}
            {client.kakaoChat && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                <IconMessageCircle size={10} className="text-[#FAD709]/50 shrink-0" />
                <span className="text-[#FAD709]/50">{client.kakaoChat}</span>
                <button
                  onClick={() => { setKakaoEditing(true); setTimeout(() => kakaoInputRef.current?.focus(), 50) }}
                  className="ml-auto text-white/20 hover:text-white/50 transition-colors"
                >
                  <IconPencil size={10} />
                </button>
              </div>
            )}

            {/* 보고 메시지 템플릿 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/25 font-medium uppercase tracking-wider">보고 템플릿</span>
                <div className="flex items-center gap-1">
                  {tplEditing ? (
                    <>
                      <button onClick={handleTplSave} className="text-[10px] text-emerald-400/70 hover:text-emerald-400 transition-colors flex items-center gap-0.5"><IconCheck size={10} />저장</button>
                      <button onClick={() => { setTplEditing(false); setTplVal(client.reportTemplate) }} className="text-[10px] text-white/25 hover:text-white/50 transition-colors">취소</button>
                    </>
                  ) : (
                    <button onClick={() => { setTplEditing(true); setTimeout(() => tplInputRef.current?.focus(), 50) }} className="text-white/20 hover:text-white/50 transition-colors"><IconPencil size={10} /></button>
                  )}
                </div>
              </div>
              {tplEditing ? (
                <textarea
                  ref={tplInputRef}
                  value={tplVal}
                  onChange={(e) => setTplVal(e.target.value)}
                  rows={3}
                  placeholder="복사할 보고 메시지 템플릿 입력..."
                  className="w-full px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70 placeholder-white/20 focus:outline-none focus:border-[#6C63FF]/40 resize-none leading-relaxed"
                />
              ) : client.reportTemplate ? (
                <p className="text-[11px] text-white/40 leading-relaxed line-clamp-3 whitespace-pre-wrap">{client.reportTemplate}</p>
              ) : (
                <p className="text-[11px] text-white/20 italic">등록된 템플릿 없음</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 메인 페이지 ── */
export default function ClientsPage({ user }: { user: User }) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<SortOrder>('inprogress')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark')

  useEffect(() => {
    loadClients()
    window.electronAPI.theme.get().then(setTheme)
  }, [user.id])

  async function loadClients() {
    setLoading(true)
    const data = await fetchClients(user.id)
    setClients(data)
    setLoading(false)
  }

  async function handleThemeChange(t: 'light' | 'dark' | 'system') {
    setTheme(t)
    await window.electronAPI.theme.set(t)
    setSettingsOpen(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function handleStatusChange(id: string, newStatus: ReportStatus) {
    const today = new Date().toISOString().slice(0, 10)
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        const updated = { ...c, status: newStatus, statusHistory: [...c.statusHistory, { date: today, status: newStatus }] }
        updateClientStatus(id, newStatus, updated.statusHistory).catch(console.error)
        return updated
      }),
    )
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* 검색 + 정렬 + 통계 한 줄 */}
      <div className="px-3 pt-2.5 pb-2 shrink-0 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <IconSearch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="거래처 검색"
              className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-white/5 border border-white/[0.08] text-[12px] text-white/80 placeholder-white/20 focus:outline-none focus:border-[#6C63FF]/40 transition-colors"
            />
          </div>
          <button
            onClick={() => setSortOrder((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length])}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-white/40 border border-white/[0.08] hover:border-white/15 hover:text-white/60 transition-colors whitespace-nowrap"
          >
            <IconArrowsSort size={11} />
            {SORT_LABELS[sortOrder]}
          </button>
          <button onClick={loadClients} className="p-1.5 rounded-lg text-white/25 hover:text-white/55 hover:bg-white/5 transition-colors">
            <IconRefresh size={13} />
          </button>
        </div>

        {/* 통계 바 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden flex">
            {total > 0 && <>
              <div style={{ width: `${(cInprogress / total) * 100}%` }} className="bg-blue-500 transition-all" />
              <div style={{ width: `${(cComplete / total) * 100}%` }} className="bg-emerald-500 transition-all" />
              <div style={{ width: `${(cStopped / total) * 100}%` }} className="bg-red-400 transition-all" />
            </>}
          </div>
          <span className="text-[10px] text-white/25 shrink-0 tabular-nums">{total}개</span>
        </div>
      </div>

      {/* 리스트 */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <IconLoader2 size={20} className="text-white/20 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/20">
            <IconBuilding size={32} className="mb-2" />
            <p className="text-[12px]">{search ? '검색 결과 없음' : '등록된 거래처 없음'}</p>
          </div>
        ) : (
          sorted.map((c) => (
            <ClientItem
              key={c.id}
              client={c}
              onStatusChange={handleStatusChange}
              onKakaoChatSaved={handleKakaoChatSaved}
              onReportTemplateSaved={handleReportTemplateSaved}
            />
          ))
        )}
      </div>

      {/* 하단 푸터 — 사용자 + 설정 */}
      <div className="shrink-0 px-3 py-2 border-t border-white/[0.05] flex items-center gap-2 relative">
        <div className="w-6 h-6 rounded-full bg-[#6C63FF]/30 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-[#9B8FFF]">
            {(user.email ?? '?')[0].toUpperCase()}
          </span>
        </div>
        <span className="flex-1 text-[11px] text-white/30 truncate">{user.email}</span>

        {/* 설정 버튼 */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="p-1.5 rounded-lg text-white/25 hover:text-white/55 hover:bg-white/5 transition-colors"
          >
            <IconSettings size={13} />
          </button>

          {settingsOpen && (
            <div className="absolute bottom-full right-0 mb-1 bg-[#1a1d24] rounded-xl border border-white/10 shadow-2xl overflow-hidden min-w-[160px] z-50">
              <div className="px-3 py-2 border-b border-white/[0.06]">
                <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">테마</p>
                <div className="flex gap-1 mt-1.5">
                  {(['dark', 'light', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t)}
                      className={[
                        'flex-1 py-1 rounded-lg text-[10px] font-semibold transition-colors',
                        theme === t
                          ? 'bg-[#6C63FF]/30 text-[#9B8FFF]'
                          : 'text-white/30 hover:bg-white/5 hover:text-white/60',
                      ].join(' ')}
                    >
                      {t === 'dark' ? '다크' : t === 'light' ? '라이트' : '시스템'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-[12px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <IconLogout size={13} />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
