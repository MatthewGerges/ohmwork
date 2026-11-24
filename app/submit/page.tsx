import Link from 'next/link'
import type { Metadata } from 'next'
import { FilePlus2, Lightbulb, Paperclip, ArrowUpRight, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Submit / Feedback',
  description: 'Add a new question, or suggest an improvement to an existing Ohmwork card.',
}

// Public responder link; never use the form's private editor URL here.
const FORM_URL = process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL?.trim()
  || 'https://docs.google.com/forms/d/e/1FAIpQLScnODKn1XX0QvgKHaucTdmq9Pn4e8TDLuwb2DR0BpAhNsWqyQ/viewform'

export default function SubmitPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 safe-area-x px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-md border border-cyan-400/30 bg-cyan-400/10 font-semibold text-cyan-300">Ω</span>
            <span className="font-semibold">Ohmwork</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/account" className="text-slate-300 hover:text-white">Account</Link>
            <Link href="/" className="text-cyan-300 hover:text-cyan-200">Study</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 safe-area-x safe-area-bottom sm:py-14">
        <section className="space-y-3 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-cyan-400">Submit / Feedback</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Help make the decks better</h1>
          <p className="mx-auto max-w-xl text-sm leading-6 text-slate-400">
            Got a new question to add, or a fix for an existing card? Send it over in a quick form.
            It comes straight to us and we get an email for every submission.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <InfoCard
            icon={<FilePlus2 />}
            title="Add a question"
            description="Suggest a new interview question with its answer — attach any diagrams or an LTspice file."
          />
          <InfoCard
            icon={<Lightbulb />}
            title="Suggest an improvement"
            description="Point us at an existing card and say what to change: fix a value, clearer diagram, add an LTspice file, and so on."
          />
        </div>

        {FORM_URL ? (
          <section className="flex flex-col items-center gap-4 rounded-lg border border-slate-800 bg-slate-900 p-6 text-center sm:p-8">
            <a
              href={FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
            >
              Open the form
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Paperclip className="size-3.5" aria-hidden="true" />
              Google sign-in is required for this form. Attachments are optional.
            </p>
          </section>
        ) : (
          <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-center text-sm text-amber-200">
            <Mail className="mx-auto mb-2 size-5" aria-hidden="true" />
            The feedback form isn&apos;t linked yet. Set <code className="rounded bg-slate-900 px-1.5 py-0.5 text-amber-100">NEXT_PUBLIC_FEEDBACK_FORM_URL</code> to your Google Form link to activate it.
          </section>
        )}
      </main>
    </div>
  )
}

function InfoCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
      <span className="grid size-9 place-items-center rounded-md border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 [&>svg]:size-5">{icon}</span>
      <h2 className="mt-3 text-base font-semibold text-slate-100">{title}</h2>
      <p className="mt-1.5 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}
