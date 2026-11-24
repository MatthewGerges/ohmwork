#!/usr/bin/env node
import { createServer } from 'node:http'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { ROOT } from './question-import-utils.mjs'

const args = parseArgs(process.argv.slice(2))
const diagramsDir = resolve(args.dir ?? latestImportDir())
const port = Number(args.port ?? 5177)

startServer(port)

function startServer(startPort) {
  const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    if (req.method === 'GET' && url.pathname === '/') return sendHtml(res)
    if (req.method === 'GET' && url.pathname === '/api/list') return sendJson(res, listSvgFiles())
    if (req.method === 'GET' && url.pathname === '/api/svg') {
      const file = safeSvgPath(url.searchParams.get('file'))
      return send(res, readFileSync(file, 'utf8'), 'image/svg+xml; charset=utf-8')
    }
    if (req.method === 'POST' && url.pathname === '/api/save') {
      const body = JSON.parse(await readBody(req))
      const file = safeSvgPath(body.file)
      const svg = String(body.svg ?? '')
      if (!svg.includes('<svg')) throw new Error('Save body does not look like SVG')
      writeFileSync(file, `${svg.trim()}\n`)
      return sendJson(res, { ok: true, file: basename(file) })
    }
    send(res, 'Not found', 'text/plain', 404)
  } catch (error) {
    sendJson(res, { ok: false, error: String(error?.message ?? error) }, 500)
  }
  })

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && startPort < port + 20) {
      startServer(startPort + 1)
      return
    }
    throw error
  })

  server.listen(startPort, () => {
    console.log(`Diagram editor: http://localhost:${startPort}`)
    console.log(`Editing SVGs in: ${diagramsDir}`)
  })
}

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dir') parsed.dir = argv[++i]
    else if (arg === '--port') parsed.port = argv[++i]
    else throw new Error(`Unexpected argument: ${arg}`)
  }
  return parsed
}

function latestImportDir() {
  const importsDir = join(ROOT, 'public', 'diagrams', 'imports')
  const dirs = readdirSync(importsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(importsDir, entry.name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  if (!dirs.length) throw new Error(`No diagram import directories found in ${importsDir}`)
  return dirs[0]
}

function listSvgFiles() {
  return readdirSync(diagramsDir)
    .filter((file) => file.endsWith('.svg'))
    .sort()
}

function safeSvgPath(file) {
  const clean = basename(String(file ?? ''))
  if (!clean.endsWith('.svg')) throw new Error('Expected an .svg file')
  const path = resolve(diagramsDir, clean)
  if (!path.startsWith(`${diagramsDir}/`) && path !== diagramsDir) {
    throw new Error('Refusing to read outside diagram directory')
  }
  return path
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 5_000_000) reject(new Error('Request body too large'))
    })
    req.on('end', () => resolveBody(body))
    req.on('error', reject)
  })
}

function sendJson(res, payload, status = 200) {
  send(res, JSON.stringify(payload), 'application/json; charset=utf-8', status)
}

