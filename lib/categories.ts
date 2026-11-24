export function splitCategories(category: string | null | undefined): string[] {
  const seen = new Set<string>()
  return String(category ?? '')
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function normalizeCategoryText(category: string | null | undefined): string {
  return splitCategories(category).join(', ')
}

export function questionMatchesCategory(category: string | null | undefined, filter: string | null): boolean {
  if (!filter) return true
  return splitCategories(category).some((item) => item === filter)
}
