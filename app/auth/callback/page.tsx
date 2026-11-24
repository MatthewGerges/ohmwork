'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const [error, setError] = useState('')
  const completion = useRef<Promise<void> | null>(null)
  useEffect(() => {
    let active = true
    async function finish() {
      const params = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const failure = params.get('error_description') || hash.get('error_description')
      if (failure) throw new Error(failure)
      if (params.has('code')) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.get('code')!)
        if (error) throw error
      }
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) throw new Error('Sign-in could not be completed. Please try again.')
    }
    completion.current ??= finish()
    void completion.current.then(() => { if (active) window.location.replace('/') }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Sign-in failed.') })
    return () => { active = false }
  }, [])
  return <main className="grid min-h-screen place-items-center px-4"><section className="max-w-md space-y-4 text-center"><h1 className="text-xl font-semibold">Signing in to Ohmwork</h1>{error ? <><p role="alert" className="text-rose-300">{error}</p><Link href="/" className="text-cyan-300 underline">Back to sign in</Link></> : <p role="status" className="text-slate-400">Completing your sign-in...</p>}</section></main>
}
