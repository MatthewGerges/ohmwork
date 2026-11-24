import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const executable = process.env.LTSPICE_BIN ?? '/Applications/LTspice.app/Contents/MacOS/LTspice'
const out = 'public/diagrams/filter-responses'
const scratch = mkdtempSync(join(tmpdir(), 'ohmwork-filter-plots-'))
const ink = '#0f172a', grid = '#cbd5e1', input = '#0369a1', output = '#be185d'
mkdirSync(out, { recursive: true })

function simulate(id, ac) {
  const base = join(scratch, id)
  copyFileSync(`spice/${id}.cir`, `${base}.net`)
  execFileSync(executable, ['-b', `${base}.net`], { cwd: scratch })
  const raw = readFileSync(`${base}.raw`)
  const marker = Buffer.from('Binary:\n', 'utf16le')
  const start = raw.indexOf(marker) + marker.length
  if (start === marker.length - 1) throw Error(`Missing LTspice data: ${id}`)
  const header = raw.subarray(0, start).toString('utf16le')
  const n = Number(header.match(/No. Points:\s*(\d+)/)?.[1])
  const vars = Number(header.match(/No. Variables:\s*(\d+)/)?.[1])
  const vin = Number(header.match(/(\d+)\s+V\(vin\)/i)?.[1])
  const vout = Number(header.match(/(\d+)\s+V\(vout\)/i)?.[1])
  const stride = ac ? 16 * vars : 8 + 4 * (vars - 1)
  if (!vin || !vout || raw.length - start !== n * stride) throw Error(`Unexpected LTspice data layout: ${id}`)
  return Array.from({ length: n }, (_, i) => {
    const p = start + i * stride
    if (!ac) return [Math.abs(raw.readDoubleLE(p)) * 1000, raw.readFloatLE(p + 4 + 4 * vin), raw.readFloatLE(p + 4 + 4 * vout)]
    const re = raw.readDoubleLE(p + 16 * vout), im = raw.readDoubleLE(p + 16 * vout + 8)
    return [Math.log10(raw.readDoubleLE(p)), 20 * Math.log10(Math.hypot(re, im)), Math.atan2(im, re) * 180 / Math.PI]
  })
}

function panel({ top, height, xs, ys, xLabel, yLabel, series, log = false }) {
  const left = 95, width = 654
  const x = t => left + width * (t - xs[0]) / (xs.at(-1) - xs[0])
  const y = v => top + height * (ys.at(-1) - v) / (ys.at(-1) - ys[0])
  const text = (x, y, content, align = 'middle') => `<text x="${x}" y="${y}" text-anchor="${align}">${content}</text>`
  const line = (x1, y1, x2, y2, stroke = grid) => `<path d="M${x1},${y1}L${x2},${y2}" stroke="${stroke}"/>`
  return xs.map(t => line(x(t), top, x(t), top + height) + text(x(t), top + height + 22, log ? ['10', '100', '1k', '10k', '100k', '1M'][t - 1] : t)).join('')
    + ys.map(v => line(left, y(v), left + width, y(v), v === 0 ? '#94a3b8' : grid) + text(left - 10, y(v) + 5, v, 'end')).join('')
    + text(left, top - 12, yLabel, 'start') + text(left + width / 2, top + height + 47, xLabel)
    + series.map(({ data, color, dash }) => `<polyline points="${data.map(([t, v]) => `${x(t).toFixed(2)},${y(v).toFixed(2)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="3"${dash ? ' stroke-dasharray="7 5"' : ''}/>`).join('')
}

function write(name, title, panels, legend = '') {
  const height = panels.length === 1 ? 356 : 590
  const body = panels.map(panel).join('')
  writeFileSync(join(out, `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" width="790" height="${height}" viewBox="0 0 790 ${height}" role="img" aria-label="${title}"><rect width="790" height="${height}" fill="#fff"/><g font-family="system-ui,sans-serif" font-size="16" fill="${ink}"><text x="36" y="31" font-size="22" font-weight="600">${title}</text>${legend}${body}</g></svg>\n`)
}

try {
  const ac = simulate('09-rc-high-pass', true)
  if (!(ac[0][1] < -40 && ac.at(-1)[1] > -0.01)) throw Error('Unexpected CR high-pass Bode response')
  const xs = [1, 2, 3, 4, 5, 6]
  write('cr-high-pass-bode', 'CR high-pass: Bode plot', [
    { top: 75, height: 175, xs, ys: [-50, -40, -30, -20, -10, 0], xLabel: 'Frequency (Hz, log scale)', yLabel: 'Magnitude (dB)', log: true, series: [{ data: ac.map(([f, m]) => [f, m]), color: output }] },
    { top: 351, height: 175, xs, ys: [0, 30, 60, 90], xLabel: 'Frequency (Hz, log scale)', yLabel: 'Phase (degrees)', log: true, series: [{ data: ac.map(([f, , p]) => [f, p]), color: output }] },
  ])
  for (const [id, name, title, xs, ys, settled] of [
    ['10-rc-pulse-response', 'rc-low-pass-time', 'RC low-pass: pulse response', [0, 0.5, 1, 1.5, 2, 2.5, 3], [0, 1, 2, 3, 4], 3.3],
    ['14-lc-low-pass-step', 'lc-low-pass-time', 'LC low-pass: step response', [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2], [0, 0.5, 1, 1.5, 2], 1],
    ['15-lc-high-pass-step', 'lc-high-pass-time', 'LC high-pass: step response', [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2], [-1, -0.5, 0, 0.5, 1, 1.5], 0],
    ['16-series-rlc-band-pass-step', 'rlc-band-pass-time', 'Series RLC band-pass: step response', [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2], [-0.5, 0, 0.5, 1], 0],
  ]) {
    const raw = simulate(id, false)
    const data = raw.filter(([t]) => t <= xs.at(-1))
    const sample = raw.reduce((a, b) => Math.abs(b[0] - (settled === 3.3 ? 1.9 : 1.19)) < Math.abs(a[0] - (settled === 3.3 ? 1.9 : 1.19)) ? b : a)
    if (Math.abs(sample[2] - settled) > 0.02) throw Error(`Unexpected settled value for ${id}`)
    write(name, title, [{ top: 78, height: 220, xs, ys, xLabel: 'Time (ms)', yLabel: 'Voltage (V)', series: [
      { data: data.map(([t, v]) => [t, v]), color: input, dash: true },
      { data: data.map(([t, , v]) => [t, v]), color: output },
    ] }], `<text x="620" y="53" fill="${input}">VIN (dashed)</text><text x="725" y="53" fill="${output}">VOUT</text>`)
  }
  simulate('17-lc-high-pass-ac', true)
  console.log('Rendered five answer plots from LTspice.')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
