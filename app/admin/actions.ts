'use server'

import { redirect } from 'next/navigation'
import { normalizeCategoryText } from '@/lib/categories'
import { createAdminClient } from '@/lib/supabase-admin'
import { clearAdminSession, createAdminSession, isAdminAuthenticated } from '@/lib/admin-auth'
import { Difficulty, QuestionSubmission } from '@/lib/types'

export async function loginAction(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const password = formData.get('password') as string

  if (!password || !process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return { error: 'Invalid password' }
  }

  await createAdminSession()

  redirect('/admin')
}

export async function logoutAction(): Promise<void> {
  await clearAdminSession()
  redirect('/admin')
}

export async function addQuestionAction(
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  if (!(await isAdminAuthenticated())) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  let ltspice_file_url: string | null = null
  const ltspiceFile = formData.get('ltspice_file') as File | null
  if (ltspiceFile && ltspiceFile.size > 0) {
    const fileName = `${Date.now()}-${ltspiceFile.name}`
    const buffer = Buffer.from(await ltspiceFile.arrayBuffer())
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ltspice-files')
      .upload(fileName, buffer, { contentType: 'application/octet-stream' })

    if (uploadError) return { error: `File upload failed: ${uploadError.message}` }

    const { data: urlData } = supabase.storage.from('ltspice-files').getPublicUrl(uploadData.path)
    ltspice_file_url = urlData.publicUrl
  }

  let resource_videos = []
  try { resource_videos = JSON.parse(formData.get('resource_videos') as string || '[]') } catch { /* */ }

  let related_question_ids: number[] = []
  try { related_question_ids = JSON.parse(formData.get('related_question_ids') as string || '[]') } catch { /* */ }

  const { error } = await supabase.from('questions').insert({
    category: normalizeCategoryText(formData.get('category') as string),
    difficulty: formData.get('difficulty') as Difficulty,
    question_text: (formData.get('question_text') as string).trim(),
    answer_text: (formData.get('answer_text') as string).trim(),
    explanation_text: (formData.get('explanation_text') as string)?.trim() || null,
    main_video_youtube_id: (formData.get('main_video_youtube_id') as string)?.trim() || null,
    resource_videos,
    ltspice_file_url,
    related_question_ids,
    tags: [],
    bonus_question_text: (formData.get('bonus_question_text') as string)?.trim() || null,
    bonus_answer_text: (formData.get('bonus_answer_text') as string)?.trim() || null,
  })

  if (error) return { error: error.message }
  return {}
}

export async function updateQuestionAction(
  id: number,
  _prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  if (!(await isAdminAuthenticated())) return { error: 'Unauthorized' }

  const supabase = createAdminClient()

  let ltspice_file_url: string | null = (formData.get('existing_ltspice_url') as string) || null
  const ltspiceFile = formData.get('ltspice_file') as File | null
  if (ltspiceFile && ltspiceFile.size > 0) {
    const fileName = `${Date.now()}-${ltspiceFile.name}`
    const buffer = Buffer.from(await ltspiceFile.arrayBuffer())
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('ltspice-files')
      .upload(fileName, buffer, { contentType: 'application/octet-stream' })

    if (uploadError) return { error: `File upload failed: ${uploadError.message}` }

    const { data: urlData } = supabase.storage.from('ltspice-files').getPublicUrl(uploadData.path)
    ltspice_file_url = urlData.publicUrl
  }

  let resource_videos = []
  try { resource_videos = JSON.parse(formData.get('resource_videos') as string || '[]') } catch { /* */ }

  let related_question_ids: number[] = []
  try { related_question_ids = JSON.parse(formData.get('related_question_ids') as string || '[]') } catch { /* */ }

  const { error } = await supabase.from('questions').update({
    category: normalizeCategoryText(formData.get('category') as string),
    difficulty: formData.get('difficulty') as Difficulty,
    question_text: (formData.get('question_text') as string).trim(),
    answer_text: (formData.get('answer_text') as string).trim(),
    explanation_text: (formData.get('explanation_text') as string)?.trim() || null,
    main_video_youtube_id: (formData.get('main_video_youtube_id') as string)?.trim() || null,
    resource_videos,
    ltspice_file_url,
    related_question_ids,
    bonus_question_text: (formData.get('bonus_question_text') as string)?.trim() || null,
    bonus_answer_text: (formData.get('bonus_answer_text') as string)?.trim() || null,
  }).eq('id', id)

  if (error) return { error: error.message }
  return {}
}

