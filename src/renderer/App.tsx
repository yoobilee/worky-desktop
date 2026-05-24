import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import ClientsPage from './pages/ClientsPage'
import SettingsPage from './pages/SettingsPage'
import type { Page } from './types'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePage, setActivePage] = useState<Page>('clients')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })

    // Deep link: OAuth callback (worky://auth/callback?code=...)
    window.electronAPI.onDeepLink(async (url) => {
      try {
        const parsed = new URL(url)
        const code = parsed.searchParams.get('code')
        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        }
      } catch (e) {
        console.error('Deep link error:', e)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="h-full w-full bg-slate-900 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-700 border-t-[#6C63FF] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <TitleBar />
      {!user ? (
        <div className="flex-1 overflow-hidden">
          <LoginPage />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            activePage={activePage}
            onNavigate={setActivePage}
            user={user}
            onLogout={handleLogout}
          />
          <main className="flex-1 overflow-hidden bg-slate-900">
            {activePage === 'clients' && <ClientsPage user={user} />}
            {activePage === 'settings' && <SettingsPage />}
          </main>
        </div>
      )}
    </div>
  )
}
