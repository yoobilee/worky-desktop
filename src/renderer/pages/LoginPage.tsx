import { useState } from 'react'
import { IconBrandGoogle, IconBriefcase, IconLoader2 } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'worky://auth/callback',
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
    <div className="h-full w-full flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #6C63FF, #8B85FF)' }}
            >
              <IconBriefcase size={32} color="white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">WORKY mini</h1>
          <p className="text-slate-400 text-sm mt-2">거래처 관리를 더 스마트하게</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl bg-white text-slate-800 text-sm font-semibold hover:bg-slate-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? (
            <IconLoader2 size={18} className="animate-spin" />
          ) : (
            <IconBrandGoogle size={18} />
          )}
          Google로 로그인
        </button>

        {error && (
          <p className="mt-4 text-center text-xs text-red-400">{error}</p>
        )}

        <p className="mt-6 text-center text-xs text-slate-600">
          로그인하면 브라우저가 열립니다.<br />
          인증 완료 후 앱으로 자동 복귀됩니다.
        </p>
      </div>
    </div>
  )
}
