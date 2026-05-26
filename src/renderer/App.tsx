import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import TitleBar from './components/TitleBar'
import LoginPage from './pages/LoginPage'
import ClientsPage from './pages/ClientsPage'

function applyTheme(resolved: 'dark' | 'light') {
  const isDark = resolved === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  document.body.style.backgroundColor = isDark ? '#080810' : '#efefff'
}

/* ── 글라스모피즘 배경 블롭 ── */
function BgBlobs({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: -80, left: -80,
          width: 320, height: 320,
          background: '#6C63FF',
          borderRadius: '50%',
          opacity: 0.35,
          filter: 'blur(120px)',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, right: -60,
          width: 300, height: 300,
          background: '#4f8eff',
          borderRadius: '50%',
          opacity: 0.28,
          filter: 'blur(100px)',
        }} />
        <div style={{
          position: 'absolute', top: '38%', left: '25%',
          width: 340, height: 340,
          background: '#8b5cf6',
          borderRadius: '50%',
          opacity: 0.18,
          filter: 'blur(150px)',
        }} />
      </div>
    )
  }
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <div style={{
        position: 'absolute', top: -70, left: -70,
        width: 320, height: 320,
        background: '#6C63FF',
        borderRadius: '50%',
        opacity: 0.45,
        filter: 'blur(120px)',
      }} />
      <div style={{
        position: 'absolute', bottom: -70, right: -50,
        width: 300, height: 300,
        background: '#a78bfa',
        borderRadius: '50%',
        opacity: 0.40,
        filter: 'blur(100px)',
      }} />
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [dark, setDark] = useState(true)

  useEffect(() => {
    window.electronAPI.theme.get().then(({ resolved }) => {
      applyTheme(resolved)
      setDark(resolved === 'dark')
    })
    window.electronAPI.theme.onUpdated((resolved) => {
      applyTheme(resolved)
      setDark(resolved === 'dark')
    })

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
      <>
        <BgBlobs dark={dark} />
        <div className="relative h-full w-full flex items-center justify-center" style={{ zIndex: 1 }}>
          <div className="w-4 h-4 border-2 border-white/10 border-t-[#6C63FF] rounded-full animate-spin" />
        </div>
      </>
    )
  }

  return (
    <>
      <BgBlobs dark={dark} />
      <div className="relative flex flex-col h-full" style={{ zIndex: 1 }}>
        <TitleBar />
        <div className="flex-1 overflow-hidden">
          {!user ? <LoginPage /> : <ClientsPage user={user} />}
        </div>
      </div>
    </>
  )
}
