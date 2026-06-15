'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function signIn() {
    if (!email || !password) return
    setLoading(true); setError('')
    const sb = createClient()
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-600">100M</h1>
          <p className="text-sm text-gray-500 mt-1">Family & business finances</p>
        </div>
        <div className="card space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && signIn()} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && signIn()} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={signIn} disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-xs text-center text-gray-400">
            No account? <a href="/register" className="text-brand-600">Register</a>
          </p>
        </div>
      </div>
    </div>
  )
}
