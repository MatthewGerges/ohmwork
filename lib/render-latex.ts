import katex from 'katex'

function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), { displayMode, throwOnError: false })
  } catch {
    return displayMode ? `$$${tex}$$` : `$${tex}$`
  }
}

/** Render $...$, $$...$$, \\(...\\), and \\[...\\] LaTeX inside HTML-ish content. */
export function renderLatexInHtml(html: string): string {
  if (!html || !(/[$\\]/.test(html))) return html

  const result = html
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => renderTex(tex, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => renderTex(tex, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, tex) => renderTex(tex, false))
    .replace(/\$([^$\n]+?)\$/g, (_, tex) => renderTex(tex, false))

  return result
}
