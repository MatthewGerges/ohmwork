export type Difficulty = 'easy' | 'medium' | 'hard'

export interface ResourceVideo {
  title: string
  youtube_id: string
}

export interface Question {
  id: number
  created_at: string
  category: string
  difficulty: Difficulty
  question_text: string
  answer_text: string
  explanation_text: string | null
  main_video_youtube_id: string | null
  resource_videos: ResourceVideo[]
  ltspice_file_url: string | null
  related_question_ids: number[]
  tags: string[]
  bonus_question_text: string | null
  bonus_answer_text: string | null
}

export interface ProgressEntry {
  next_review_date: string
  interval_days: number
  review_count: number
  last_reviewed_at?: string
  last_rating?: Difficulty
}

export type ProgressStore = Record<number, ProgressEntry>

export interface QuestionSubmission {
  id: number
  created_at: string
  updated_at: string
  user_id: string
  submitter_email: string | null
  status: 'pending' | 'approved' | 'rejected'
  category: string
  difficulty: Difficulty
  question_text: string
  answer_text: string
  explanation_text: string | null
  bonus_question_text: string | null
  bonus_answer_text: string | null
  interview_context: string | null
  admin_notes: string | null
  reviewed_at: string | null
  approved_question_id: number | null
}
