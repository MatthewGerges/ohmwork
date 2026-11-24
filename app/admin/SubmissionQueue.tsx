'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { QuestionSubmission } from '@/lib/types'
import { approveSubmissionAction, getSubmissionsAction, rejectSubmissionAction } from './actions'
import { CategoryBadge } from '@/components/CategoryBadge'
import { DifficultyBadge } from '@/components/DifficultyBadge'

export function SubmissionQueue({ onPendingCount, onQuestionApproved }: { onPendingCount: (count: number) => void; onQuestionApproved: () => void }) {
  const [submissions, setSubmissions] = useState<QuestionSubmission[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [selected, setSelected] = useState<QuestionSubmission | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getSubmissionsAction()
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    const next = result.data ?? []
    setSubmissions(next)
    onPendingCount(next.filter((item) => item.status === 'pending').length)
  }, [onPendingCount])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const visible = useMemo(
    () => filter === 'pending' ? submissions.filter((item) => item.status === 'pending') : submissions,
    [filter, submissions]
  )

  function closeReview(refresh: boolean, approved = false) {
    setSelected(null)
    if (refresh) void load()
    if (approved) onQuestionApproved()
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex border border-slate-700 bg-slate-900 p-1 rounded-lg">
          {(['pending', 'all'] as const).map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={`px-3 py-1.5 rounded-md text-sm capitalize ${filter === item ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              {item}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-500">{visible.length} shown</span>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {loading ? (
        <p className="text-center text-slate-500 py-16">Loading submissions...</p>
      ) : visible.length === 0 ? (
        <p className="text-center text-slate-500 py-16">No {filter === 'pending' ? 'pending ' : ''}submissions.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((submission) => (
            <article key={submission.id} className="border border-slate-800 bg-slate-900 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryBadge category={submission.category} />
                  <DifficultyBadge difficulty={submission.difficulty} />
                  <Status status={submission.status} />
                </div>
                <button type="button" onClick={() => setSelected(submission)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium shrink-0">
                  Review
                </button>
              </div>
              <p className="text-slate-100">{submission.question_text}</p>
              <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                <span>{submission.submitter_email ?? 'Unknown submitter'}</span>
                <span>{new Date(submission.created_at).toLocaleString()}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && <SubmissionReview submission={selected} onClose={closeReview} />}
    </section>
  )
}

function SubmissionReview({ submission, onClose }: { submission: QuestionSubmission; onClose: (refresh: boolean, approved?: boolean) => void }) {
  const [difficulty, setDifficulty] = useState(submission.difficulty)
  const [notes, setNotes] = useState(submission.admin_notes ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function approve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const formData = new FormData(event.currentTarget)
    formData.set('difficulty', difficulty)
    const result = await approveSubmissionAction(submission.id, {}, formData)
    setPending(false)
    if (result.error) setError(result.error)
    else onClose(true, true)
  }

  async function reject() {
    setPending(true)
    setError('')
    const result = await rejectSubmissionAction(submission.id, notes)
    setPending(false)
    if (result.error) setError(result.error)
    else onClose(true)
  }

  const editable = submission.status === 'pending'
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-end">
      <div className="w-full max-w-2xl h-full overflow-y-auto bg-slate-900 border-l border-slate-700">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-slate-900 border-b border-slate-800">
          <div>
            <h2 className="font-semibold">Review submission #{submission.id}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{submission.submitter_email}</p>
          </div>
          <button type="button" onClick={() => onClose(false)} className="text-slate-400 hover:text-white text-xl" aria-label="Close">×</button>
        </div>

        <form onSubmit={approve} className="p-5 space-y-5">
          <ReviewField label="Categories"><input name="category" required defaultValue={submission.category} disabled={!editable} className={reviewInput} /></ReviewField>
          <ReviewField label="Difficulty">
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as const).map((item) => (
                <button key={item} type="button" disabled={!editable} onClick={() => setDifficulty(item)} className={`py-2 border rounded-lg capitalize text-sm ${difficulty === item ? 'bg-indigo-600 border-indigo-500' : 'border-slate-700 text-slate-400'}`}>{item}</button>
              ))}
            </div>
          </ReviewField>
          <ReviewField label="Question"><textarea name="question_text" required rows={4} defaultValue={submission.question_text} disabled={!editable} className={reviewInput} /></ReviewField>
          <ReviewField label="Answer"><textarea name="answer_text" required rows={7} defaultValue={submission.answer_text} disabled={!editable} className={reviewInput} /></ReviewField>
          <ReviewField label="Explanation"><textarea name="explanation_text" rows={6} defaultValue={submission.explanation_text ?? ''} disabled={!editable} className={reviewInput} /></ReviewField>
          <div className="grid sm:grid-cols-2 gap-4">
            <ReviewField label="Bonus question"><textarea name="bonus_question_text" rows={4} defaultValue={submission.bonus_question_text ?? ''} disabled={!editable} className={reviewInput} /></ReviewField>
            <ReviewField label="Bonus answer"><textarea name="bonus_answer_text" rows={4} defaultValue={submission.bonus_answer_text ?? ''} disabled={!editable} className={reviewInput} /></ReviewField>
          </div>
          {submission.interview_context && (
            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs uppercase text-slate-600 mb-1">Interview context</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{submission.interview_context}</p>
            </div>
          )}
          <ReviewField label="Admin note"><textarea name="admin_notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!editable} className={reviewInput} /></ReviewField>
          {error && <p className="text-sm text-rose-400">{error}</p>}

          {editable && (
            <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
              <button type="button" onClick={reject} disabled={pending} className="px-4 py-2 border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 rounded-lg">Reject</button>
              <button type="submit" disabled={pending} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg font-medium">{pending ? 'Saving...' : 'Approve and publish'}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

const reviewInput = 'w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 disabled:opacity-70 resize-y'

function ReviewField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-sm text-slate-400">{label}</span>{children}</label>
}

function Status({ status }: { status: QuestionSubmission['status'] }) {
  const colors = status === 'approved' ? 'text-emerald-300' : status === 'rejected' ? 'text-rose-300' : 'text-amber-300'
  return <span className={`text-xs capitalize ${colors}`}>{status}</span>
}
