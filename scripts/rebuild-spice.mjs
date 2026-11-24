import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'

const root = path.resolve('spice')
const symbols = path.join(os.homedir(), 'Library/Application Support/LTspice/lib/sym')
const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
fs.mkdirSync(path.join(root, 'previews'), { recursive: true })

const lessons = {
  '01': ['TRY: Change C1 from 100n to 200n; predict the cutoff before running.', 'WHY: fc = 1/(2*pi*R*C). Doubling C halves the cutoff.', 'TRY: Change R1 from 1k to 2k. Compare the two effects.'],
  '02': ['TRY: Double L1 or C1. Does the band-pass peak move left or right?', 'WHY: f0 = 1/(2*pi*sqrt(L*C)); increasing either lowers resonance.', 'TRY: Change R1 from 100 to 10, then 1k. Compare bandwidth.', 'FAQ: Smaller series R gives a narrower peak. VOUT is across R1.'],
  '03': ['TRY: Change RLOAD from 100 to 10, then 1k. Compare the peak.', 'FAQ: The resonance peak is energy exchanged between L and C.', 'A larger load resistance draws less current and gives LESS damping.', 'TRY: Double C1 or L1. The resonant frequency moves lower.', 'Real inductors and capacitors have losses; this ideal model exaggerates peaking.'],
  '04': ['TRY: Change RF from 100k to 200k. Predict gain = -RF/RIN.', 'TRY: Increase input amplitude from 0.15 V to 2 V; observe clipping.', 'FAQ: Clipping flattens the sine when the requested output exceeds the rails.', 'TRY: Reduce RLOAD to 100 ohms: output-current limits can distort the signal.', 'A heavier load means LOWER resistance, not higher resistance.'],
  '05': ['TRY: Change RF or RI. Predict gain = 1 + RF/RI.', 'Probe VFB: negative feedback holds it close to VIN while linear.', 'FAQ: Larger input or gain can demand more output voltage than the rails allow.', 'TRY: Reduce RLOAD to 100 ohms; distinguish current limiting from rail clipping.'],
  '06': ['TRY: Reduce RLOAD from 10k to 100, then 10 ohms.', 'FAQ: A buffer has unity voltage gain, but cannot supply unlimited current.', 'TRY: Increase the input frequency from 1k to 1Meg; compare VIN and VOUT.', 'Finite bandwidth and slew rate cause tracking errors at high frequency.'],
  '07': ['TRY: Change CBUS from 200p to 400p; predict a slower rise.', 'TRY: Change RPULLUP from 4.7k to 2.2k; predict a faster rise.', 'FAQ: The pull-up charges CBUS after the switch releases the line.', 'A smaller pull-up also increases current while the line is held low.'],
  '08': ['PLOT: VIN, VOUT, then VSUM (the positive input). The minus input is 0 V.', 'When VSUM crosses 0 V, VOUT switches and feedback reinforces the change.', 'With VOUT near -5 V, VIN must rise to about +1.06 V to switch high.', 'With VOUT near +5 V, VIN must fall to about -1.06 V to switch low.', 'The output is a two-level waveform, not an amplified sine wave.', 'TRY: Change RF from 47k to 100k. The hysteresis window gets narrower.', 'Thresholds are approximately +/-|VOUT|*RIN/RF, not exactly the supply rails.'],
  '09': ['TRY: Double C1. The high-pass cutoff moves lower.', 'WHY: At low frequency C1 has large impedance; at high frequency it passes signal.', 'Probe VIN and VOUT; the passband tends to 0 dB with this ideal source.'],
  '10': ['TRY: Change C1 from 100n to 200n. Edges become slower.', 'Probe VIN and VOUT. The same RC time constant controls rise and fall.', 'FAQ: A short pulse can end before the capacitor reaches the high level.', 'TRY: Shorten the pulse width from 1m to 100u. Predict the output peak.'],
  '11': ['TRY: Change RLOAD from 100k to 10k, then 1k.', 'FAQ: The lower divider resistor is in parallel with the load.', 'Lower load resistance pulls VOUT below the unloaded 2.5 V.', 'TRY: Change R1 and R2 together from 10k to 1k; loading error gets smaller.', 'The trade-off is increased divider current and power consumption.'],
  '12': ['TRY: Change RSHUNT from 1 to 0.1 ohm. Sense voltage falls by 10x.', 'Probe VSENSE; hover over RSHUNT and click to see current.', 'FAQ: Larger shunts improve voltage signal but waste more power: P = I^2*R.', 'TRY: Reduce RLOAD. Current and shunt dissipation both increase.'],
  '13': ['PLOT: VIN steps from 0 V to 5 V and back. VOUT is the voltage across R1.', 'Rising edge: VOUT jumps near +5 V, then decays toward 0 V.', 'Falling edge: VOUT jumps near -5 V, then decays toward 0 V again.', 'WHY: Capacitor voltage cannot jump instantly. The input step first appears across R1.', 'TRY: Double C1 to 200n. Predict which edges change and how long they take to decay.', 'FAQ: If the pulse is shorter than a few time constants, VOUT may not settle before the next edge.'],
  '14': ['PLOT: VOUT starts near 0 V, overshoots 1 V, then settles to 1 V.', 'TRY: Reduce RLOAD to 20 ohms. A heavier load damps the ringing.', 'The same underdamped poles produce peaking in the AC sweep.'],
  '15': ['PLOT: VOUT initially follows the rising edge, then rings toward 0 V.', 'TRY: Reduce RLOAD to 20 ohms. Compare the ringing and decay.', 'WHY: At DC, C1 blocks the input and L1 holds the output at ground.'],
  '16': ['VOUT is across R1. It starts near 0 V, rings, then returns to 0 V.', 'TRY: Increase R1 to 680 ohms. Larger series R damps the ringing.', 'WHY: Inductor current cannot jump, and the series capacitor blocks DC.'],
  '17': ['The low-frequency slope is +40 dB/decade. High-frequency gain approaches 0 dB.', 'TRY: Reduce RLOAD to 20 ohms and watch the resonant peak shrink.', 'The natural frequency is about 5.03 kHz; it is not necessarily the -3 dB frequency.'],
}

