'use client'

import { useMemo } from 'react'
import { renderLatexInHtml } from '@/lib/render-latex'
import 'katex/dist/katex.min.css'

interface Props {
  html: string
  className?: string
}

export function RichHtmlContent({ html, className = '' }: Props) {
  const rendered = useMemo(() => renderLatexInHtml(html), [html])

  return (
    <div
      className={`rich-html-content ${className}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  )
}
