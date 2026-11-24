import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { AuthRecoveryRedirect } from '@/components/AuthRecoveryRedirect'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Ohmwork',
    template: '%s · Ohmwork',
  },
  description: 'Electrical engineering interview flashcards you sort into your own Easy, Medium, and Hard decks.',
  applicationName: 'Ohmwork',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#020817',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.className}>
      <body suppressHydrationWarning><AuthRecoveryRedirect />{children}</body>
    </html>
  )
}
