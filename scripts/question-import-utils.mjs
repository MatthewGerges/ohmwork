import crypto from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const CONTENT_QUESTIONS_DIR = join(ROOT, 'content', 'questions')

const IMAGE_TOKEN_RE = /\{\{image_(\d+)\}\}/gi
const IMAGE_MARKER_RE = /(?:<|\[|\()\s*image\s*(\d+|one|two|three|four|five|six|seven)\s*(?:>|\]|\))/gi

const WORD_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
}

export function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function cleanString(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\r\n/g, '\n').trim()
}

export function normalizeForHash(value) {
  return cleanString(value).replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeDifficulty(value) {
  const difficulty = normalizeForHash(value)
  if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
    return difficulty
  }
  return 'medium'
}

export function isTruthySelection(value) {
  const normalized = normalizeForHash(value)
  return ['1', 'true', 'yes', 'y', 'x', 'use', 'selected', 'import', 'upload'].includes(normalized)
}

export function slugify(value, maxLength = 70) {
  const slug = normalizeForHash(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
  return slug || 'question'
}

export function hashPayload(payload, length = 16) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(payload)))
    .digest('hex')
    .slice(0, length)
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, stableValue(nested)])
  )
}

export function replaceImageMarkers(text) {
  return cleanString(text).replace(IMAGE_MARKER_RE, (_match, rawNumber) => {
    const key = String(rawNumber).toLowerCase()
    const n = WORD_NUMBERS[key] ?? Number(key)
    return Number.isFinite(n) ? `{{image_${n}}}` : _match
  })
}

export function findImageTokens(...texts) {
  const found = new Set()
  for (const text of texts) {
    const value = cleanString(text)
    for (const match of value.matchAll(IMAGE_TOKEN_RE)) {
      found.add(`image_${match[1]}`)
    }
  }
  return [...found].sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1]))
}

export function parseResourceVideos(value) {
  const raw = cleanString(value)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return raw
      .split(/\n|;/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [title, youtubeId] = line.split('|').map((part) => part?.trim())
        return title && youtubeId ? { title, youtube_id: youtubeId } : null
      })
      .filter(Boolean)
  }
}

export function parseTags(value) {
  return cleanString(value)
    .split(/[,;\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function parseCategories(...values) {
  const seen = new Set()
  return values
    .flatMap((value) => cleanString(value).split(/[,;|]/))
    .map((category) => category.trim())
    .filter(Boolean)
    .filter((category) => {
      const key = normalizeForHash(category)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function formatCategories(categories) {
  return parseCategories(...categories).join(', ')
}

export function textToHtml(text, imageSpecs = {}) {
  const raw = replaceImageMarkers(text)
  if (!raw) return null
  if (/<\/?[a-z][\s\S]*>/i.test(raw) && !raw.includes('{{image_')) return raw

  const escaped = escapeHtml(raw)
  const withImages = escaped.replace(IMAGE_TOKEN_RE, (_match, n) => {
    const key = `image_${n}`
    const image = imageSpecs[key]
    const alt = escapeHtml(image?.alt || image?.title || image?.prompt || key)
    return `\n\n<img src="{{${key}}}" alt="${alt}" style="max-width:100%;margin:1rem 0;border-radius:6px;"/>\n\n`
  })

  return withImages
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('<img ')) return part
      return `<p>${part.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')
}

export function escapeHtml(value) {
  return cleanString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function publicPathFromFile(filePath) {
  return filePath.replace(/^public\//, '/')
}

export function loadMaterializedFingerprints() {
  const fingerprints = new Map()
  let files = []
  try {
    files = readdirSync(CONTENT_QUESTIONS_DIR).filter((file) => file.endsWith('.json'))
  } catch {
    return fingerprints
  }

  for (const file of files) {
    try {
      const path = join(CONTENT_QUESTIONS_DIR, file)
      const question = JSON.parse(readFileSync(path, 'utf8'))
      if (question.source_fingerprint) {
        fingerprints.set(question.source_fingerprint, file)
      }
    } catch {
      // Ignore malformed drafts; validation happens in the upload script.
    }
  }
  return fingerprints
}