function circuit(name, title, analysis, note) {
  const wires = [], flags = [], parts = []
  const wire = (x, y, a, b) => wires.push([x, y, a, b])
  const flag = (x, y, label) => flags.push([x, y, label])
  function part(type, name, value, x, y, horizontal = false) {
    const rotation = horizontal ? 'R90' : 'R0'
    const ox = horizontal ? x + (type === 'cap' ? 64 : 96) : type === 'voltage' || type === 'sw' ? x : x - 16
    const oy = horizontal ? y - 16 : type === 'cap' ? y : y - 16
    const source = fs.readFileSync(path.join(symbols, `${type}.asy`), 'utf8').replaceAll('\r', '')
    const transform = (px, py) => horizontal ? [ox - py, oy + px] : [ox + px, oy + py]
    const pins = [...source.matchAll(/^PIN (-?\d+) (-?\d+) /gm)].map(m => transform(+m[1], +m[2]))
    parts.push({ type, name, value, ox, oy, rotation, source, transform, pins, horizontal })
    return pins
  }
  function source(name, value, x, y, node) {
    part('voltage', name, value, x, y)
    wire(x, y - 32, x, y); flag(x, y - 32, node)
    wire(x, y + 80, x, y + 112); flag(x, y + 112, '0')
  }
  function amp(x, y) {
    const type = 'Opamps/UniversalOpamp2'
    const source = fs.readFileSync(path.join(symbols, `${type}.asy`), 'utf8').replaceAll('\r', '')
    const transform = (a, b) => [x + a, y + b]
    const pins = [...source.matchAll(/^PIN (-?\d+) (-?\d+) /gm)].map(m => transform(+m[1], +m[2]))
    parts.push({ type, name: 'U1', value: '', ox: x, oy: y, rotation: 'R0', source, transform, pins })
    wire(x, y - 32, x, y - 64); flag(x, y - 64, 'VP')
    wire(x, y + 32, x, y + 64); flag(x, y + 64, 'VN')
  }
  function finish() {
    const transformPoint = (part, x, y) => part.transform(+x, +y)
    let asc = `Version 4\nSHEET 1 1200 1400\n`
    asc += wires.map(w => `WIRE ${w.join(' ')}`).join('\n') + '\n'
    asc += flags.map(f => `FLAG ${f.join(' ')}`).join('\n') + '\n'
    for (const p of parts) {
      asc += `SYMBOL ${p.type.replaceAll('/', '\\')} ${p.ox} ${p.oy} ${p.rotation}\n`
      if (p.horizontal) asc += 'WINDOW 0 0 56 VBottom 2\nWINDOW 3 32 56 VTop 2\n'
      asc += `SYMATTR InstName ${p.name}\n`
      if (p.value) asc += `SYMATTR Value ${p.value}\n`
    }
    asc += `TEXT 64 32 Left 2 ;${title}\nTEXT 64 656 Left 2 !${analysis}\nTEXT 64 704 Left 2 ;${note}\n`
    const ac = analysis.startsWith('.ac')
    const bus = name.startsWith('07')
    const steps = [
      '1. Click Run: the running-person button at the top left.',
      `2. On the schematic, click the wire labeled ${bus ? 'SDA' : name.startsWith('12') ? 'VSENSE' : 'VOUT'} (not the component).`,
      ac ? '3. Read the response: frequency on X, gain in dB on Y.' : bus ? '3. Look for a fast fall to 0 V and a curved rise toward 3.3 V.' : '3. Click the VIN wire too, to compare input and output in the same plot.',
      'If the plot is empty, select the schematic window and click the labeled wire again.',
    ]
    asc += steps.map((s, i) => `TEXT 64 ${768 + i * 40} Left 2 ;${s}`).join('\n') + '\n'
    const lesson = ['EXPERIMENTS AND COMMON QUESTIONS', 'Right-click a component to edit its value. Predict first, change one value, then Run.', ...lessons[name.slice(0, 2)]]
    asc += lesson.map((s, i) => `TEXT 64 ${968 + i * 40} Left 2 ;${s}`).join('\n') + '\n'
    fs.writeFileSync(path.join(root, `${name}.asc`), asc)

    // Derive connectivity from the placed pins and wires, not a separate ideal circuit.
    const points = [...parts.flatMap(p => p.pins), ...flags.map(f => f.slice(0, 2)), ...wires.flatMap(w => [w.slice(0, 2), w.slice(2)])]
    const keys = [...new Set(points.map(p => p.join(',')))], parent = new Map(keys.map(k => [k, k]))
    const find = k => parent.get(k) === k ? k : (parent.set(k, find(parent.get(k))), parent.get(k))
    const join = (a, b) => parent.set(find(a), find(b))
    const on = ([x, y], [a, b, c, d]) => (a === c && x === a && y >= Math.min(b, d) && y <= Math.max(b, d)) || (b === d && y === b && x >= Math.min(a, c) && x <= Math.max(a, c))
    for (const w of wires) for (const k of keys) if (on(k.split(',').map(Number), w)) join(k, w.slice(0, 2).join(','))
    for (const [x, y, label] of flags) for (const [a, b, other] of flags) if (label === other) join(`${x},${y}`, `${a},${b}`)
    const labels = new Map(flags.map(([x, y, n]) => [find(`${x},${y}`), n]))
    const node = p => labels.get(find(p.join(','))) ?? `N${keys.indexOf(find(p.join(',')))}`
    for (const p of parts) for (const pin of p.pins) {
      if (!wires.some(w => on(pin, w)) && !flags.some(f => f[0] === pin[0] && f[1] === pin[1])) throw Error(`${name}: disconnected ${p.name} pin ${pin}`)
    }
    let net = `* Derived from ${name}.asc\n`
    for (const p of parts) net += `${p.type.includes('Universal') ? 'X' : ''}${p.name} ${p.pins.map(node).join(' ')} ${p.type.includes('Universal') ? 'level2' : p.value}\n`
    if (parts.some(p => p.name === 'U1')) net += `.include "${path.join(symbols, '../sub/UniversalOpAmp2.lib')}"\n`
    net += analysis.replaceAll('\\n', '\n') + '\n.end\n'
    fs.writeFileSync(path.join(root, `${name}.cir`), net)

    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1400" viewBox="0 0 1200 1400"><rect width="1200" height="1400" fill="white"/>'
    svg += `<text x="64" y="45" font-family="Arial" font-size="24" fill="#17212b">${escape(title)}</text>`
    const line = (x, y, a, b, color = '#244b83', width = 2) => `<line x1="${x}" y1="${y}" x2="${a}" y2="${b}" stroke="${color}" stroke-width="${width}"/>`
    svg += wires.map(w => line(...w)).join('')
    for (const p of parts) {
      for (const m of p.source.matchAll(/^LINE Normal (-?\d+) (-?\d+) (-?\d+) (-?\d+)/gm)) svg += line(...transformPoint(p, m[1], m[2]), ...transformPoint(p, m[3], m[4]), '#17212b')
      for (const m of p.source.matchAll(/^CIRCLE Normal (-?\d+) (-?\d+) (-?\d+) (-?\d+)/gm)) {
        const [x, y] = transformPoint(p, (+m[1] + +m[3]) / 2, (+m[2] + +m[4]) / 2)
        svg += `<circle cx="${x}" cy="${y}" r="${Math.abs(+m[3] - +m[1]) / 2}" fill="none" stroke="#17212b" stroke-width="2"/>`
      }
      for (const m of p.source.matchAll(/^ARC Normal (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+) (-?\d+)/gm)) {
        const v = m.slice(1).map(Number), cx = (v[0] + v[2]) / 2, cy = (v[1] + v[3]) / 2, r = (v[2] - v[0]) / 2
        const a = Math.atan2(v[5] - cy, v[4] - cx), b = Math.atan2(v[7] - cy, v[6] - cx)
        const start = p.transform(cx + r * Math.cos(a), cy + r * Math.sin(a)), end = p.transform(cx + r * Math.cos(b), cy + r * Math.sin(b))
        svg += `<path d="M${start.join(' ')} A${r} ${r} 0 1 1 ${end.join(' ')}" fill="none" stroke="#17212b" stroke-width="2"/>`
      }
      const [x, y] = p.horizontal ? p.pins.reduce((a, b) => a[0] < b[0] ? a : b) : p.pins[0]
      const tx = p.horizontal ? x + 40 : p.type.includes('Universal') ? p.ox + 24 : x + 42
      const ty = p.horizontal ? y - (p.type === 'ind' ? 48 : 28) : p.type.includes('Universal') ? p.oy - 40 : y + 22
      svg += `<text x="${tx}" y="${ty}" text-anchor="${p.horizontal ? 'middle' : 'start'}" font-family="Arial" font-size="18">${escape(p.name)}</text>`
      if (p.value) svg += `<text x="${tx}" y="${p.horizontal ? y + 42 : ty + 28}" text-anchor="${p.horizontal ? 'middle' : 'start'}" font-family="Arial" font-size="18">${escape(p.value)}</text>`
    }
    for (const [x, y, label] of flags) svg += label === '0' ? `${line(x - 12, y, x + 12, y)}${line(x - 8, y + 5, x + 8, y + 5)}${line(x - 4, y + 10, x + 4, y + 10)}` : `<text x="${x}" y="${y - 12}" font-family="Arial" font-size="18" fill="#244b83">${label}</text>`
    svg += `<text x="64" y="672" font-family="Arial" font-size="18">${escape(analysis.replaceAll('\\n', ' ; '))}</text><text x="64" y="720" font-family="Arial" font-size="18">${escape(note)}</text>`
    svg += '<rect x="48" y="750" width="1104" height="180" rx="4" fill="#edf4fa" stroke="#b6c9db"/>'
    svg += steps.map((s, i) => `<text x="64" y="${784 + i * 40}" font-family="Arial" font-size="18" fill="#17212b">${escape(s)}</text>`).join('')
    svg += '<rect x="48" y="950" width="1104" height="420" rx="4" fill="#f2f6ef" stroke="#c4d2bc"/>'
    svg += lesson.map((s, i) => `<text x="64" y="${984 + i * 40}" font-family="Arial" font-size="18" fill="#17212b">${escape(s)}</text>`).join('') + '</svg>'
    fs.writeFileSync(path.join(root, 'previews', `${name}.svg`), svg)
    return sharp(Buffer.from(svg)).png().toFile(path.join(root, 'previews', `${name}.png`))
  }
  return { wire, flag, part, source, amp, finish }
}

