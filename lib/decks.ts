import { Difficulty, ProgressStore, Question } from './types'

const STORAGE_KEY = 'ohmwork_progress'
const QUEUE_STORAGE_KEY = 'ohmwork_queue'
const LEGACY_STORAGE_KEY = 'ee_flashcards_progress'
const LEGACY_QUEUE_STORAGE_KEY = 'ee_flashcards_queue'

function readMigratedStorage(primaryKey: string, legacyKey: string): string | null {
  const current = localStorage.getItem(primaryKey)
  if (current) return current
  const legacy = localStorage.getItem(legacyKey)
  if (legacy) localStorage.setItem(primaryKey, legacy)
  return legacy
}

export function loadProgress(): ProgressStore {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(readMigratedStorage(STORAGE_KEY, LEGACY_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveProgress(progress: ProgressStore): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function loadQueue(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(readMigratedStorage(QUEUE_STORAGE_KEY, LEGACY_QUEUE_STORAGE_KEY) || '[]')
    return Array.isArray(value)
      ? value.filter((id): id is number => Number.isInteger(id))
      : []
  } catch {
    return []
  }
}

export function saveQueue(queue: number[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
}

/**
 * Rating a card simply files it into a deck (Easy / Medium / Hard) — no review
 * scheduling. The card's `last_rating` decides which deck it belongs to, so
 * re-rating it moves it from one deck to another. The `next_review_date` and
 * `interval_days` fields are retained only so existing storage rows stay valid;
 * they are no longer read anywhere.
 */
export function rateQuestion(
  progress: ProgressStore,
  questionId: number,
  rating: Difficulty
): ProgressStore {
  const current = progress[questionId]
  const now = new Date().toISOString()

  const updated: ProgressStore = {
    ...progress,
    [questionId]: {
      next_review_date: now,
      interval_days: 1,
      review_count: (current?.review_count ?? 0) + 1,
      last_reviewed_at: now,
      last_rating: rating,
    },
  }

  saveProgress(updated)
  return updated
}

export type DeckCounts = { all: number; easy: number; medium: number; hard: number }

export function deckCounts(questions: Question[], progress: ProgressStore): DeckCounts {
  const counts: DeckCounts = { all: questions.length, easy: 0, medium: 0, hard: 0 }
  for (const question of questions) {
    const rating = progress[question.id]?.last_rating
    if (rating === 'easy') counts.easy += 1
    else if (rating === 'medium') counts.medium += 1
    else if (rating === 'hard') counts.hard += 1
  }
  return counts
}

/**
 * Study order within a deck: cards you have never rated come first (fresh
 * material), then the least-recently reviewed, so a deck cycles oldest-first.
 */
export function orderForStudy(questions: Question[], progress: ProgressStore): Question[] {
  return [...questions].sort((a, b) => {
    const pa = progress[a.id]
    const pb = progress[b.id]
    if (!pa && !pb) return 0
    if (!pa) return -1
    if (!pb) return 1
    return (pa.last_reviewed_at ?? '').localeCompare(pb.last_reviewed_at ?? '')
  })
}

export function shuffleQuestionIds(questions: Pick<Question, 'id'>[]): Map<number, number> {
  const ids = questions.map(({ id }) => id)
  for (let index = ids.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[ids[index], ids[other]] = [ids[other], ids[index]]
  }
  return new Map(ids.map((id, index) => [id, index]))
}

export function introFirst(questions: Question[]): Question[] {
  const intro = questions.find(question => question.id === 1)
  return intro ? [intro, ...questions.filter(question => question.id !== intro.id)] : questions
}

export function pairFilterResponses(questions: Question[]): Question[] {
  const byId = new Map(questions.map(question => [question.id, question]))
  const seen = new Set<number>()
  const paired: Question[] = []
  for (const question of questions) {
    if (seen.has(question.id)) continue
    paired.push(question)
    seen.add(question.id)
    const companion = question.related_question_ids
      .map(id => byId.get(id))
      .find(other => other && !seen.has(other.id) && other.related_question_ids.includes(question.id)
        && (question.tags.includes('filter-response-pair') || other.tags.includes('filter-response-pair')))
    if (companion) {
      paired.push(companion)
      seen.add(companion.id)
    }
  }
  return paired
}
