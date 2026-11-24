'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Bookmark, Flame, Gauge, LayoutList, Library, Rows3, Shuffle, Sparkles } from 'lucide-react'
import type { Difficulty, ProgressStore, Question } from '@/lib/types'
import { getStudyTopics, studyTopicOrder } from '@/lib/study-topics'
import {
  deckCounts,
  loadProgress,
  loadQueue,
  orderForStudy,
  introFirst,
  pairFilterResponses,
  rateQuestion,
  saveQueue,
  shuffleQuestionIds,
} from '@/lib/decks'
import { saveUserProgress, syncUserProgress } from '@/lib/user-progress'
import { setUserQueueItem, syncUserQueue } from '@/lib/user-queue'
import { supabase } from '@/lib/supabase'
import { AuthForm } from './AuthForm'
import { CategoryBadge } from './CategoryBadge'
import { DifficultyBadge } from './DifficultyBadge'
import { FlashCard } from './FlashCard'
import { RichHtmlContent } from './RichHtmlContent'
import { CircuitLabResources } from './CircuitLabResources'
import { CardTimer } from './CardTimer'

type DeckMode = 'all' | 'easy' | 'medium' | 'hard' | 'queue'

interface Props {
  initialDeck?: DeckMode
}

const deckLabels: Record<DeckMode, string> = {
  all: 'All cards',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  queue: 'Queue',
}

