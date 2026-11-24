export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' }
  public: {
    Tables: {
      questions: {
        Row: {
          id: number
          created_at: string
          category: string
          difficulty: 'easy' | 'medium' | 'hard'
          question_text: string
          answer_text: string
          explanation_text: string | null
          main_video_youtube_id: string | null
          resource_videos: { title: string; youtube_id: string }[]
          ltspice_file_url: string | null
          related_question_ids: number[]
          tags: string[]
          bonus_question_text: string | null
          bonus_answer_text: string | null
        }
        Insert: {
          id?: never
          created_at?: string
          category: string
          difficulty: 'easy' | 'medium' | 'hard'
          question_text: string
          answer_text: string
          explanation_text?: string | null
          main_video_youtube_id?: string | null
          resource_videos?: { title: string; youtube_id: string }[]
          ltspice_file_url?: string | null
          related_question_ids?: number[]
          tags?: string[]
          bonus_question_text?: string | null
          bonus_answer_text?: string | null
        }
        Update: Partial<Database['public']['Tables']['questions']['Insert']>
        Relationships: []
      }
      user_question_progress: {
        Row: {
          user_id: string
          question_id: number
          next_review_date: string
          interval_days: number
          review_count: number
          last_reviewed_at: string | null
          last_rating: 'easy' | 'medium' | 'hard' | null
          updated_at: string
        }
        Insert: {
          user_id: string
          question_id: number
          next_review_date: string
          interval_days: number
          review_count?: number
          last_reviewed_at?: string | null
          last_rating?: 'easy' | 'medium' | 'hard' | null
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_question_progress']['Insert']>
        Relationships: [{
          foreignKeyName: 'user_question_progress_question_id_fkey'
          columns: ['question_id']
          isOneToOne: false
          referencedRelation: 'questions'
          referencedColumns: ['id']
        }]
      }
      user_question_queue: {
        Row: {
          user_id: string
          question_id: number
          created_at: string
        }
        Insert: {
          user_id: string
          question_id: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_question_queue']['Insert']>
        Relationships: [{
          foreignKeyName: 'user_question_queue_question_id_fkey'
          columns: ['question_id']
          isOneToOne: false
          referencedRelation: 'questions'
          referencedColumns: ['id']
        }]
      }
      question_submissions: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          user_id: string
          submitter_email: string | null
          status: 'pending' | 'approved' | 'rejected'
          category: string
          difficulty: 'easy' | 'medium' | 'hard'
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
        Insert: {
          id?: never
          created_at?: string
          updated_at?: string
          user_id: string
          submitter_email?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          category: string
          difficulty: 'easy' | 'medium' | 'hard'
          question_text: string
          answer_text: string
          explanation_text?: string | null
          bonus_question_text?: string | null
          bonus_answer_text?: string | null
          interview_context?: string | null
          admin_notes?: string | null
          reviewed_at?: string | null
          approved_question_id?: number | null
        }
        Update: Partial<Database['public']['Tables']['question_submissions']['Insert']>
        Relationships: [{
          foreignKeyName: 'question_submissions_approved_question_id_fkey'
          columns: ['approved_question_id']
          isOneToOne: false
          referencedRelation: 'questions'
          referencedColumns: ['id']
        }]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
