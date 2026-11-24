#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  CONTENT_QUESTIONS_DIR,
  cleanString,
  loadMaterializedFingerprints,
  textToHtml,
} from './question-import-utils.mjs'

const args = parseArgs(process.argv.slice(2))
if (!args.input) {
  console.error('Usage: node scripts/materialize-question-batch.mjs content/imports/<batch>/questions.generated.json [--all|--slug slug] [--force]')
  process.exit(1)
}

const inputPath = resolve(args.input)
const batch = JSON.parse(readFileSync(inputPath, 'utf8'))
const existingFingerprints = loadMaterializedFingerprints()
mkdirSync(CONTENT_QUESTIONS_DIR, { recursive: true })

let written = 0
let skipped = 0

for (const row of batch.rows ?? []) {
  if (row.status === 'invalid') {
    skipped += 1
    continue
  }

  const selected = args.all || row.selected || args.slugs.has(row.slug)
  if (!selected) {
    skipped += 1
    continue
  }

  if (existingFingerprints.has(row.source_fingerprint) && !args.force) {
    console.log(`Skipping ${row.slug}; already materialized as ${existingFingerprints.get(row.source_fingerprint)}`)
    skipped += 1
    continue
  }

  const missingImages = Object.entries(row.images ?? {})
    .filter(([, image]) => !cleanString(image.output_path))
    .map(([key]) => key)
  if (missingImages.length) {
    throw new Error(`${row.slug} has unrendered image(s): ${missingImages.join(', ')}. Run render-question-images first.`)
  }

  const filePath = join(CONTENT_QUESTIONS_DIR, `${row.slug}.json`)
  if (existsSync(filePath) && !args.force) {
    console.log(`Skipping ${row.slug}; ${filePath} already exists`)
    skipped += 1
    continue
  }

  const images = Object.fromEntries(
    Object.entries(row.images ?? {}).map(([key, image]) => [key, image.output_path?.replace(/^\//, 'public/') ?? null])
  )

  const tags = unique([
    ...(row.question.tags ?? []),
    'source:excel',
    `import:${row.source_fingerprint}`,
  ])

  const question = {
    slug: row.slug,
    category: row.question.category,
    difficulty: row.question.difficulty,
    uploaded: false,
    supabase_id: null,
    source_fingerprint: row.source_fingerprint,
    source: {
      batch_id: batch.batch_id,
      source_file: batch.source_file,
      row_number: row.row_number,
    },
    images,
    question_text: textToHtml(row.question.question_text, row.images),
    answer_text: textToHtml(row.question.answer_text, row.images),
    explanation_text: textToHtml(row.question.explanation_text, row.images),
    bonus_question_text: textToHtml(row.question.bonus_question_text, row.images),
    bonus_answer_text: textToHtml(row.question.bonus_answer_text, row.images),
    main_video_youtube_id: row.question.main_video_youtube_id ?? null,
    resource_videos: row.question.resource_videos ?? [],
    ltspice_file_needed: row.question.ltspice_file_needed ?? null,
    tags,
    related_question_ids: [],
  }

  writeFileSync(filePath, `${JSON.stringify(question, null, 2)}\n`)
  console.log(`Wrote ${filePath}`)
  written += 1
}

console.log(`Done. Written: ${written}; skipped: ${skipped}`)

function parseArgs(argv) {
  const parsed = { input: null, all: false, force: false, slugs: new Set() }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--all') parsed.all = true
    else if (arg === '--force') parsed.force = true
    else if (arg === '--slug') parsed.slugs.add(argv[++i])
    else if (!parsed.input) parsed.input = arg
    else throw new Error(`Unexpected argument: ${arg}`)
  }
  return parsed
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}
