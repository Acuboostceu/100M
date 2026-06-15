'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function signUp() {
    if (!email || !password) return
    setLoading(true); setError('')
    const sb = createClient()
    const { error } = await sb.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-600">100M</h1>
          <p className="text-sm text-gray-500 mt-1">Create your account</p>
        </div>
        <div className="card space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={signUp} disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
          <p className="text-xs text-center text-gray-400">
            Have an account? <a href="/login" className="text-brand-600">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  )
}
