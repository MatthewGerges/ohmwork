'use client'

import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

export function RichTextInput({ value, onChange, placeholder, rows = 4, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const isComposing = useRef(false)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((item) => item.type.startsWith('image/'))

    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return

      const placeholderEl = document.createElement('span')
      placeholderEl.textContent = ' [uploading…] '
      placeholderEl.style.color = '#6366f1'
      placeholderEl.style.fontSize = '0.85em'

      const sel = window.getSelection()
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0)
        range.insertNode(placeholderEl)
        range.setStartAfter(placeholderEl)
        sel.removeAllRanges()
        sel.addRange(range)
      } else {
        ref.current?.appendChild(placeholderEl)
      }

      const fd = new FormData()
      fd.append('file', file)

      try {
        const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
        const json = await res.json()

        if (json.url) {
          const img = document.createElement('img')
          img.src = json.url
          img.style.maxWidth = '100%'
          img.style.borderRadius = '8px'
          img.style.marginTop = '8px'
          img.style.display = 'block'
          placeholderEl.replaceWith(img)
        } else {
          placeholderEl.replaceWith(`[upload failed: ${json.error ?? 'check Supabase bucket exists'}]`)
        }
      } catch (err) {
        placeholderEl.replaceWith(`[upload failed: ${err}]`)
      }
    } else {
      // Plain-text paste — strip all formatting so it matches the field style
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      document.execCommand('insertText', false, text)
    }

    onChange(ref.current?.innerHTML ?? '')
  }

  const minHeight = `${rows * 1.75}rem`

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onCompositionStart={() => { isComposing.current = true }}
      onCompositionEnd={() => {
        isComposing.current = false
        onChange(ref.current?.innerHTML ?? '')
      }}
      onInput={() => {
        if (!isComposing.current) onChange(ref.current?.innerHTML ?? '')
      }}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      className={`px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors break-words ${className}`}
      style={{ minHeight, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
    />
  )
}
