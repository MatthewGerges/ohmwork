import { splitCategories } from '@/lib/categories'

const COLOR_CLASSES = [
  'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'bg-sky-500/20 text-sky-400 border-sky-500/30',
  'bg-lime-500/20 text-lime-400 border-lime-500/30',
]

function getCategoryColor(category: string): string {
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) % COLOR_CLASSES.length
  }
  return COLOR_CLASSES[Math.abs(hash)]
}

export function CategoryBadge({ category, labels }: { category: string; labels?: readonly string[] }) {
  const categories = labels ?? splitCategories(category)

  if (categories.length === 0) return null

  return (
    <>
      {categories.map((item) => (
        <span key={item} className={`px-3 py-1 rounded-full text-xs font-medium border ${getCategoryColor(item)}`}>
          {item}
        </span>
      ))}
    </>
  )
}