function send(res, body, contentType, status = 200) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function sendHtml(res) {
  send(res, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Diagram Editor</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, Arial, sans-serif; background: #020617; color: #e2e8f0; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; grid-template-columns: 340px 1fr; }
    aside { border-right: 1px solid #1e293b; padding: 16px; overflow: auto; background: #0f172a; }
    main { padding: 16px; overflow: auto; }
    h1 { margin: 0 0 12px; font-size: 18px; }
    .hint { color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 14px; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    button { border: 1px solid #334155; background: #111827; color: #e2e8f0; border-radius: 7px; padding: 8px 10px; cursor: pointer; }
    button:hover { border-color: #2dd4bf; }
    button:disabled { cursor: not-allowed; opacity: 0.45; border-color: #334155; }
    button.primary { background: #0f766e; border-color: #14b8a6; }
    button.danger { color: #fecaca; border-color: #7f1d1d; }
    button.danger:not(:disabled):hover { border-color: #ef4444; }
    #files { display: grid; gap: 8px; }
    #files button { text-align: left; font-size: 12px; line-height: 1.35; word-break: break-word; }
    #files button.active { border-color: #fbbf24; background: #1f2937; }
    #status { color: #94a3b8; font-size: 13px; min-height: 20px; }
    #canvas { max-width: 1080px; border: 1px solid #334155; border-radius: 10px; background: #020617; padding: 12px; }
    #canvas svg { display: block; width: 100%; height: auto; }
    #canvas [data-editor-selected="true"] { filter: drop-shadow(0 0 6px #fbbf24); }
    .meta { color: #94a3b8; font-size: 12px; margin-bottom: 12px; word-break: break-word; }
  </style>
</head>
<body>
  <aside>
    <h1>Diagram Editor</h1>
    <p class="hint">Select a diagram, then click any label, line, path, or shape. Drag to move it. Arrow keys nudge; Shift+Arrow nudges faster. Save writes directly to the SVG.</p>
    <div id="files"></div>
  </aside>
  <main>
    <div class="toolbar">
      <button class="primary" id="save">Save SVG</button>
      <button id="reload">Reload</button>
      <button class="danger" id="delete" disabled title="Delete selected element">Delete selected</button>
    </div>
    <div class="meta" id="current"></div>
    <div id="status"></div>
    <div id="canvas"></div>
  </main>
  <script>
    let currentFile = null
    let selected = null
    let drag = null

    const filesEl = document.querySelector('#files')
    const canvas = document.querySelector('#canvas')
    const statusEl = document.querySelector('#status')
    const currentEl = document.querySelector('#current')

    loadList()

    document.querySelector('#save').addEventListener('click', save)
    document.querySelector('#reload').addEventListener('click', () => currentFile && loadSvg(currentFile))
    document.querySelector('#delete').addEventListener('click', deleteSelected)
    window.addEventListener('keydown', onKey)

    async function loadList() {
      const files = await fetch('/api/list').then((res) => res.json())
      filesEl.innerHTML = files.map((file) => '<button data-file="' + escapeAttr(file) + '">' + escapeHtml(file) + '</button>').join('')
      filesEl.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-file]')
        if (button) loadSvg(button.dataset.file)
      })
      if (files[0]) loadSvg(files[0])
    }

    async function loadSvg(file) {
      currentFile = file
      selected = null
      updateDeleteButton()
      status('Loading ' + file)
      document.querySelectorAll('#files button').forEach((button) => button.classList.toggle('active', button.dataset.file === file))
      const svg = await fetch('/api/svg?file=' + encodeURIComponent(file)).then((res) => res.text())
      canvas.innerHTML = svg
      currentEl.textContent = file
      wireSvg()
      status('Loaded')
    }

    function wireSvg() {
      const svg = canvas.querySelector('svg')
      if (!svg) return
      svg.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    }

    function onPointerDown(event) {
      const target = event.target.closest('text,line,path,rect,circle,ellipse,polygon,polyline,g')
      const svg = canvas.querySelector('svg')
      if (!target || !svg || target === svg || target.parentElement?.tagName === 'defs') return
      event.preventDefault()
      select(target)
      const point = svgPoint(event)
      const tx = Number(selected.dataset.tx || 0)
      const ty = Number(selected.dataset.ty || 0)
      drag = { x: point.x, y: point.y, tx, ty }
      selected.setPointerCapture?.(event.pointerId)
    }

    function onPointerMove(event) {
      if (!drag || !selected) return
      const point = svgPoint(event)
      moveSelected(drag.tx + point.x - drag.x, drag.ty + point.y - drag.y)
    }

    function onPointerUp() {
      drag = null
    }

    function onKey(event) {
      if (!selected) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelected()
        return
      }
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      const step = event.shiftKey ? 10 : 1
      const tx = Number(selected.dataset.tx || 0)
      const ty = Number(selected.dataset.ty || 0)
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
      moveSelected(tx + dx, ty + dy)
    }

    function select(el) {
      canvas.querySelectorAll('[data-editor-selected]').forEach((node) => node.removeAttribute('data-editor-selected'))
      selected = el
      selected.dataset.editorSelected = 'true'
      updateDeleteButton()
      if (selected.dataset.tx === undefined) {
        const parsed = parseTranslate(selected.getAttribute('transform'))
        selected.dataset.tx = parsed.tx
        selected.dataset.ty = parsed.ty
        selected.dataset.baseTransform = parsed.rest
      }
      status('Selected <' + selected.tagName + '>')
    }

    function deleteSelected() {
      if (!selected) return
      const tagName = selected.tagName
      selected.remove()
      selected = null
      drag = null
      updateDeleteButton()
      status('Deleted <' + tagName + '>. Save SVG to keep this change.')
    }

    function updateDeleteButton() {
      document.querySelector('#delete').disabled = !selected
    }

    function moveSelected(tx, ty) {
      selected.dataset.tx = String(Math.round(tx * 10) / 10)
      selected.dataset.ty = String(Math.round(ty * 10) / 10)
      const rest = selected.dataset.baseTransform || ''
      selected.setAttribute('transform', ('translate(' + selected.dataset.tx + ' ' + selected.dataset.ty + ') ' + rest).trim())
    }

    async function save() {
      if (!currentFile) return
      const svg = canvas.querySelector('svg')
      if (!svg) return
      const clone = svg.cloneNode(true)
      clone.querySelectorAll('[data-editor-selected]').forEach((node) => node.removeAttribute('data-editor-selected'))
      clone.querySelectorAll('[data-tx],[data-ty],[data-base-transform]').forEach((node) => {
        node.removeAttribute('data-tx')
        node.removeAttribute('data-ty')
        node.removeAttribute('data-base-transform')
      })
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: currentFile, svg: clone.outerHTML }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      status('Saved ' + currentFile)
    }

    function svgPoint(event) {
      const svg = canvas.querySelector('svg')
      const point = svg.createSVGPoint()
      point.x = event.clientX
      point.y = event.clientY
      return point.matrixTransform(svg.getScreenCTM().inverse())
    }

    function parseTranslate(transform) {
      const value = transform || ''
      const match = value.match(/translate\\(([-0-9.]+)(?:[ ,]+([-0-9.]+))?\\)/)
      if (!match) return { tx: 0, ty: 0, rest: value }
      return {
        tx: Number(match[1] || 0),
        ty: Number(match[2] || 0),
        rest: value.replace(match[0], '').trim(),
      }
    }

    function status(message) {
      statusEl.textContent = message
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
    }

    function escapeAttr(value) {
      return escapeHtml(value)
    }
  </script>
</body>
</html>`, 'text/html; charset=utf-8')
}
