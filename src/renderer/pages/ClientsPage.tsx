import { useState, useEffect, useRef } from 'react'
import {
  IconBuilding, IconUser, IconPhone, IconSearch, IconArrowsSort,
  IconLoader2, IconCircleCheck, IconCircleX, IconClock, IconPlayerPlay,
  IconCalendar, IconRefresh,
} from '@tabler/icons-react'
import type { Client, ReportStatus, SortOrder } from '../types'
import { fetchClients, updateClientStatus } from '../lib/clients'
import type { User } from '@supabase/supabase-js'

/* ── 상태 설정 ── */
const STATUS_CONFIG: Record<ReportStatus, {
  label: string
  textCls: string
  bgCls: string
  borderCls: string
  hoverCls: string
  barCls: string
}> = {
  pending: {
    label: '대기 중',
    textCls: 'text-slate-400',
    bgCls: 'bg-slate-800',
    borderCls: 'border-slate-700',
    hoverCls: 'hover:bg-slate-700',
    barCls: 'bg-slate-600',
  },
  inprogress: {
    label: '진행 중',
    textCls: 'text-blue-400',
    bgCls: 'bg-blue-950/50',
    borderCls: 'border-blue-800',
    hoverCls: 'hover:bg-blue-900/60',
    barCls: 'bg-blue-500',
  },
  complete: {
    label: '완료',
    textCls: 'text-emerald-400',
    bgCls: 'bg-emerald-950/50',
    borderCls: 'border-emerald-800',
    hoverCls: 'hover:bg-emerald-900/60',
    barCls: 'bg-emerald-500',
  },
  stopped: {
    label: '중단',
    textCls: 'text-red-400',
    bgCls: 'bg-red-950/50',
    borderCls: 'border-red-800',
    hoverCls: 'hover:bg-red-900/50',
    barCls: 'bg-red-400',
  },
}

const STATUS_ICONS: Record<ReportStatus, React.ReactNode> = {
  pending: <IconClock size={13} className="shrink-0" />,
  inprogress: <IconPlayerPlay size={13} className="shrink-0" />,
  complete: <IconCircleCheck size={13} className="shrink-0" />,
  stopped: <IconCircleX size={13} className="shrink-0" />,
}

const SORT_LABELS: Record<SortOrder, string> = {
  inprogress: '진행 중 우선',
  pending: '대기 중 우선',
  expiry: '만료 임박순',
  name: '거래처명순',
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
  if (dday < 0) return { text: `D+${Math.abs(dday)}`, cls: 'text-slate-500' }
  if (dday === 0) return { text: 'D-Day', cls: 'text-red-400 font-bold' }
  if (dday <= 3) return { text: `D-${dday}`, cls: 'text-red-400 font-semibold' }
  if (dday <= 7) return { text: `D-${dday}`, cls: 'text-orange-400 font-medium' }
  return { text: `D-${dday}`, cls: 'text-slate-500' }
}

function formatDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`
}

/* ── 클라이언트 카드 ── */
function ClientCard({
  client,
  onStatusChange,
}: {
  client: Client
  onStatusChange: (id: string, status: ReportStatus) => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const cfg = STATUS_CONFIG[client.status]
  const contractEnd = getContractEnd(client)
  const dday = contractEnd ? getDday(contractEnd) : null
  const ddayFmt = dday != null ? formatDday(dday) : null

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  return (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/60 p-4 flex flex-col gap-2.5 hover:border-slate-600 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{client.name}</p>
          {client.contact && (
            <div className="flex items-center gap-1 mt-1">
              <IconUser size={12} className="text-slate-500 shrink-0" />
              <p className="text-xs text-slate-400 truncate">{client.contact}</p>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-1 mt-0.5">
              <IconPhone size={12} className="text-slate-500 shrink-0" />
              <p className="text-xs text-slate-400">{client.phone}</p>
            </div>
          )}
        </div>

        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all',
              cfg.bgCls, cfg.borderCls, cfg.textCls, cfg.hoverCls,
            ].join(' ')}
          >
            {STATUS_ICONS[client.status]}
            {cfg.label}
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden min-w-[110px]">
              {(Object.keys(STATUS_CONFIG) as ReportStatus[]).map((s) => {
                const sc = STATUS_CONFIG[s]
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(client.id, s); setDropdownOpen(false) }}
                    className={[
                      'flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold transition-colors',
                      client.status === s
                        ? `${sc.bgCls} ${sc.textCls}`
                        : 'text-slate-300 hover:bg-slate-700',
                    ].join(' ')}
                  >
                    {STATUS_ICONS[s]}
                    {sc.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {client.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {client.tags.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#6C63FF]/15 text-[#8B85FF]">
              {t}
            </span>
          ))}
        </div>
      )}

      {client.memo && (
        <p className="text-xs text-slate-500 line-clamp-1">{client.memo}</p>
      )}

      {contractEnd && ddayFmt && (
        <div className="flex items-center gap-1.5">
          <IconCalendar size={12} className="text-slate-500 shrink-0" />
          <p className="text-xs text-slate-500">{formatDate(contractEnd)}</p>
          <span className={`text-xs ml-auto ${ddayFmt.cls}`}>{ddayFmt.text}</span>
        </div>
      )}

      <div
        className="h-0.5 rounded-full mt-auto"
        style={{ background: client.status === 'pending' ? '#334155' : undefined }}
      >
        {client.status !== 'pending' && (
          <div className={`h-full rounded-full ${cfg.barCls} w-full`} />
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

  useEffect(() => {
    loadClients()
  }, [user.id])

  async function loadClients() {
    setLoading(true)
    const data = await fetchClients(user.id)
    setClients(data)
    setLoading(false)
  }

  function handleStatusChange(id: string, newStatus: ReportStatus) {
    const today = new Date().toISOString().slice(0, 10)
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        const updated = {
          ...c,
          status: newStatus,
          statusHistory: [...c.statusHistory, { date: today, status: newStatus }],
        }
        updateClientStatus(id, newStatus, updated.statusHistory).catch(console.error)
        return updated
      }),
    )
  }

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
      if (!ea) return 1
      if (!eb) return -1
      if (ea !== eb) return ea.localeCompare(eb)
    }
    return a.name.localeCompare(b.name, 'ko')
  })

  const total = clients.length
  const cInprogress = clients.filter((c) => c.status === 'inprogress').length
  const cComplete = clients.filter((c) => c.status === 'complete').length
  const cStopped = clients.filter((c) => c.status === 'stopped').length
  const cPending = total - cInprogress - cComplete - cStopped

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-100">거래처 목록</h2>
          <button
            onClick={loadClients}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <IconRefresh size={15} />
          </button>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: '전체', value: total, cls: 'text-slate-100' },
            { label: '진행 중', value: cInprogress, cls: 'text-blue-400' },
            { label: '완료', value: cComplete, cls: 'text-emerald-400' },
            { label: '중단', value: cStopped, cls: 'text-red-400' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
              <p className={`text-xl font-bold mt-0.5 ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 프로그레스바 */}
        {total > 0 && (
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden flex mb-4">
            <div style={{ width: `${(cComplete / total) * 100}%` }} className="bg-emerald-500 transition-all" />
            <div style={{ width: `${(cInprogress / total) * 100}%` }} className="bg-blue-500 transition-all" />
            <div style={{ width: `${(cStopped / total) * 100}%` }} className="bg-red-400 transition-all" />
            <div style={{ width: `${(cPending / total) * 100}%` }} className="bg-slate-600 transition-all" />
          </div>
        )}

        {/* 검색 + 정렬 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="거래처명, 담당자 검색"
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#6C63FF]/50 transition-colors"
            />
          </div>
          <button
            onClick={() =>
              setSortOrder((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length])
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors whitespace-nowrap"
          >
            <IconArrowsSort size={13} />
            {SORT_LABELS[sortOrder]}
          </button>
        </div>
      </div>

      {/* 카드 목록 */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <IconLoader2 size={24} className="text-slate-600 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-600">
            <IconBuilding size={40} className="mb-3" />
            <p className="text-sm font-medium text-slate-500">
              {search ? '검색 결과가 없습니다' : '등록된 거래처가 없습니다'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {sorted.map((c) => (
              <ClientCard key={c.id} client={c} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