const acSweep = '.ac dec 200 10 1Meg'
const step = 'PULSE(0 1 100u 1u 1u 10m 20m)'
const stepAnalysis = '.tran 0 1.2m 0 500n'
for (const [name, title, kind, transient] of [
  ['01-rc-low-pass', 'RC low-pass filter', 'rc', false],
  ['02-series-rlc-band-pass', 'Series RLC band-pass filter', 'rlc', false],
  ['03-lc-low-pass', 'LC low-pass filter', 'lc', false],
  ['14-lc-low-pass-step', 'LC low-pass: step response', 'lc', true],
  ['15-lc-high-pass-step', 'LC high-pass: step response', 'lc-high', true],
  ['16-series-rlc-band-pass-step', 'Series RLC band-pass: step response', 'rlc', true],
  ['17-lc-high-pass-ac', 'LC high-pass: frequency response', 'lc-high', false],
]) {
  const c = circuit(name, title, transient ? stepAnalysis : acSweep,
    transient ? 'VIN is a 0 to 1 V step. L and C set the natural frequency near 5.03 kHz.' : 'Plot V(VOUT). Input AC amplitude: 1 V.')
  c.source('V1', transient ? step : 'AC 1', 128, 240, 'VIN')
  c.wire(128, 208, 128, 144); c.wire(128, 144, 320, 144)
  if (kind === 'lc-high') c.part('cap', 'C1', '1u', 320, 144, true)
  else c.part(kind === 'rc' ? 'res' : 'ind', kind === 'rc' ? 'R1' : 'L1', kind === 'rc' ? '1k' : kind === 'lc' ? '1m' : '10m', 320, 144, true)
  if (kind === 'rlc') {
    c.flag(448, 144, 'VLC');
    c.wire(400, 144, 512, 144); c.part('cap', 'C1', '100n', 512, 144, true); c.wire(576, 144, 768, 144)
    c.wire(768, 144, 768, 272); c.part('res', 'R1', '100', 768, 272); c.wire(768, 352, 768, 416)
  } else {
    c.wire(kind === 'lc-high' ? 384 : 400, 144, 768, 144); c.wire(576, 144, 576, 272)
    if (kind === 'lc-high') c.part('ind', 'L1', '1m', 576, 272)
    else c.part('cap', 'C1', kind === 'rc' ? '100n' : '1u', 576, 272)
    c.wire(576, kind === 'lc-high' ? 352 : 336, 576, 416); c.flag(576, 416, '0')
    if (kind !== 'rc') { c.wire(768, 144, 768, 272); c.part('res', 'RLOAD', '100', 768, 272); c.wire(768, 352, 768, 416) }
  }
  c.flag(768, 144, 'VOUT'); if (kind !== 'rc') c.flag(768, 416, '0')
  await c.finish()
}

