import { Difficulty } from '@/lib/types'

const STYLES: Record<Difficulty, string> = {
  easy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hard: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${STYLES[difficulty]}`}>
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </span>
  )
}
