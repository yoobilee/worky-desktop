import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import TitleBar from './components/TitleBar'
import LoginPage from './pages/LoginPage'
import ClientsPage from './pages/ClientsPage'

function applyTheme(resolved: 'dark' | 'light') {
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 초기 테마 적용
    window.electronAPI.theme.get().then(({ resolved }) => applyTheme(resolved))
    // 테마 변경 구독
    window.electronAPI.theme.onUpdated(applyTheme)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })

    window.electronAPI.onDeepLink(async (url) => {
      try {
        const parsed = new URL(url)
        const code = parsed.searchParams.get('code')
        if (code) await supabase.auth.exchangeCodeForSession(code)
      } catch (e) {
        console.error('Deep link error:', e)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="h-full w-full bg-[#0a0a12] dark:bg-[#0a0a12] flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-white/10 border-t-[#6C63FF] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a12] dark:bg-[#0a0a12] light:bg-[#f4f4ff]">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        {!user ? <LoginPage /> : <ClientsPage user={user} />}
      </div>
    </div>
  )
}