for (const [name, title, kind] of [['04-inverting-amplifier', 'Inverting amplifier: gain -10', 'inv'], ['05-non-inverting-amplifier', 'Non-inverting amplifier: gain +11', 'non'], ['06-voltage-follower', 'Voltage follower: unity gain', 'buffer'], ['08-non-inverting-schmitt-trigger', 'Non-inverting Schmitt trigger', 'schmitt']]) {
  const schmitt = kind === 'schmitt'
  const c = circuit(name, title, schmitt ? '.tran 0 20m 0 2u' : '.tran 0 5m 0 1u', schmitt ? 'Plot V(VIN) and V(VOUT). Positive feedback creates hysteresis.' : 'Plot V(VIN) and V(VOUT). Supplies are separate from the signal path.')
  c.amp(608, 256)
  c.source('VIN_SOURCE', schmitt ? 'SINE(0 6 200)' : kind === 'buffer' ? 'SINE(0 2 1k)' : 'SINE(0 0.15 1k)', 128, 336, 'VIN')
  const inputY = kind === 'inv' ? 240 : 272
  c.wire(128, 304, 128, inputY)
  if (kind === 'inv' || schmitt) { c.wire(128, inputY, 288, inputY); c.part('res', 'RIN', '10k', 288, inputY, true); c.wire(368, inputY, 576, inputY) }
  else c.wire(128, inputY, 576, inputY)
  c.wire(640, 256, 848, 256); c.flag(848, 256, 'VOUT')
  c.wire(848, 256, 848, 368); c.part('res', 'RLOAD', '10k', 848, 368); c.wire(848, 448, 848, 480); c.flag(848, 480, '0')
  const feedbackY = schmitt ? 560 : 112
  if (schmitt) c.flag(480, 432, 'VSUM')
  else if (kind === 'inv' || kind === 'non') c.flag(480, 176, 'VFB')
  if (kind !== 'buffer') {
    const nodeY = schmitt ? 272 : 240
    c.wire(480, nodeY, 480, feedbackY); c.wire(480, feedbackY, 576, feedbackY)
    c.part('res', 'RF', schmitt ? '47k' : '100k', 576, feedbackY, true); c.wire(656, feedbackY, 768, feedbackY); c.wire(768, feedbackY, 768, 256)
  } else { c.wire(480, 240, 576, 240); c.wire(480, 240, 480, 112); c.wire(480, 112, 768, 112); c.wire(768, 112, 768, 256) }
  if (kind === 'non') { c.wire(480, 240, 576, 240); c.wire(480, 240, 480, 368); c.part('res', 'RI', '10k', 480, 368); c.wire(480, 448, 480, 480); c.flag(480, 480, '0') }
  else { const y = kind === 'inv' ? 272 : kind === 'buffer' ? null : 240; if (y) { c.wire(544, y, 576, y); c.flag(544, y, '0') } }
  c.source('VCC', schmitt ? '5' : '12', 1008, 224, 'VP')
  c.source('VEE', schmitt ? '-5' : '-12', 1008, 448, 'VN')
  await c.finish()
}

