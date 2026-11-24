'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function AuthRecoveryRedirect() {
  const router = useRouter()
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
        router.replace('/reset-password')
      }
    })
    return () => data.subscription.unsubscribe()
  }, [router])
  return null
}
