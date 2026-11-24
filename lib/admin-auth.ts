import { createHash, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'admin_auth'

function sessionToken(): string | null {
  const password = process.env.ADMIN_PASSWORD
  if (!password) return null
  return createHash('sha256').update(`ee-flashcards-admin:${password}`).digest('hex')
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const expected = sessionToken()
  const actual = (await cookies()).get(COOKIE_NAME)?.value
  if (!expected || !actual || expected.length !== actual.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}

export async function createAdminSession(): Promise<void> {
  const token = sessionToken()
  if (!token) throw new Error('Admin password is not configured')
  ;(await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'strict',
  })
}

export async function clearAdminSession(): Promise<void> {
  ;(await cookies()).delete(COOKIE_NAME)
}
