'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bookmark } from 'lucide-react'
import { Question } from '@/lib/types'
import { CategoryBadge } from './CategoryBadge'
import { getStudyTopics } from '@/lib/study-topics'
import { getCircuitResources } from '@/lib/circuit-resources'
import { DifficultyBadge } from './DifficultyBadge'
import { RichHtmlContent } from './RichHtmlContent'
import { CircuitLabResources } from './CircuitLabResources'

interface Props {
  question: Question
  relatedQuestions: Question[]
  onRate: (rating: 'easy' | 'medium' | 'hard') => void
  onSkip: () => void
  onGoToQuestion: (id: number) => void
  onAddToQueue: (id: number) => void
  queuedIds: number[]
  initiallyFlipped?: boolean
  reviewMode?: boolean
}

export function FlashCard({ question, relatedQuestions, onRate, onSkip, onGoToQuestion, onAddToQueue, queuedIds, initiallyFlipped = false, reviewMode = false }: Props) {
  const [flipped, setFlipped] = useState(initiallyFlipped)

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait" initial={false}>
        {!flipped ? (
          <motion.div
            key="front"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            onClick={() => setFlipped(true)}
            className="bg-slate-900 border border-slate-700 rounded-lg p-4 sm:p-8 cursor-pointer hover:border-cyan-500/60 active:border-cyan-500/60 transition-colors min-h-48 sm:min-h-64 flex flex-col select-none touch-manipulation"
          >
            <div className="flex items-center justify-between gap-3 mb-6">
              <CategoryBadge category={question.category} labels={getStudyTopics(question)} />
              <div className="flex items-center gap-2">
                {!reviewMode && <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onAddToQueue(question.id)
                  }}
                  aria-pressed={queuedIds.includes(question.id)}
                  aria-label={queuedIds.includes(question.id) ? 'Remove from Queue' : 'Add to Queue'}
                  title={queuedIds.includes(question.id) ? 'Remove from Queue' : 'Add to Queue'}
                  className={`grid size-9 place-items-center rounded-md border transition-colors ${
                    queuedIds.includes(question.id)
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  <Bookmark className={`size-4 ${queuedIds.includes(question.id) ? 'fill-current' : ''}`} />
                </button>}
                <DifficultyBadge difficulty={question.difficulty} />
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
              <RichHtmlContent
                html={question.question_text}
                className="text-lg sm:text-xl text-slate-100 text-center leading-relaxed [&_img]:max-w-full [&_img]:rounded-xl [&_img]:mx-auto [&_img]:mt-2"
              />
            </div>

            <div className="mt-6 text-center">
              <span className="text-xs text-slate-600 uppercase tracking-widest">
                Tap to reveal answer
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="back"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-900 border border-slate-700 rounded-lg p-4 sm:p-8 space-y-4 sm:space-y-6"
          >
            <div className="flex items-center justify-between">
              <CategoryBadge category={question.category} labels={getStudyTopics(question)} />
              <div className="flex items-center gap-2">
                {reviewMode && (
                  <button
                    type="button"
                    onClick={() => setFlipped(false)}
                    className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:border-slate-500 transition-colors"
                  >
                    Question
                  </button>
                )}
                <DifficultyBadge difficulty={question.difficulty} />
              </div>
            </div>

            {/* Answer */}
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Answer</p>
              <RichHtmlContent
                html={question.answer_text}
                className="text-lg text-slate-100 leading-relaxed [&_img]:max-w-full [&_img]:rounded-xl [&_img]:mt-2"
              />
            </div>

            {/* Written explanation */}
            {question.explanation_text && (
              <details className="group border border-slate-700 rounded-xl overflow-hidden">
                <summary className="px-4 py-3 text-sm text-slate-300 cursor-pointer hover:bg-slate-800/60 select-none list-none flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Explanation</span>
                  <span className="text-xs text-indigo-400 shrink-0">
                    <span className="group-open:hidden">Show ▼</span>
                    <span className="hidden group-open:inline">Hide ▲</span>
                  </span>
                </summary>
                <RichHtmlContent
                  html={question.explanation_text}
                  className="px-4 pb-4 text-base text-slate-300 leading-relaxed border-t border-slate-800 [&_img]:max-w-full [&_img]:rounded-xl [&_img]:mt-2"
                />
              </details>
            )}

            {/* Explanation video */}
            {question.main_video_youtube_id && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Explanation</p>
                <div className="aspect-video rounded-xl overflow-hidden bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${question.main_video_youtube_id}`}
                    className="w-full h-full"
                    allowFullScreen
                    title="Explanation video"
                  />
                </div>
              </div>
            )}

            {/* Resource videos */}
            {question.resource_videos.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Resources</p>
                <div className="space-y-2">
                  {question.resource_videos.map((v, i) => (
                    <a
                      key={i}
                      href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
                    >
                      <span className="text-red-500 text-xs">▶</span>
                      {v.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <CircuitLabResources question={question} />

            {/* Bonus */}
            {question.bonus_question_text && (
              <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-xl p-4 space-y-3">
                <p className="text-xs text-indigo-400 uppercase tracking-wider font-medium">Bonus</p>
                <RichHtmlContent
                  html={question.bonus_question_text}
                  className="text-base text-slate-200 leading-relaxed [&_img]:max-w-full [&_img]:rounded-xl [&_img]:mt-2"
                />
                {question.bonus_answer_text && (
                  <details className="group">
                    <summary className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300 select-none list-none flex items-center gap-1">
                      <span className="group-open:hidden">▶ Show bonus answer</span>
                      <span className="hidden group-open:inline">▼ Hide bonus answer</span>
                    </summary>
                    <RichHtmlContent
                      html={question.bonus_answer_text}
                      className="mt-3 text-base text-slate-300 leading-relaxed [&_img]:max-w-full [&_img]:rounded-xl [&_img]:mt-2"
                    />
                  </details>
                )}
              </div>
            )}

            {/* Related concepts */}
            {!reviewMode && relatedQuestions.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Related Concepts</p>
                <div className="space-y-2">
                  {relatedQuestions.map((rq) => (
                    <div key={rq.id} className="flex items-center gap-2 p-3 bg-slate-800 rounded-xl">
                      <span className="flex-1 text-sm text-slate-300 truncate">
                        {(question.tags.includes('filter-response-pair') || rq.tags.includes('filter-response-pair'))
                          ? (getCircuitResources(rq)[0]?.title ?? rq.question_text)
                          : rq.question_text}
                      </span>
                      <button
                        onClick={() => onGoToQuestion(rq.id)}
                        className="text-xs px-2 py-1 bg-indigo-600/30 text-indigo-400 rounded-lg hover:bg-indigo-600/50 transition-colors whitespace-nowrap"
                      >
                        Go to
                      </button>
                      <button
                        onClick={() => onAddToQueue(rq.id)}
                        aria-pressed={queuedIds.includes(rq.id)}
                        className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                          queuedIds.includes(rq.id)
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                      >
                        {queuedIds.includes(rq.id) ? 'Queued' : 'Queue'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rating buttons */}
            {!reviewMode && <div className="pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 text-center">
                How well did you know it? File it into a deck
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  onClick={() => onRate('easy')}
                  className="rounded-lg border border-emerald-600/40 bg-emerald-600/20 py-3 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-600/40 touch-manipulation"
                >
                  <span className="block">Easy</span>
                </button>
                <button
                  onClick={() => onRate('medium')}
                  className="rounded-lg border border-amber-600/40 bg-amber-600/20 py-3 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-600/40 touch-manipulation"
                >
                  <span className="block">Medium</span>
                </button>
                <button
                  onClick={() => onRate('hard')}
                  className="rounded-lg border border-rose-600/40 bg-rose-600/20 py-3 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-600/40 touch-manipulation"
                >
                  <span className="block">Hard</span>
                </button>
                <button
                  onClick={onSkip}
                  className="rounded-lg border border-slate-700 bg-slate-800/60 py-3 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-700/60 touch-manipulation"
                >
                  <span className="block">Skip</span>
                </button>
              </div>
            </div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
