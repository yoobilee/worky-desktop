import { IconBuilding, IconSettings, IconLogout, IconUser } from '@tabler/icons-react'
import type { Page } from '../types'
import type { User } from '@supabase/supabase-js'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
  user: User | null
  onLogout: () => void
}

const NAV_ITEMS: { page: Page; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { page: 'clients', label: '거래처 목록', Icon: IconBuilding },
  { page: 'settings', label: '설정', Icon: IconSettings },
]

export default function Sidebar({ activePage, onNavigate, user, onLogout }: SidebarProps) {
  const email = user?.email ?? ''
  const displayName = user?.user_metadata?.full_name ?? email.split('@')[0] ?? '사용자'
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

  return (
    <div className="flex flex-col w-56 shrink-0 bg-slate-900 border-r border-slate-800 h-full">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-800">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}
        >
          <span className="text-white text-sm font-black leading-none">W</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-100 leading-none">WORKY mini</p>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ page, label, Icon }) => {
          const active = activePage === page
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={[
                'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                active
                  ? 'bg-[#6C63FF]/15 text-[#8B85FF]'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
              ].join(' ')}
            >
              <Icon size={17} className="shrink-0" />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/60">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-8 h-8 rounded-full shrink-0 object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
              <IconUser size={16} className="text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{displayName}</p>
            <p className="text-[10px] text-slate-500 truncate">{email}</p>
          </div>
          <button
            onClick={onLogout}
            title="로그아웃"
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
          >
            <IconLogout size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
