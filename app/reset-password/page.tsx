'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const initialization = useRef<Promise<void> | null>(null)

  useEffect(() => {
    let active = true
    async function initialize() {
      const params = new URLSearchParams(window.location.search)
      if (params.has('code')) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.get('code')!)
        if (error) throw error
        window.history.replaceState(null, '', '/reset-password')
      }
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) throw new Error('This reset link is invalid or expired. Request a new one from the sign-in page.')
    }
    initialization.current ??= initialize()
    void initialization.current.then(() => { if (active) setReady(true) }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Unable to verify the reset link.') })
    return () => { active = false }
  }, [])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password'))
    if (password !== form.get('confirm')) { setError('The passwords do not match.'); return }
    setPending(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSaved(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to update your password.')
    } finally { setPending(false) }
  }

  return <main className="grid min-h-screen place-items-center px-4 py-10">
    <section className="w-full max-w-md space-y-5 rounded-lg border border-slate-700 bg-slate-900 p-6">
      <Link href="/" className="text-cyan-300">Ohmwork</Link>
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {saved ? <><p role="status" className="text-emerald-300">Your password has been updated.</p><Link href="/" className="inline-block text-cyan-300 underline">Continue to flashcards</Link></> : ready ? <form onSubmit={save} className="space-y-4">
        <label className="block space-y-2 text-sm">New password<input name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" className="block w-full rounded-md border border-slate-600 bg-slate-950 p-3" /></label>
        <label className="block space-y-2 text-sm">Confirm new password<input name="confirm" type="password" autoComplete="new-password" required minLength={8} className="block w-full rounded-md border border-slate-600 bg-slate-950 p-3" /></label>
        <button disabled={pending} className="w-full rounded-md bg-cyan-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">{pending ? 'Saving...' : 'Update password'}</button>
      </form> : !error && <p role="status" className="text-slate-400">Checking your reset link...</p>}
      {!ready && error && <Link href="/" className="inline-block text-cyan-300 underline">Back to sign in</Link>}
    </section>
  </main>
}
