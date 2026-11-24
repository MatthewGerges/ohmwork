import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types'

let _supabase: SupabaseClient<Database> | null = null

function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (client as any)[prop as string]
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
})
