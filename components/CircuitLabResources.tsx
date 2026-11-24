'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Download, ExternalLink } from 'lucide-react'
import type { Question } from '@/lib/types'
import { getCircuitDownloadLabel, getCircuitResources, getOriginalCircuitFile } from '@/lib/circuit-resources'

export function CircuitLabResources({ question, collapsed = false }: { question: Question; collapsed?: boolean }) {
  const resources = getCircuitResources(question)
  const originalFile = getOriginalCircuitFile(question)
  if (!resources.length && !originalFile) return null
  const content = <div className="space-y-5 pt-3">
    {resources.map(resource => <section key={resource.id} className="space-y-3">
      <h3 className="text-sm font-medium text-slate-200">{resource.title}</h3>
      <a href={resource.exercises} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md bg-white" aria-label={`View ${resource.title} and guided exercises`}>
        <Image src={resource.preview} alt={`${resource.title} schematic`} width={1200} height={640} sizes="(max-width: 767px) 100vw, 720px" className="h-auto w-full" />
      </a>
      <div className="flex flex-wrap gap-4 text-sm">
        <a href={resource.file} download className="inline-flex items-center gap-2 font-medium text-cyan-300 hover:text-cyan-200"><Download className="size-4" aria-hidden="true" />{getCircuitDownloadLabel(resource.id)}</a>
        <a href={resource.exercises} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-slate-300 hover:text-white">Experiments and FAQs<ExternalLink className="size-3.5" aria-hidden="true" /></a>
      </div>
    </section>)}
    {originalFile && !resources.some(resource => originalFile.endsWith(resource.file)) && <a href={originalFile} download className="inline-flex items-center gap-2 text-sm text-cyan-300"><Download className="size-4" aria-hidden="true" />Download original LTspice file</a>}
    <Link href="/simulations" className="inline-block text-xs text-slate-400 hover:text-cyan-300">All Circuit Lab experiments</Link>
  </div>
  return collapsed ? <details className="border-t border-slate-700 pt-3" onClick={event => event.stopPropagation()}><summary className="cursor-pointer text-sm text-cyan-300">Circuit Lab practice</summary>{content}</details> : <section aria-label="Circuit Lab practice" className="border-t border-slate-700 pt-4"><h2 className="text-xs uppercase tracking-wider text-cyan-300">Circuit Lab practice</h2>{content}</section>
}
