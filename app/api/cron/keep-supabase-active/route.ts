import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (request.headers.get('user-agent') !== 'vercel-cron/1.0') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { count, error } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })

  if (error) {
    console.error('Supabase keepalive query failed', error)
    return Response.json({ ok: false }, { status: 503 })
  }

  return Response.json({
    ok: true,
    questionCount: count ?? 0,
    checkedAt: new Date().toISOString(),
  })
}
