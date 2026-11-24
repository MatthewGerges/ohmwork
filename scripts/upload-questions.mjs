/**
 * Runs in GitHub Actions on push to main when content/questions/*.json changes.
 * Images live in public/diagrams/ and are referenced as /diagrams/filename.png —
 * Vercel serves them as static files, so no Supabase storage upload needed.
 *
 * Required env vars (GitHub Secrets):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import nextEnv from '@next/env'
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const QUESTIONS_DIR = join(ROOT, 'content', 'questions')
const { loadEnvConfig } = nextEnv
loadEnvConfig(ROOT)

const files = readdirSync(QUESTIONS_DIR).filter((file) => file.endsWith('.json'))
if (!files.length) {
  console.log('No question files found.')
  process.exit(0)
}

const pendingFiles = files.filter((file) => {
  const question = JSON.parse(readFileSync(join(QUESTIONS_DIR, file), 'utf8'))
  return !question.uploaded
})
if (!pendingFiles.length) {
  console.log('No pending questions to upload.')
  process.exit(0)
}

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function processQuestion(filePath) {
  const q = JSON.parse(readFileSync(filePath, 'utf8'))

  if (q.uploaded) {
    console.log(`Skipping ${filePath} (already uploaded)`)
    return
  }

  console.log(`Processing: ${filePath}`)

  // Images are in public/diagrams/ and referenced as /diagrams/filename.png
  // Replace {{placeholder}} tokens with the public path
  const resolve = (text) =>
    text
      ? Object.entries(q.images ?? {}).reduce(
          (t, [placeholder, localPath]) =>
            t.replaceAll(`{{${placeholder}}}`, '/' + localPath.replace(/^public\//, '')),
          text
        )
      : text

  const resolvedQuestionText = resolve(q.question_text)
  const resolvedAnswerText = resolve(q.answer_text)
  const resolvedExplanationText = resolve(q.explanation_text)
  const resolvedBonusQuestionText = resolve(q.bonus_question_text)
  const resolvedBonusAnswerText = resolve(q.bonus_answer_text)
  const tags = Array.from(new Set([
    ...(q.tags ?? []),
    ...(q.source_fingerprint ? [`import:${q.source_fingerprint}`] : []),
  ]))

  const existing = await findExistingQuestion(q, resolvedQuestionText, tags)
  if (existing) {
    console.log(`  - Already exists in Supabase id=${existing.id}; marking local file uploaded`)
    q.uploaded = true
    q.supabase_id = existing.id
    writeFileSync(filePath, JSON.stringify(q, null, 2))
    return
  }

  const { data, error } = await supabase
    .from('questions')
    .insert({
      category: q.category,
      difficulty: q.difficulty,
      question_text: resolvedQuestionText,
      answer_text: resolvedAnswerText,
      explanation_text: resolvedExplanationText ?? null,
      bonus_question_text: resolvedBonusQuestionText ?? null,
      bonus_answer_text: resolvedBonusAnswerText ?? null,
      main_video_youtube_id: q.main_video_youtube_id ?? null,
      resource_videos: q.resource_videos ?? [],
      ltspice_file_url: q.ltspice_file_url ?? null,
      related_question_ids: q.related_question_ids ?? [],
      tags,
    })
    .select('id')
    .single()

  if (error) throw new Error(`DB insert failed: ${error.message}`)

  console.log(`  ✓ Inserted question id=${data.id}`)

  q.uploaded = true
  q.supabase_id = data.id
  writeFileSync(filePath, JSON.stringify(q, null, 2))
}

async function findExistingQuestion(q, resolvedQuestionText, tags) {
  const importTag = tags.find((tag) => tag.startsWith('import:'))
  if (importTag) {
    const { data, error } = await supabase
      .from('questions')
      .select('id')
      .contains('tags', [importTag])
      .limit(1)

    if (error) throw new Error(`DB duplicate check failed: ${error.message}`)
    if (data?.[0]) return data[0]
  }

  const { data, error } = await supabase
    .from('questions')
    .select('id')
    .eq('category', q.category)
    .eq('question_text', resolvedQuestionText)
    .limit(1)

  if (error) throw new Error(`DB duplicate check failed: ${error.message}`)
  return data?.[0] ?? null
}

for (const file of pendingFiles) {
  await processQuestion(join(QUESTIONS_DIR, file))
}
console.log('Done.')
