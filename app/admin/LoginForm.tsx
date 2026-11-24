'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'

export function LoginForm({ redirectTo = '/admin' }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, {})

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-cyan-300">Ω</span>
              <h1 className="text-xl font-bold text-white">Ohmwork Admin</h1>
            </div>
            <p className="text-sm text-slate-400">Admin access required</p>
          </div>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <input
              type="password"
              name="password"
              placeholder="Admin password"
              required
              autoFocus
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {state?.error && (
              <p className="text-rose-400 text-sm">{state.error}</p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