export async function deleteQuestionAction(id: number): Promise<{ error?: string }> {
  if (!(await isAdminAuthenticated())) return { error: 'Unauthorized' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('questions').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function getSubmissionsAction(): Promise<{ data?: QuestionSubmission[]; error?: string }> {
  if (!(await isAdminAuthenticated())) return { error: 'Unauthorized' }
  const { data, error } = await createAdminClient()
    .from('question_submissions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: (data as QuestionSubmission[]) ?? [] }
}

function cleanRequired(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function cleanOptional(formData: FormData, key: string): string | null {
  return cleanRequired(formData, key) || null
}

function plainTextToHtml(value: string | null): string | null {
  if (!value) return null
  const escaped = value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
  return escaped
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${paragraph.replaceAll('\n', '<br/>')}</p>`)
    .join('\n')
}

export async function approveSubmissionAction(
  id: number,
  _prevState: { error?: string; success?: boolean },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  if (!(await isAdminAuthenticated())) return { error: 'Unauthorized' }
  const category = normalizeCategoryText(cleanRequired(formData, 'category'))
  const difficulty = cleanRequired(formData, 'difficulty')
  const questionText = cleanRequired(formData, 'question_text')
  const answerText = cleanRequired(formData, 'answer_text')
  if (!category || !questionText || !answerText || !['easy', 'medium', 'hard'].includes(difficulty)) {
    return { error: 'Category, difficulty, question, and answer are required.' }
  }

  const supabase = createAdminClient()
  const { data: submission, error: fetchError } = await supabase
    .from('question_submissions')
    .select('status')
    .eq('id', id)
    .single()
  if (fetchError) return { error: fetchError.message }
  if (submission.status !== 'pending') return { error: 'This submission has already been reviewed.' }

  const { data: question, error: insertError } = await supabase
    .from('questions')
    .insert({
      category,
      difficulty: difficulty as Difficulty,
      question_text: plainTextToHtml(questionText) ?? '',
      answer_text: plainTextToHtml(answerText) ?? '',
      explanation_text: plainTextToHtml(cleanOptional(formData, 'explanation_text')),
      bonus_question_text: plainTextToHtml(cleanOptional(formData, 'bonus_question_text')),
      bonus_answer_text: plainTextToHtml(cleanOptional(formData, 'bonus_answer_text')),
      main_video_youtube_id: null,
      resource_videos: [],
      ltspice_file_url: null,
      related_question_ids: [],
      tags: [`community-submission:${id}`],
    })
    .select('id')
    .single()
  if (insertError) return { error: insertError.message }

  const { error: updateError } = await supabase
    .from('question_submissions')
    .update({
      status: 'approved',
      category,
      difficulty: difficulty as Difficulty,
      question_text: questionText,
      answer_text: answerText,
      explanation_text: cleanOptional(formData, 'explanation_text'),
      bonus_question_text: cleanOptional(formData, 'bonus_question_text'),
      bonus_answer_text: cleanOptional(formData, 'bonus_answer_text'),
      admin_notes: cleanOptional(formData, 'admin_notes'),
      reviewed_at: new Date().toISOString(),
      approved_question_id: question.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    await supabase.from('questions').delete().eq('id', question.id)
    return { error: updateError.message }
  }
  return { success: true }
}

export async function rejectSubmissionAction(
  id: number,
  adminNotes: string
): Promise<{ error?: string }> {
  if (!(await isAdminAuthenticated())) return { error: 'Unauthorized' }
  const { error } = await createAdminClient()
    .from('question_submissions')
    .update({
      status: 'rejected',
      admin_notes: adminNotes.trim() || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
  return error ? { error: error.message } : {}
}
