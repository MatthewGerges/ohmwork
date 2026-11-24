import { StudySession } from '@/components/StudySession'

type DeckMode = 'all' | 'easy' | 'medium' | 'hard' | 'queue'

const DECK_MODES: DeckMode[] = ['all', 'easy', 'medium', 'hard', 'queue']

export default async function Home({ searchParams }: { searchParams: Promise<{ deck?: string }> }) {
  const { deck } = await searchParams
  const initialDeck: DeckMode = DECK_MODES.includes(deck as DeckMode) ? (deck as DeckMode) : 'all'
  return <StudySession initialDeck={initialDeck} />
}
