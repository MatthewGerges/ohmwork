import { supabase } from './supabase'

interface QueueRow {
  question_id: number
}

export async function syncUserQueue(userId: string, localIds: number[]): Promise<number[]> {
  const { data, error } = await supabase
    .from('user_question_queue')
    .select('question_id')
    .order('created_at', { ascending: true })

  if (error) throw error

  const remoteIds = ((data ?? []) as QueueRow[]).map((row) => row.question_id)
  const merged = Array.from(new Set([...remoteIds, ...localIds]))
  const missingRemoteIds = merged.filter((id) => !remoteIds.includes(id))

  if (missingRemoteIds.length > 0) {
    const { error: insertError } = await supabase.from('user_question_queue').insert(
      missingRemoteIds.map((questionId) => ({ user_id: userId, question_id: questionId }))
    )
    if (insertError) throw insertError
  }

  return merged
}

export async function setUserQueueItem(userId: string, questionId: number, queued: boolean): Promise<void> {
  if (queued) {
    const { error } = await supabase.from('user_question_queue').upsert({
      user_id: userId,
      question_id: questionId,
    }, { onConflict: 'user_id,question_id', ignoreDuplicates: true })
    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('user_question_queue')
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId)
  if (error) throw error
}
