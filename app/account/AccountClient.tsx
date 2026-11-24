'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, Bookmark, Flame, Gauge, LogOut, Sparkles } from 'lucide-react'
import { AuthForm } from '@/components/AuthForm'
import { supabase } from '@/lib/supabase'

interface ProgressSummaryRow {
  review_count: number
  last_rating: 'easy' | 'medium' | 'hard' | null
}

export function AccountClient() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [progressRows, setProgressRows] = useState<ProgressSummaryRow[]>([])
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    let mounted = true

    async function loadAccount(nextUser: User | null) {
      if (!mounted) return
      setUser(nextUser)
      if (!nextUser) {
        setProgressRows([])
        setQueueCount(0)
        setLoading(false)
        return
      }

      const [progressResult, queueResult] = await Promise.all([
        supabase.from('user_question_progress').select('review_count,last_rating'),
        supabase.from('user_question_queue').select('question_id'),
      ])
      if (!mounted) return
      setProgressRows((progressResult.data as ProgressSummaryRow[]) ?? [])
      setQueueCount(queueResult.data?.length ?? 0)
      setLoading(false)
    }

    void supabase.auth.getUser().then(({ data }) => loadAccount(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void Promise.resolve().then(() => loadAccount(session?.user ?? null))
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const stats = useMemo(() => ({
    studied: progressRows.length,
    reviews: progressRows.reduce((sum, row) => sum + row.review_count, 0),
    easy: progressRows.filter((row) => row.last_rating === 'easy').length,
    medium: progressRows.filter((row) => row.last_rating === 'medium').length,
    hard: progressRows.filter((row) => row.last_rating === 'hard').length,
  }), [progressRows])

  async function handleSignOut() {
    setPending(true)
    await supabase.auth.signOut()
    setPending(false)
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-500">Loading your account...</div>

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:grid sm:place-items-center">
        <AuthForm />
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 safe-area-x px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md border border-cyan-400/30 bg-cyan-400/10 font-semibold text-cyan-300">Ω</span>
            <span className="font-semibold">Ohmwork</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/submit" className="text-slate-300 hover:text-white">Feedback</Link>
            <Link href="/" className="text-cyan-300 hover:text-cyan-200">Study</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 safe-area-x safe-area-bottom sm:py-12">
        <section className="flex flex-col gap-5 border-b border-slate-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-cyan-400">Account</p>
            <h1 className="mt-2 break-all text-2xl font-semibold">{user.email}</h1>
            <p className="mt-2 text-sm text-slate-500">Your decks and saved cards sync automatically across devices.</p>
          </div>
          <button type="button" onClick={handleSignOut} disabled={pending} className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-900 disabled:opacity-50">
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Your decks</h2>
              <p className="mt-1 text-sm text-slate-500">Open a deck to review the cards you sorted into it.</p>
            </div>
            <span className="hidden text-sm text-slate-500 sm:block">{stats.reviews} total reviews</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DeckLink href="/?deck=easy" icon={<Sparkles />} value={stats.easy} label="Easy" description="Cards you found easy" />
            <DeckLink href="/?deck=medium" icon={<Gauge />} value={stats.medium} label="Medium" description="Worth another pass" />
            <DeckLink href="/?deck=hard" icon={<Flame />} value={stats.hard} label="Hard" description="Drill the tough ones" />
            <DeckLink href="/?deck=queue" icon={<Bookmark />} value={queueCount} label="Queue" description="Cards you bookmarked" />
          </div>
          <div className="mt-4 flex gap-6 text-sm text-slate-500">
            <span><strong className="font-semibold text-slate-200">{stats.studied}</strong> cards studied</span>
            <span><strong className="font-semibold text-slate-200">{stats.reviews}</strong> completed reviews</span>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Have a question or a fix?</h2>
            <p className="mt-1 text-sm text-slate-500">Add a new card or suggest an improvement to an existing one.</p>
          </div>
          <Link href="/submit" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
            Submit / Feedback
          </Link>
        </section>
      </main>
    </div>
  )
}

function DeckLink({ href, icon, value, label, description }: { href: string; icon: React.ReactNode; value: number; label: string; description: string }) {
  return (
    <Link href={href} className="group flex min-h-32 flex-col justify-between rounded-lg border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-cyan-500/40">
      <div className="flex items-center justify-between">
        <span className="text-cyan-300 [&>svg]:size-5">{icon}</span>
        <ArrowRight className="size-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
      </div>
      <div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-sm font-medium text-slate-200">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{description}</div>
      </div>
    </Link>
  )
}
