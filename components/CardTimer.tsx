'use client'

import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'

export function CardTimer() {
  const [elapsed, setElapsed] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const running = startedAt !== null

  useEffect(() => {
    if (startedAt === null) return
    const interval = window.setInterval(() => setElapsed(performance.now() - startedAt), 200)
    return () => window.clearInterval(interval)
  }, [startedAt])

  const seconds = Math.floor(elapsed / 1000)
  const display = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const controlClass = 'grid size-8 place-items-center rounded-md text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <div role="group" aria-label="Card timer" className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-1">
      <Timer className="ml-1 size-4 text-slate-400" aria-hidden="true" />
      <span role="timer" aria-label="Elapsed time" className="min-w-12 px-0.5 text-center text-sm tabular-nums text-slate-200">{display}</span>
      <button type="button" aria-label={running ? 'Pause timer' : 'Start timer'} title={running ? 'Pause timer' : 'Start timer'} className={controlClass} onClick={() => {
        if (startedAt === null) setStartedAt(performance.now() - elapsed)
        else {
          setElapsed(performance.now() - startedAt)
          setStartedAt(null)
        }
      }}>
        {running ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
      </button>
      <button type="button" aria-label="Reset timer" title="Reset timer" disabled={!running && elapsed === 0} className={controlClass} onClick={() => {
        setStartedAt(null)
        setElapsed(0)
      }}><RotateCcw className="size-4" aria-hidden="true" /></button>
    </div>
  )
}