{
  const c = circuit('07-i2c-open-drain-rise-time', 'I2C open-drain bus: pull-up and bus capacitance', '.model SWOD SW(Ron=0.1 Roff=1G Vt=2 Vh=0.1)\\n.tran 0 40u 0 10n', 'Plot V(SDA). Released bus: tau = 4.7k x 200p = 0.94 us.')
  c.source('VDD_SOURCE', '3.3', 128, 240, 'VDD')
  c.part('res', 'RPULLUP', '4.7k', 448, 128); c.wire(448, 96, 448, 128); c.flag(448, 96, 'VDD'); c.wire(448, 208, 448, 272)
  c.wire(448, 272, 768, 272); c.flag(768, 272, 'SDA'); c.wire(768, 272, 768, 368); c.part('cap', 'CBUS', '200p', 768, 368); c.wire(768, 432, 768, 480); c.flag(768, 480, '0')
  c.wire(448, 272, 448, 368); c.part('sw', 'S1', 'SWOD', 448, 368); c.wire(448, 448, 448, 480); c.flag(448, 480, '0')
  c.wire(400, 384, 352, 384); c.flag(352, 384, '0'); c.wire(400, 432, 352, 432); c.flag(352, 432, 'CTRL')
  c.source('VCTRL', 'PULSE(5 0 2u 20n 20n 8u 20u)', 128, 496, 'CTRL')
  await c.finish()
}
{
  const c = circuit('09-rc-high-pass', 'RC high-pass filter', '.ac dec 200 10 1Meg', 'R1 = 1k, C1 = 100n: cutoff about 1.59 kHz.')
  c.source('V1', 'AC 1', 128, 240, 'VIN')
  c.wire(128, 208, 128, 144); c.wire(128, 144, 320, 144)
  c.part('cap', 'C1', '100n', 320, 144, true); c.wire(384, 144, 768, 144)
  c.wire(576, 144, 576, 272); c.part('res', 'R1', '1k', 576, 272)
  c.wire(576, 352, 576, 416); c.flag(576, 416, '0'); c.flag(768, 144, 'VOUT')
  await c.finish()
}
{
  const c = circuit('10-rc-pulse-response', 'RC low-pass: pulse response', '.tran 0 6m 0 1u', 'tau = R1*C1 = 100 us. Compare input edges with the capacitor voltage.')
  c.source('V1', 'PULSE(0 3.3 1m 1u 1u 1m 2m)', 128, 336, 'VIN')
  c.wire(128, 304, 128, 144); c.wire(128, 144, 384, 144)
  c.part('res', 'R1', '1k', 384, 144, true); c.wire(464, 144, 832, 144)
  c.flag(832, 144, 'VOUT'); c.wire(672, 144, 672, 336)
  c.part('cap', 'C1', '100n', 672, 336); c.wire(672, 400, 672, 448); c.flag(672, 448, '0')
  await c.finish()
}
{
  const c = circuit('11-loaded-voltage-divider', 'Voltage divider: loading error', '.tran 0 1m 0 1u', 'Without a load VOUT = 2.5 V. With RLOAD = 100k, VOUT is about 2.38 V.')
  c.source('V1', '5', 128, 336, 'VIN')
  c.wire(128, 304, 128, 144); c.wire(128, 144, 400, 144)
  c.part('res', 'R1', '10k', 400, 144, true); c.wire(480, 144, 832, 144); c.flag(832, 144, 'VOUT')
  for (const [x, name, value] of [[576, 'R2', '10k'], [832, 'RLOAD', '100k']]) {
    c.wire(x, 144, x, 336); c.part('res', name, value, x, 336)
    c.wire(x, 416, x, 464); c.flag(x, 464, '0')
  }
  await c.finish()
}
{
  const c = circuit('12-low-side-shunt', 'Low-side current sensing: shunt trade-off', '.tran 0 1m 0 1u', 'I = 12/(100+1) = 118.8 mA. VSENSE = I*RSHUNT = 118.8 mV.')
  c.source('V1', '12', 128, 336, 'VIN')
  c.wire(128, 304, 128, 144); c.wire(128, 144, 576, 144)
  c.part('res', 'RLOAD', '100', 576, 144); c.wire(576, 224, 576, 304)
  c.wire(576, 272, 832, 272); c.flag(832, 272, 'VSENSE')
  c.part('res', 'RSHUNT', '1', 576, 304); c.wire(576, 384, 576, 448); c.flag(576, 448, '0')
  await c.finish()
}
{
  const c = circuit('13-cr-high-pass-pulse', 'CR high-pass: pulse response', '.tran 0 2.2m 0 1u', 'R1 = 1k, C1 = 100n: tau = 100 us. Each half-cycle is about 5 tau.')
  c.source('V1', 'PULSE(0 5 100u 1u 1u 500u 1m)', 128, 240, 'VIN')
  c.wire(128, 208, 128, 144); c.wire(128, 144, 320, 144)
  c.part('cap', 'C1', '100n', 320, 144, true); c.wire(384, 144, 768, 144)
  c.wire(576, 144, 576, 272); c.part('res', 'R1', '1k', 576, 272)
  c.wire(576, 352, 576, 416); c.flag(576, 416, '0'); c.flag(768, 144, 'VOUT')
  await c.finish()
}
const previews = fs.readdirSync(path.join(root, 'previews')).filter(f => f.endsWith('.png')).sort()
console.log(`Rebuilt ${previews.length} guided schematics and pin-derived netlists; every pin is connected.`)
const published = path.resolve('public/simulations')
fs.mkdirSync(published, { recursive: true })
for (const preview of previews) {
  const base = preview.slice(0, -4)
  fs.copyFileSync(path.join(root, `${base}.asc`), path.join(published, `${base}.asc`))
  fs.copyFileSync(path.join(root, 'previews', preview), path.join(published, preview))
  await sharp(path.join(root, 'previews', preview)).extract({ left: 0, top: 0, width: 1200, height: 640 }).png().toFile(path.join(published, `${base}-circuit.png`))
}
fs.writeFileSync(path.join(root, 'review.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ohmwork - LTspice review</title><style>body{margin:0;background:#eef1f4;color:#17212b;font:16px Arial}main{max-width:1200px;margin:auto;padding:28px}h1{font-size:28px}section{margin:28px 0;background:white;border:1px solid #cbd2da;border-radius:4px;overflow:hidden}header{display:flex;align-items:center;gap:20px;padding:16px;border-bottom:1px solid #d9dfe5;flex-wrap:wrap}h2{font-size:18px;margin:0;flex:1}a{color:#244b83}img{display:block;width:100%;height:auto}</style><main><h1>Ohmwork - LTspice review</h1>${previews.map(f => { const base = f.slice(0, -4); return `<section><header><h2>${escape(base.replaceAll('-', ' '))}</h2><a href="${base}.asc">LTspice schematic</a><a href="${base}.cir">Pin-derived netlist</a></header><img src="previews/${f}" alt="${escape(base)}"></section>` }).join('')}</main></html>`)
