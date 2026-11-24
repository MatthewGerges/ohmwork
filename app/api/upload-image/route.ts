import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your-service-role-key-here') {
      return NextResponse.json({ error: 'Supabase is not configured. Update .env.local and restart the dev server.' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const ext = file.type.split('/')[1] || 'png'
    const fileName = `questions/${Date.now()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const supabase = createAdminClient()
    const { data, error } = await supabase.storage
      .from('question-images')
      .upload(fileName, buffer, { contentType: file.type })

    if (error) return NextResponse.json({ error: `Supabase upload error: ${error.message}` }, { status: 500 })

    const { data: urlData } = supabase.storage.from('question-images').getPublicUrl(data.path)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('[upload-image]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
