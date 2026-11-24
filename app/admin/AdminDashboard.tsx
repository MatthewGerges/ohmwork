'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Question } from '@/lib/types'
import { splitCategories } from '@/lib/categories'
import { QuestionForm } from './QuestionForm'
import { deleteQuestionAction, logoutAction } from './actions'
import { CategoryBadge } from '@/components/CategoryBadge'
import { DifficultyBadge } from '@/components/DifficultyBadge'
import { SubmissionQueue } from './SubmissionQueue'

export function AdminDashboard() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [search, setSearch] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [section, setSection] = useState<'questions' | 'submissions'>('questions')
  const [pendingSubmissions, setPendingSubmissions] = useState(0)

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('questions')
      .select('*')
      .order('created_at', { ascending: false })
    setQuestions((data as Question[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchQuestions()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchQuestions])

  const filtered = questions.filter(
    (q) =>
      search === '' ||
      q.question_text.toLowerCase().includes(search.toLowerCase()) ||
      splitCategories(q.category).some((category) => category.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleDelete(id: number) {
    if (!confirm('Delete this question? This cannot be undone.')) return
    setDeleteError('')
    const result = await deleteQuestionAction(id)
    if (result.error) {
      setDeleteError(result.error)
    } else {
      fetchQuestions()
    }
  }

  function handleFormClose(refresh: boolean) {
    setShowForm(false)
    setEditingQuestion(null)
    if (refresh) fetchQuestions()
  }

  function openNew() {
    setEditingQuestion(null)
    setShowForm(true)
  }

  function openEdit(q: Question) {
    setEditingQuestion(q)
    setShowForm(true)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 safe-area-x px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400">⚡</span>
              <h1 className="text-base sm:text-lg font-bold">Admin</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{questions.length} questions total</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/" className="text-xs sm:text-sm text-slate-400 hover:text-white transition-colors py-1">
              ← Study
            </Link>
            {section === 'questions' && (
              <button
                onClick={openNew}
                className="px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-500 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation"
              >
                + New
              </button>
            )}
            <form action={logoutAction}>
              <button type="submit" className="px-3 py-2 border border-slate-700 hover:bg-slate-800 rounded-lg text-xs sm:text-sm text-slate-300">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto safe-area-x px-3 sm:px-4 py-4 sm:py-8 pb-8 safe-area-bottom space-y-4 sm:space-y-6">
        <div className="flex border-b border-slate-800">
          <button type="button" onClick={() => setSection('questions')} className={`px-4 py-2.5 text-sm border-b-2 ${section === 'questions' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            Questions
          </button>
          <button type="button" onClick={() => setSection('submissions')} className={`px-4 py-2.5 text-sm border-b-2 ${section === 'submissions' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
            Submissions{pendingSubmissions > 0 ? ` (${pendingSubmissions})` : ''}
          </button>
        </div>

        {section === 'questions' ? (
          <>
            <input
              type="text"
              placeholder="Search questions or categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />

            {deleteError && (
              <p className="text-rose-400 text-sm">{deleteError}</p>
            )}

            {loading ? (
              <div className="text-center text-slate-500 py-16">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center text-slate-500 py-16">
                {search ? 'No questions match your search.' : 'No questions yet. Add your first one above.'}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((q) => (
                  <div
                    key={q.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-4"
                  >
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CategoryBadge category={q.category} />
                        <DifficultyBadge difficulty={q.difficulty} />
                        {q.main_video_youtube_id && (
                          <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                            Video
                          </span>
                        )}
                        {q.ltspice_file_url && (
                          <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full">
                            LTspice
                          </span>
                        )}
                        {q.related_question_ids.length > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 border border-slate-600 rounded-full">
                            {q.related_question_ids.length} related
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 line-clamp-2">{q.question_text}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEdit(q)}
                        className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="text-xs px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-600/30 rounded-lg text-rose-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <SubmissionQueue onPendingCount={setPendingSubmissions} onQuestionApproved={fetchQuestions} />
        )}
      </main>

      {showForm && (
        <QuestionForm
          question={editingQuestion}
          allQuestions={questions}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
