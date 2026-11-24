'use client'

import { useRef, useState, useActionState } from 'react'
import { Question, ResourceVideo } from '@/lib/types'
import { normalizeCategoryText, splitCategories } from '@/lib/categories'
import { addQuestionAction, updateQuestionAction } from './actions'
import { RichTextInput } from '@/components/RichTextInput'

interface Props {
  question: Question | null
  allQuestions: Question[]
  onClose: (refresh: boolean) => void
}

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const

export function QuestionForm({ question, allQuestions, onClose }: Props) {
  const isEdit = Boolean(question)

  const [category, setCategory] = useState(normalizeCategoryText(question?.category ?? ''))
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(question?.difficulty ?? 'medium')
  const [questionText, setQuestionText] = useState(question?.question_text ?? '')
  const [answerText, setAnswerText] = useState(question?.answer_text ?? '')
  const [explanationText, setExplanationText] = useState(question?.explanation_text ?? '')
  const [bonusQuestionText, setBonusQuestionText] = useState(question?.bonus_question_text ?? '')
  const [bonusAnswerText, setBonusAnswerText] = useState(question?.bonus_answer_text ?? '')
  const [youtubeId, setYoutubeId] = useState(question?.main_video_youtube_id ?? '')
  const [resourceVideos, setResourceVideos] = useState<ResourceVideo[]>(question?.resource_videos ?? [])
  const [relatedIds, setRelatedIds] = useState<number[]>(question?.related_question_ids ?? [])
  const [ltspiceFile, setLtspiceFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const boundUpdate = question
    ? updateQuestionAction.bind(null, question.id)
    : null

  const [addState, addAction, addPending] = useActionState(addQuestionAction, {})
  const [updateState, updateAction, updatePending] = useActionState(
    boundUpdate ?? addQuestionAction,
    {}
  )

  const state = isEdit ? updateState : addState
  const pending = isEdit ? updatePending : addPending

  const existingCategories = Array.from(new Set(allQuestions.flatMap((q) => splitCategories(q.category)))).sort()
  const otherQuestions = allQuestions.filter((q) => q.id !== question?.id)

  function addResourceVideo() {
    setResourceVideos((v) => [...v, { title: '', youtube_id: '' }])
  }

  function updateResourceVideo(i: number, field: keyof ResourceVideo, value: string) {
    setResourceVideos((v) => v.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)))
  }

  function removeResourceVideo(i: number) {
    setResourceVideos((v) => v.filter((_, idx) => idx !== i))
  }

  function toggleRelated(id: number) {
    setRelatedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const normalizedCategory = normalizeCategoryText(category)
    if (!normalizedCategory || !questionText.trim() || !answerText.trim()) return

    const formData = new FormData(e.currentTarget)
    formData.set('category', normalizedCategory)
    formData.set('question_text', questionText) // contenteditable fields aren't captured by FormData automatically
    formData.set('answer_text', answerText)
    formData.set('explanation_text', explanationText)
    formData.set('bonus_question_text', bonusQuestionText)
    formData.set('bonus_answer_text', bonusAnswerText)
    formData.set('resource_videos', JSON.stringify(resourceVideos.filter((v) => v.title && v.youtube_id)))
    formData.set('related_question_ids', JSON.stringify(relatedIds))
    if (ltspiceFile) formData.set('ltspice_file', ltspiceFile)
    if (isEdit && question?.ltspice_file_url) {
      formData.set('existing_ltspice_url', question.ltspice_file_url)
    }

    const action = isEdit ? updateAction : addAction
    await action(formData)

    if (!state?.error) onClose(true)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-end">
      <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-700 overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? 'Edit Question' : 'New Question'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1">
          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">Categories *</label>
            <input
              list="categories-list"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Transmission Line Theory, PCB"
              required
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <datalist id="categories-list">
              {existingCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
            <p className="text-xs text-slate-600">
              Separate multiple categories with commas.
            </p>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">Difficulty *</label>
            <input type="hidden" name="difficulty" value={difficulty} />
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors capitalize ${
                    difficulty === d
                      ? d === 'easy'
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400'
                        : d === 'medium'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-400'
                        : 'bg-rose-600/30 border-rose-500 text-rose-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Question */}
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">
              Question *{' '}
              <span className="text-slate-600 font-normal">— paste images with ⌘V</span>
            </label>
            <RichTextInput
              value={questionText}
              onChange={setQuestionText}
              placeholder="What is the voltage transfer ratio of a buck converter in CCM?"
              rows={4}
              className="w-full"
            />
          </div>

          {/* Answer */}
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">
              Answer *{' '}
              <span className="text-slate-600 font-normal">— paste images with ⌘V</span>
            </label>
            <RichTextInput
              value={answerText}
              onChange={setAnswerText}
              placeholder="Vout/Vin = D, where D is the duty cycle…"
              rows={6}
              className="w-full"
            />
          </div>

          {/* Explanation */}
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">
              Explanation <span className="text-slate-600">(optional)</span>{' '}
              <span className="text-slate-600 font-normal">— shown in a dropdown after the answer</span>
            </label>
            <RichTextInput
              value={explanationText}
              onChange={setExplanationText}
              placeholder="Longer walkthrough of the answer…"
              rows={5}
              className="w-full"
            />
          </div>

          {/* Bonus section */}
          <div className="border-t border-slate-700/60 pt-5 space-y-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Bonus (optional)</p>

            <div className="space-y-1.5">
              <label className="text-sm text-slate-400">
                Bonus Question <span className="text-slate-600 font-normal">— paste images with ⌘V</span>
              </label>
              <RichTextInput
                value={bonusQuestionText}
                onChange={setBonusQuestionText}
                placeholder="Bonus: how does V_R change as you vary the pulse timing?"
                rows={3}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-slate-400">
                Bonus Answer <span className="text-slate-600 font-normal">— paste images with ⌘V</span>
              </label>
              <RichTextInput
                value={bonusAnswerText}
                onChange={setBonusAnswerText}
                placeholder="If the pulse is much shorter than τ = RC, the capacitor barely charges…"
                rows={4}
                className="w-full"
              />
            </div>
          </div>

          {/* YouTube ID */}
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">
              YouTube Video ID{' '}
              <span className="text-slate-600">(optional)</span>
            </label>
            <input
              name="main_video_youtube_id"
              value={youtubeId}
              onChange={(e) => setYoutubeId(e.target.value)}
              placeholder="dQw4w9WgXcQ"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono text-sm"
            />
            <p className="text-xs text-slate-600">
              From youtube.com/watch?v=<span className="text-slate-500">THIS_PART</span>
            </p>
          </div>

          {/* Resource videos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-400">
                Resource Videos <span className="text-slate-600">(optional)</span>
              </label>
              <button
                type="button"
                onClick={addResourceVideo}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                + Add
              </button>
            </div>
            {resourceVideos.map((v, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={v.title}
                  onChange={(e) => updateResourceVideo(i, 'title', e.target.value)}
                  placeholder="Title"
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
                <input
                  value={v.youtube_id}
                  onChange={(e) => updateResourceVideo(i, 'youtube_id', e.target.value)}
                  placeholder="YouTube ID"
                  className="w-28 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => removeResourceVideo(i)}
                  className="text-slate-500 hover:text-rose-400 transition-colors px-1 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* LTspice file */}
          <div className="space-y-1.5">
            <label className="text-sm text-slate-400">
              LTspice File <span className="text-slate-600">(optional, .asc)</span>
            </label>
            {question?.ltspice_file_url && !ltspiceFile && (
              <p className="text-xs text-emerald-400">
                Current: {question.ltspice_file_url.split('/').pop()}
              </p>
            )}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-3 bg-slate-800 border border-dashed border-slate-600 rounded-xl text-slate-500 text-sm cursor-pointer hover:border-slate-500 text-center transition-colors"
            >
              {ltspiceFile ? ltspiceFile.name : 'Click to upload .asc file'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".asc,.raw"
              onChange={(e) => setLtspiceFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>

          {/* Related questions */}
          {otherQuestions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm text-slate-400">
                Related Questions <span className="text-slate-600">(optional)</span>
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-800/50 rounded-xl p-2 border border-slate-700">
                {otherQuestions.map((q) => (
                  <label
                    key={q.id}
                    className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={relatedIds.includes(q.id)}
                      onChange={() => toggleRelated(q.id)}
                      className="mt-0.5 accent-indigo-500"
                    />
                    <span className="text-xs text-slate-300 leading-relaxed">{q.question_text}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {state?.error && (
            <p className="text-rose-400 text-sm">{state.error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 pb-4">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !normalizeCategoryText(category) || !questionText.trim() || !answerText.trim()}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
            >
              {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
