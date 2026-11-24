'use client'

import { useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  compact?: boolean
}

export function AuthForm({ compact = false }: Props) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login')
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function selectMode(nextMode: 'login' | 'signup' | 'reset') {
    setMode(nextMode)
    setError('')
    setMessage('')
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    setMessage('')

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const confirmPassword = String(form.get('confirm_password') ?? '')

    if (mode === 'signup' && password !== confirmPassword) {
      setError('The passwords do not match.')
      setPending(false)
      return
    }

    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setMessage('If an account exists for that email, a password reset link is on its way. Check your inbox and spam folder.')
        return
      }
      const result = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/account` },
          })
      if (result.error) throw result.error
      if (mode === 'signup' && !result.data.session) {
        setMessage('Account created. Check your email to confirm your address, then sign in.')
        setMode('login')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to connect. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function signInWithGoogle() {
    setPending(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      })
      if (!response.ok) throw new Error('Unable to check sign-in availability. Please try again.')
      const settings = await response.json()
      if (!settings.external?.google) throw new Error('Google sign-in is not available yet. Please use your email and password for now.')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Google sign-in failed. Please try again.')
      setPending(false)
    }
  }

  return (
    <div className={`w-full ${compact ? 'max-w-md' : 'max-w-[430px]'}`}>
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-2xl font-semibold text-cyan-300">
          Ω
        </div>
        <h1 className="text-2xl font-semibold text-white">Ohmwork</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Sign in to study, save decks, and keep your review schedule in sync.
        </p>
      </div>

      <section className="rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/20 sm:p-7">
        <div className="mb-6 grid grid-cols-2 rounded-lg border border-slate-700 bg-slate-950 p-1" aria-label="Authentication mode">
          <button
            type="button"
            onClick={() => selectMode('login')}
            aria-pressed={mode === 'login'}
            className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => selectMode('signup')}
            aria-pressed={mode === 'signup'}
            className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Create account
          </button>
        </div>

        {mode !== 'reset' && <button type="button" disabled={pending} onClick={signInWithGoogle} className="mb-5 flex w-full items-center justify-center gap-3 rounded-md border border-slate-600 bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-60">
          <span aria-hidden="true" className="text-lg font-bold text-blue-600">G</span>Continue with Google
        </button>}
        {mode === 'reset' && <h2 className="mb-4 text-lg font-semibold">Reset your password</h2>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Email</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500"
              />
            </span>
          </label>

          {mode !== 'reset' && <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">Password</span>
            <span className="relative block">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                required
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 pl-10 pr-11 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>}

          {mode === 'login' && <button type="button" onClick={() => selectMode('reset')} className="text-sm text-cyan-300 hover:text-cyan-200">Forgot password?</button>}

          {mode === 'signup' && (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-200">Confirm password</span>
              <input
                name="confirm_password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-500"
              />
            </label>
          )}

          {error && <p role="alert" className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-300">{error}</p>}
          {message && (
            <p role="status" className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Please wait...' : mode === 'reset' ? 'Send reset link' : mode === 'login' ? 'Sign in to Ohmwork' : 'Create free account'}
            {!pending && <ArrowRight className="size-4" aria-hidden="true" />}
          </button>
        </form>
        {mode === 'reset' && <button type="button" onClick={() => selectMode('login')} className="mt-4 text-sm text-slate-300 hover:text-white">Back to sign in</button>}

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          Your progress and saved deck stay private to your account.
        </p>
        <p className="mt-3 text-center text-sm">
          <a href="/simulations" className="text-cyan-300 hover:text-cyan-200">Explore the free Circuit Lab</a>
        </p>
      </section>
    </div>
  )
}
