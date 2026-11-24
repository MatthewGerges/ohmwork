import { supabase } from './supabase'
import { ProgressEntry, ProgressStore } from './types'
import { saveProgress } from './decks'

interface ProgressRow {
  question_id: number
  next_review_date: string
  interval_days: number
  review_count: number
  last_reviewed_at: string | null
  last_rating: ProgressEntry['last_rating'] | null
}

function mergeEntry(local?: ProgressEntry, remote?: ProgressEntry): ProgressEntry | undefined {
  if (!local) return remote
  if (!remote) return local
  if (local.review_count !== remote.review_count) {
    return local.review_count > remote.review_count ? local : remote
  }
  return (local.last_reviewed_at ?? '') >= (remote.last_reviewed_at ?? '') ? local : remote
}

export async function syncUserProgress(userId: string, local: ProgressStore): Promise<ProgressStore> {
  const { data, error } = await supabase
    .from('user_question_progress')
    .select('question_id,next_review_date,interval_days,review_count,last_reviewed_at,last_rating')

  if (error) throw error

  const remote = Object.fromEntries(
    ((data ?? []) as ProgressRow[]).map((row) => [
      row.question_id,
      {
        next_review_date: row.next_review_date,
        interval_days: row.interval_days,
        review_count: row.review_count,
        last_reviewed_at: row.last_reviewed_at ?? undefined,
        last_rating: row.last_rating ?? undefined,
      },
    ])
  ) as ProgressStore

  const ids = new Set([...Object.keys(local), ...Object.keys(remote)].map(Number))
  const merged: ProgressStore = {}
  ids.forEach((id) => {
    const entry = mergeEntry(local[id], remote[id])
    // Earlier versions saved zero for ratings that don't use scheduling.
    if (entry) merged[id] = { ...entry, interval_days: Math.max(1, entry.interval_days) }
  })

  const rows = Object.entries(merged).map(([questionId, entry]) => ({
    user_id: userId,
    question_id: Number(questionId),
    next_review_date: entry.next_review_date,
    interval_days: entry.interval_days,
    review_count: entry.review_count,
    last_reviewed_at: entry.last_reviewed_at ?? null,
    last_rating: entry.last_rating ?? null,
    updated_at: new Date().toISOString(),
  }))

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('user_question_progress')
      .upsert(rows, { onConflict: 'user_id,question_id' })
    if (upsertError) throw upsertError
  }

  saveProgress(merged)
  return merged
}

export async function saveUserProgress(
  userId: string,
  questionId: number,
  entry: ProgressEntry
): Promise<void> {
  const { error } = await supabase.from('user_question_progress').upsert(
    {
      user_id: userId,
      question_id: questionId,
      next_review_date: entry.next_review_date,
      interval_days: entry.interval_days,
      review_count: entry.review_count,
      last_reviewed_at: entry.last_reviewed_at ?? new Date().toISOString(),
      last_rating: entry.last_rating ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,question_id' }
  )
  if (error) throw error
}