export function StudySession({ initialDeck = 'all' }: Props) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<ProgressStore>({})
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null)
  const [completedIds, setCompletedIds] = useState<number[]>([])
  const [queue, setQueue] = useState<number[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [shuffleOrder, setShuffleOrder] = useState<Map<number, number> | null>(null)
  const [sessionReviewed, setSessionReviewed] = useState(0)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [deckMode, setDeckMode] = useState<DeckMode>(initialDeck)
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [lastAction, setLastAction] = useState('')

  useEffect(() => {
    let mounted = true
    let loadingUserId: string | null = null
    let loadedUserId: string | null = null
    let loadVersion = 0

    async function loadForUser(nextUser: User | null) {
      if (!mounted) return
      setUser(nextUser)
      setAuthLoading(false)

      if (!nextUser) {
        loadVersion++
        loadingUserId = null
        loadedUserId = null
        setLoadError(false)
        setSyncError('')
        setQuestions([])
        setProgress({})
        setQueue([])
        setDataLoading(false)
        return
      }

      if (loadingUserId === nextUser.id || loadedUserId === nextUser.id) return
      const version = ++loadVersion
      loadingUserId = nextUser.id
      loadedUserId = null

      setLoadError(false)
      setSyncError('')
      setDataLoading(true)

      try {
        const questionResult = await supabase.from('questions').select('*').order('created_at', { ascending: true })
        if (questionResult.error) throw questionResult.error
        if (!mounted || version !== loadVersion) return

        const loadedQuestions = (questionResult.data as Question[]) ?? []
        const validIds = new Set(loadedQuestions.map((question) => question.id))
        const localProgress = Object.fromEntries(
          Object.entries(loadProgress() ?? {}).filter(([id]) => validIds.has(Number(id)))
        )
        const localQueue = loadQueue().filter((id) => validIds.has(id))
        const [progressResult, queueResult] = await Promise.allSettled([
          syncUserProgress(nextUser.id, localProgress),
          syncUserQueue(nextUser.id, localQueue),
        ])
        if (!mounted || version !== loadVersion) return

        setQuestions(loadedQuestions)
        setProgress(progressResult.status === 'fulfilled' ? progressResult.value : localProgress)
        const validQueue = queueResult.status === 'fulfilled'
          ? queueResult.value.filter((id) => validIds.has(id))
          : localQueue
        setQueue(validQueue)
        loadedUserId = nextUser.id
        if (queueResult.status === 'fulfilled') {
          try { saveQueue(validQueue) } catch { /* Storage may be disabled. */ }
        }
        if (progressResult.status === 'rejected' || queueResult.status === 'rejected') {
          setSyncError('Your cards are available, but some study data could not sync. Refresh to try again.')
        }
      } catch {
        if (mounted && version === loadVersion) setLoadError(true)
      } finally {
        if (mounted && version === loadVersion) {
          loadingUserId = null
          setDataLoading(false)
        }
      }
    }

    void supabase.auth.getUser().then(({ data }) => loadForUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void Promise.resolve().then(() => loadForUser(session?.user ?? null))
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const topicsByQuestion = useMemo(() => new Map(questions.map(question => [question.id, getStudyTopics(question)])), [questions])
  const categories = useMemo(() => {
    const present = new Set(Array.from(topicsByQuestion.values()).flat())
    return studyTopicOrder.filter(topic => present.has(topic))
  }, [topicsByQuestion])

  const queueSet = useMemo(() => new Set(queue), [queue])
  const ratingCounts = useMemo(() => deckCounts(questions, progress), [progress, questions])
  const counts = useMemo(() => ({
    all: ratingCounts.all,
    easy: ratingCounts.easy,
    medium: ratingCounts.medium,
    hard: ratingCounts.hard,
    queue: questions.filter((question) => queueSet.has(question.id)).length,
  }), [questions, queueSet, ratingCounts])

  const deck = useMemo(() => {
    let selected: Question[]
    if (deckMode === 'queue') {
      const byId = new Map(questions.map((question) => [question.id, question]))
      selected = queue.map((id) => byId.get(id)).filter((question): question is Question => Boolean(question))
    } else if (deckMode === 'easy' || deckMode === 'medium' || deckMode === 'hard') {
      selected = questions.filter((question) => progress[question.id]?.last_rating === deckMode)
    } else {
      selected = questions
    }

    const matchesTopic = (question: Question) => !categoryFilter || topicsByQuestion.get(question.id)?.some(topic => topic === categoryFilter)
    const categoryFiltered = selected.filter(matchesTopic)

    // Keep the card being rated (and ones already completed this session) in the
    // deck so it doesn't vanish mid-session the moment its rating changes.
    const sessionIds = new Set([
      ...completedIds,
      ...(activeQuestionId === null ? [] : [activeQuestionId]),
    ])
    const selectedIds = new Set(categoryFiltered.map((question) => question.id))
    const carriedQuestions = questions.filter((question) =>
      sessionIds.has(question.id)
      && !selectedIds.has(question.id)
      && matchesTopic(question)
    )
    const stableSession = [...categoryFiltered, ...carriedQuestions]

    if (shuffleOrder) {
      const rank = (id: number) => shuffleOrder.get(id) ?? shuffleOrder.size
      return stableSession.sort((a, b) => rank(a.id) - rank(b.id))
    }
    if (deckMode === 'queue') return stableSession
    if (deckMode === 'all' && !categoryFilter) return introFirst(orderForStudy(stableSession, progress))
    return categoryFilter === 'Filters'
      ? pairFilterResponses(stableSession)
      : orderForStudy(stableSession, progress)
  }, [activeQuestionId, categoryFilter, completedIds, deckMode, progress, questions, queue, shuffleOrder, topicsByQuestion])

  const remainingDeck = useMemo(
    () => deck.filter((question) => !completedIds.includes(question.id)),
    [completedIds, deck]
  )
  const current = remainingDeck.find((question) => question.id === activeQuestionId) ?? remainingDeck[0]
  const completedInDeck = deck.filter((question) => completedIds.includes(question.id)).length
  const isDone = deck.length > 0 && remainingDeck.length === 0

  const relatedQuestions = useMemo(() => {
    if (!current) return []
    return current.related_question_ids
      .map((id) => questions.find((question) => question.id === id))
      .filter((question): question is Question => Boolean(question))
  }, [current, questions])

  function resetSession(nextMode = deckMode) {
    setDeckMode(nextMode)
    setActiveQuestionId(null)
    setCompletedIds([])
    setSessionReviewed(0)
    setLastAction('')
  }

  function handleRate(rating: Difficulty) {
    if (!current || !user) return
    const updated = rateQuestion(progress, current.id, rating)
    setProgress(updated)
    setSessionReviewed((count) => count + 1)
    setActiveQuestionId(null)
    const label = deckLabels[rating]
    setLastAction(`Filed under ${label}. Review it anytime from the ${label} deck.`)
    setCompletedIds((ids) => ids.includes(current.id) ? ids : [...ids, current.id])

    void saveUserProgress(user.id, current.id, updated[current.id]).catch(() => {
      setSyncError('This rating is saved on this device and will sync when the connection recovers.')
    })
  }

  function handleSkip() {
    if (!current) return
    setCompletedIds((ids) => ids.includes(current.id) ? ids : [...ids, current.id])
    setActiveQuestionId(null)
    setLastAction('Skipped for now. Its deck was not changed.')
  }

  function handleAddToQueue(id: number) {
    if (!user) return
    const shouldQueue = !queue.includes(id)
    const updated = shouldQueue ? [...queue, id] : queue.filter((questionId) => questionId !== id)
    setQueue(updated)
    saveQueue(updated)
    setLastAction(shouldQueue ? 'Added to your Queue deck.' : 'Removed from your Queue deck.')
    void setUserQueueItem(user.id, id, shouldQueue).catch(() => {
      setSyncError('The queue changed on this device, but cloud sync is temporarily unavailable.')
    })
  }

  function handleStudyQuestion(id: number) {
    setCompletedIds((ids) => ids.filter((questionId) => questionId !== id))
    setActiveQuestionId(id)
    setViewMode('card')
  }

  function handleCategoryFilter(category: string | null) {
    setCategoryFilter(category)
    setActiveQuestionId(null)
    setCompletedIds([])
  }

  if (authLoading) return <LoadingScreen label="Checking your account..." />

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:grid sm:place-items-center">
        <AuthForm />
      </main>
    )
  }

  if (dataLoading) return <LoadingScreen label="Loading your study decks..." />

  if (loadError) return (
    <main className="min-h-screen bg-slate-950 px-4 text-white">
      <EmptyDeck title="Could not load your cards" description="Check your connection and try again." action="Retry" onAction={() => window.location.reload()} />
    </main>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 safe-area-x px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-cyan-400/30 bg-cyan-400/10 font-semibold text-cyan-300">Ω</span>
            <h1 className="truncate text-base font-semibold">Ohmwork</h1>
          </div>
          <nav className="flex items-center gap-3 text-xs sm:gap-5 sm:text-sm" aria-label="Account navigation">
            <Link href="/simulations" className="text-slate-300 hover:text-white">Circuit Lab</Link>
            <span className="hidden text-slate-500 md:inline">{sessionReviewed} reviewed</span>
            <Link href="/submit" className="text-slate-300 hover:text-white">Feedback</Link>
            <Link href="/account" className="max-w-32 truncate text-cyan-300 hover:text-cyan-200 sm:max-w-48">{user.email}</Link>
          </nav>
        </div>
      </header>

      <main className={`${viewMode === 'list' ? 'max-w-6xl' : 'max-w-3xl'} mx-auto space-y-5 px-3 py-5 safe-area-x safe-area-bottom sm:px-4 sm:py-8`}>
        {syncError && <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{syncError}</div>}
        {lastAction && <div role="status" className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">{lastAction}</div>}

        <section className="space-y-4" aria-label="Study controls">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <DeckButton icon={<Library />} label="All cards" count={counts.all} active={deckMode === 'all'} onClick={() => resetSession('all')} />
            <DeckButton icon={<Sparkles />} label="Easy" count={counts.easy} active={deckMode === 'easy'} onClick={() => resetSession('easy')} />
            <DeckButton icon={<Gauge />} label="Medium" count={counts.medium} active={deckMode === 'medium'} onClick={() => resetSession('medium')} />
            <DeckButton icon={<Flame />} label="Hard" count={counts.hard} active={deckMode === 'hard'} onClick={() => resetSession('hard')} />
            <DeckButton icon={<Bookmark />} label="Queue" count={counts.queue} active={deckMode === 'queue'} onClick={() => resetSession('queue')} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-800 py-3">
            <label className="flex min-w-0 items-center gap-2 text-sm text-slate-400">
              <span className="sr-only">Topic</span>
              <select value={categoryFilter ?? ''} onChange={event => handleCategoryFilter(event.target.value || null)} className="min-h-10 max-w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100">
                <option value="">All topics</option>
                {categories.map(category => <option key={category}>{category}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" aria-pressed={shuffleOrder !== null} onClick={() => {
                setShuffleOrder(shuffleOrder ? null : shuffleQuestionIds(questions))
                setActiveQuestionId(null)
              }} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${shuffleOrder ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white'}`}>
                <Shuffle className="size-4" aria-hidden="true" />Shuffle
              </button>
              {viewMode === 'card' && current && <CardTimer key={current.id} />}
              <div className="flex shrink-0 rounded-lg border border-slate-700 bg-slate-900 p-1" role="group" aria-label="Display mode">
                <ViewButton active={viewMode === 'card'} label="Card" icon={<Rows3 />} onClick={() => setViewMode('card')} />
                <ViewButton active={viewMode === 'list'} label="List" icon={<LayoutList />} onClick={() => setViewMode('list')} />
              </div>
            </div>
          </div>
        </section>

        {viewMode === 'card' && deck.length > 0 && !isDone && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{completedInDeck} of {deck.length} completed in {deckLabels[deckMode]}</span>
              <span>{remainingDeck.length} remaining</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-cyan-500 transition-all duration-300" style={{ width: `${(completedInDeck / deck.length) * 100}%` }} />
            </div>
          </div>
        )}

        {viewMode === 'card' && (
          isDone ? (
            <EmptyDeck
              title="Session complete"
              description={`You reviewed ${sessionReviewed} card${sessionReviewed === 1 ? '' : 's'} in this session.`}
              action="Review this deck again"
              onAction={() => resetSession()}
            />
          ) : current ? (
            <FlashCard
              key={current.id}
              question={current}
              relatedQuestions={relatedQuestions}
              onRate={handleRate}
              onSkip={handleSkip}
              onGoToQuestion={handleStudyQuestion}
              onAddToQueue={handleAddToQueue}
              queuedIds={queue}
            />
          ) : (
            <EmptyDeck
              title={emptyDeckTitle(deckMode)}
              description={emptyDeckDescription(deckMode)}
              action={deckMode === 'all' ? undefined : 'Browse all cards'}
              onAction={deckMode === 'all' ? undefined : () => resetSession('all')}
            />
          )
        )}

        {viewMode === 'list' && (
          <QuestionListView questions={deck} progress={progress} onStudyQuestion={handleStudyQuestion} onAddToQueue={handleAddToQueue} queuedIds={queue} />
        )}
      </main>
    </div>
  )
}

function LoadingScreen({ label }: { label: string }) {
  return <div className="grid min-h-screen place-items-center bg-slate-950 px-4 text-sm text-slate-500">{label}</div>
}

function DeckButton({ icon, label, count, active, onClick }: { icon: React.ReactNode; label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 text-left transition-colors ${active ? 'border-cyan-500/60 bg-cyan-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-white'}`}>
      <span className={`[&>svg]:size-4 ${active ? 'text-cyan-300' : 'text-slate-500'}`}>{icon}</span>
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
      <span className="text-xs tabular-nums text-slate-500">{count}</span>
    </button>
  )
}

function ViewButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><span className="[&>svg]:size-3.5">{icon}</span>{label}</button>
}

function EmptyDeck({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <section className="py-20 text-center">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
      {action && onAction && <button type="button" onClick={onAction} className="mt-5 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">{action}</button>}
    </section>
  )
}

function emptyDeckTitle(mode: DeckMode): string {
  if (mode === 'queue') return 'Your Queue is empty'
  if (mode === 'easy') return 'Your Easy deck is empty'
  if (mode === 'medium') return 'Your Medium deck is empty'
  if (mode === 'hard') return 'Your Hard deck is empty'
  return 'No cards match this topic'
}

function emptyDeckDescription(mode: DeckMode): string {
  if (mode === 'queue') return 'Use the bookmark button on any flashcard or list item to build a personal study deck.'
  if (mode === 'easy') return 'Rate a card Easy while studying and it lands here, ready to review whenever you like.'
  if (mode === 'medium') return 'Rate a card Medium while studying and it lands here, ready to review whenever you like.'
  if (mode === 'hard') return 'Rate a card Hard while studying and it lands here so you can drill the tough ones.'
  return 'Try another topic filter, or switch to All cards.'
}

function QuestionListView({ questions, progress, onStudyQuestion, onAddToQueue, queuedIds }: { questions: Question[]; progress: ProgressStore; onStudyQuestion: (id: number) => void; onAddToQueue: (id: number) => void; queuedIds: number[] }) {
  if (questions.length === 0) return <div className="py-16 text-center text-slate-500">No questions in this deck match the selected topic.</div>

  return (
    <div className="grid gap-3">
      {questions.map((question) => {
        const queued = queuedIds.includes(question.id)
        const lastRating = progress[question.id]?.last_rating
        return (
          <article key={question.id} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <CategoryBadge category={question.category} labels={getStudyTopics(question)} />
                <DifficultyBadge difficulty={question.difficulty} />
                {lastRating && <span className="text-xs capitalize text-slate-500">Last: {lastRating}</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => onAddToQueue(question.id)} aria-pressed={queued} aria-label={queued ? 'Remove from Queue' : 'Add to Queue'} title={queued ? 'Remove from Queue' : 'Add to Queue'} className={`grid size-9 place-items-center rounded-md border transition-colors ${queued ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
                  <Bookmark className={`size-4 ${queued ? 'fill-current' : ''}`} />
                </button>
                <button type="button" onClick={() => onStudyQuestion(question.id)} className="rounded-md bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400">Study</button>
              </div>
            </div>
            <RichHtmlContent html={question.question_text} className="text-base leading-relaxed text-slate-100 [&_img]:mt-3 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:bg-slate-950 sm:text-lg" />
            <CircuitLabResources question={question} collapsed />
          </article>
        )
      })}
    </div>
  )
}
