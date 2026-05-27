import { useState } from 'react'
import { IconBrandGoogle, IconLoader2 } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { useDark } from '../hooks/useDark'

export default function LoginPage() {
  const dark = useDark()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bg          = dark ? '#080810' : '#efefff'
  const textPrimary = dark ? '#ffffff' : '#1a1a2e'
  const textSub     = dark ? '#a0a0c0' : '#4a4a6a'
  const textMuted   = dark ? '#6a6a8a' : '#9090b0'
  const card        = dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)'
  const cardBorder  = dark ? 'rgba(255,255,255,0.10)' : 'rgba(108,99,255,0.18)'

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:7777/callback',
          skipBrowserRedirect: true,
        },
      })
      if (err) throw err
      if (data.url) {
        window.electronAPI.openExternal(data.url)
      }
    } catch (e) {
      setError('로그인 중 오류가 발생했습니다.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full w-full flex items-center justify-center relative overflow-hidden" style={{ background: bg }}>
      {/* 배경 블롭 */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-[-60px] left-[-60px] w-[260px] h-[260px] rounded-full opacity-35 blur-3xl"
          style={{ background: dark ? '#6C63FF' : '#6C63FF' }} />
        <div className="absolute bottom-[-40px] right-[-40px] w-[200px] h-[200px] rounded-full opacity-45 blur-3xl"
          style={{ background: dark ? '#4f8eff' : '#a78bfa' }} />
      </div>

      <div className="relative w-full max-w-sm px-6">
        {/* 로고 + 타이틀 */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-5">
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #6C63FF, #8B85FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
                <path d="M5 8 L10 24 L16 13 L22 24 L27 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: textPrimary }}>WORKY mini</h1>
          <p className="text-sm mt-2" style={{ color: textSub }}>거래처 관리를 더 스마트하게</p>
        </div>

        {/* 카드 */}
        <div
          className="rounded-2xl p-5 backdrop-blur-md"
          style={{ background: card, border: `1px solid ${cardBorder}` }}
        >
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            style={{
              background: dark ? 'rgba(255,255,255,0.92)' : '#ffffff',
              color: '#1a1a2e',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = dark ? '#ffffff' : '#f0f0ff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.92)' : '#ffffff' }}
          >
            {loading ? (
              <IconLoader2 size={18} className="animate-spin" />
            ) : (
              <IconBrandGoogle size={18} />
            )}
            Google로 로그인
          </button>

          {error && (
            <p className="mt-3 text-center text-xs" style={{ color: dark ? '#f87171' : '#dc2626' }}>{error}</p>
          )}
        </div>

        <p className="mt-5 text-center text-xs" style={{ color: textMuted }}>
          로그인하면 브라우저가 열립니다.<br />
          인증 완료 후 앱으로 자동 복귀됩니다.
        </p>
      </div>
    </div>
  )
}
