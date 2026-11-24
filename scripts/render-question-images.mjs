#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  ROOT,
  cleanString,
  escapeHtml,
  publicPathFromFile,
  slugify,
} from './question-import-utils.mjs'

const C = {
  bg: '#0f172a',
  panel: '#111c31',
  panel2: '#0a1a20',
  fg: '#e2e8f0',
  muted: '#94a3b8',
  dim: '#475569',
  teal: '#2dd4bf',
  green: '#4ade80',
  yellow: '#fbbf24',
  red: '#f87171',
  blue: '#818cf8',
  orange: '#fb923c',
}

const args = parseArgs(process.argv.slice(2))
if (!args.input) {
  console.error('Usage: node scripts/render-question-images.mjs content/imports/<batch>/questions.generated.json')
  process.exit(1)
}

const inputPath = resolve(args.input)
const batch = JSON.parse(readFileSync(inputPath, 'utf8'))
const batchId = batch.batch_id || slugify(dirname(inputPath).split('/').pop() || 'batch')
const outputDir = args.outDir
  ? resolve(args.outDir)
  : join(ROOT, 'public', 'diagrams', 'imports', batchId)

mkdirSync(outputDir, { recursive: true })

let rendered = 0
for (const row of batch.rows ?? []) {
  if (!row.images || row.status === 'invalid') continue
  for (const [key, image] of Object.entries(row.images)) {
    const fileName = `${row.slug}-${key}.svg`
    const outputPath = join(outputDir, fileName)
    const svg = renderDiagram({
      type: image.render?.type || 'prompt_card',
      title: image.title || key,
      prompt: image.prompt || '',
    })
    writeFileSync(outputPath, `${svg}\n`)
    image.output_path = publicPathFromFile(outputPath.replace(`${ROOT}/`, ''))
    rendered += 1
  }
}

batch.rendered_at = new Date().toISOString()
writeFileSync(inputPath, `${JSON.stringify(batch, null, 2)}\n`)
const reviewPath = join(dirname(inputPath), 'diagram-review.html')
writeFileSync(reviewPath, buildReviewHtml(batch))
console.log(`Rendered ${rendered} image(s) into ${outputDir}`)
console.log(`Updated ${inputPath}`)
console.log(`Review page: ${reviewPath}`)

function parseArgs(argv) {
  const parsed = { input: null, outDir: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--out-dir') parsed.outDir = argv[++i]
    else if (!parsed.input) parsed.input = arg
    else throw new Error(`Unexpected argument: ${arg}`)
  }
  return parsed
}

function renderDiagram({ type, title, prompt }) {
  const renderers = {
    waveform_comparison: renderWaveformComparison,
    spi_timing: renderSpiTiming,
    bus_comparison: renderBusComparison,
    i2c_address_pins: renderI2cAddressPins,
    op_amp_slew: renderOpAmpSlew,
    ldo_thermal: renderLdoThermal,
    ldo_feedback_pmos: renderLdoFeedbackPmos,
    ldo_feedback_nmos: renderLdoFeedbackNmos,
    capacitor_real_model_srf: renderCapacitorRealModelSrf,
    decoupling_parallel_impedance: renderDecouplingParallelImpedance,
    decoupling_decade_packages: renderDecouplingDecadePackages,
    passive_phase_relationships: renderPassivePhaseRelationships,
    i2c_frame: renderI2cFrame,
    i2c_clock_stretching: renderI2cClockStretching,
    spi_select_daisy_chain: renderSpiSelectDaisyChain,
    open_drain_push_pull: renderOpenDrainPushPull,
    mosfet_symbols: renderMosfetSymbols,
    pn_diode_iv: renderPnDiodeIv,
    zener_gate_clamp_question: renderZenerGateClampQuestion,
    zener_gate_clamp_answer: renderZenerGateClampAnswer,
    pmos_high_side_driver: renderPmosHighSideDriver,
    buck_power_stage: renderBuckPowerStage,
    buck_power_stage_basic: renderBuckPowerStageBasic,
    buck_missing_inductor: renderBuckMissingInductor,
    buck_missing_diode: renderBuckMissingDiode,
    buck_missing_output_capacitor: renderBuckMissingOutputCapacitor,
    buck_missing_input_capacitor: renderBuckMissingInputCapacitor,
    buck_switching_loss: renderBuckSwitchingLoss,
    buck_rectification_comparison: renderBuckRectificationComparison,
    buck_ccm_dcm: renderBuckCcmDcm,
    buck_gate_inductor_current: renderBuckGateInductorCurrent,
    buck_switch_node_waveforms: renderBuckSwitchNodeWaveforms,
    buck_inductor_waveforms: renderBuckInductorWaveforms,
    buck_output_capacitor_waveforms: renderBuckOutputCapacitorWaveforms,
    buck_diode_waveforms: renderBuckDiodeWaveforms,
    buck_input_waveforms: renderBuckInputWaveforms,
    buck_load_waveforms: renderBuckLoadWaveforms,
    buck_low_side_fet_waveforms: renderBuckLowSideFetWaveforms,
    op_amp_spec_matrix: renderOpAmpSpecMatrix,
    op_amp_voltage_follower: renderOpAmpVoltageFollower,
    op_amp_inverting: renderOpAmpInverting,
    op_amp_non_inverting: renderOpAmpNonInverting,
    op_amp_comparator: renderOpAmpComparator,
    op_amp_schmitt_trigger: renderOpAmpSchmittTrigger,
    op_amp_schmitt_inverting: renderOpAmpSchmittInverting,
    op_amp_schmitt_non_inverting: renderOpAmpSchmittNonInverting,
    schmitt_transfer: renderSchmittTransfer,
    schmitt_noise_comparison: renderSchmittNoiseComparison,
    rc_low_pass: renderRcLowPass,
    lc_low_pass: renderLcLowPass,
    lc_high_pass: renderLcHighPass,
    rlc_band_pass: renderRlcBandPass,
    current_sense_high_low: renderCurrentSenseHighLowV2,
    current_shunt_tradeoff: renderCurrentShuntTradeoffV2,
    kelvin_shunt: renderKelvinShuntV2,
    low_side_opamp_current: renderLowSideOpAmpCurrentV2,
    instrumentation_amp_current: renderInstrumentationAmpCurrentV2,
    difference_amp_current: renderDifferenceAmpCurrentV2,
    current_sense_amp: renderCurrentSenseAmpV2,
    current_difference_equation: renderCurrentDifferenceEquation,
    legacy_current_loop: ({ title }) => lightFrame(420, 450, title, currentLoop(210)),
    legacy_current_sense_high_low: renderCurrentSenseHighLow,
    legacy_current_shunt_tradeoff: renderCurrentShuntTradeoff,
    legacy_kelvin_shunt: renderKelvinShunt,
    legacy_low_side_opamp_current: renderLowSideOpAmpCurrent,
    legacy_instrumentation_amp_current: renderInstrumentationAmpCurrent,
    legacy_difference_amp_current: renderDifferenceAmpCurrent,
    legacy_current_sense_amp: renderCurrentSenseAmp,
    schmitt_hysteresis: renderSchmittHysteresis,
    op_amp_difference: renderOpAmpDifference,
    tl_open_20_source: renderTlOpen20Source,
    tl_open_50_source: renderTlOpen50Source,
    s_params_forward: renderSParamsForward,
    s_params_reverse: renderSParamsReverse,
    tl_lc_ladder: renderTlLcLadder,
    tl_z0_fields: renderTlZ0Fields,
    pcb_trace_geometry: renderPcbTraceGeometry,
    pcb_trace_capacitance: renderPcbTraceCapacitance,
    pcb_return_plane: renderPcbReturnPlane,
    pcb_return_via: renderPcbReturnVia,
    pcb_microstrip_stripline: renderPcbMicrostripStripline,
    pcb_microstrip_gcpw: renderPcbMicrostripGcpw,
    differential_noise_rejection: renderDifferentialNoiseRejection,
    pcb_3w_rule: renderPcb3WRule,
    ldo_psrr_iq: renderLdoPssrIq,
    capacitor_bias_chart: renderCapacitorBiasChart,
    inductor_limits: renderInductorLimits,
    tvs_iv_curve: renderTvsIvCurve,
    buck_ic_block: renderBuckIcBlock,
    smd_resistor_packages: renderSmdResistorPackages,
    mosfet_characteristics: renderMosfetCharacteristics,
    uart_crossover: renderUartCrossover,
    bh_hysteresis: renderBhHysteresis,
    mosfet_level_shifter: renderMosfetLevelShifter,
    prompt_card: renderPromptCard,
  }
  return (renderers[type] ?? renderPromptCard)({ title, prompt })
}

function buildReviewHtml(batch) {
  const cards = (batch.rows ?? [])
    .flatMap((row) =>
      Object.entries(row.images ?? {}).map(([key, image]) => {
        const src = image.output_path
          ? `../../../${image.output_path.replace(/^\//, 'public/')}`
          : ''
        return `<article class="card">
  <h2>${escapeHtml(row.slug)} / ${escapeHtml(key)}</h2>
  <p><strong>${escapeHtml(image.title ?? '')}</strong> <span>${escapeHtml(image.render?.type ?? '')}</span></p>
  ${src ? `<img src="${src}" alt="${escapeHtml(image.alt ?? image.title ?? key)}"/>` : '<p class="missing">No output_path</p>'}
  <details><summary>Prompt</summary><p>${escapeHtml(image.prompt ?? '')}</p></details>
</article>`
      })
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(batch.batch_id ?? 'Question diagrams')}</title>
  <style>
    body { margin: 0; padding: 24px; background: #020617; color: #e2e8f0; font-family: Inter, Arial, sans-serif; }
    h1 { margin: 0 0 20px; font-size: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 18px; }
    .card { border: 1px solid #334155; border-radius: 10px; padding: 14px; background: #0f172a; }
    h2 { font-size: 13px; line-height: 1.4; color: #94a3b8; margin: 0 0 8px; word-break: break-word; }
    p { margin: 8px 0; }
    span { color: #2dd4bf; font-size: 12px; margin-left: 8px; }
    img { display: block; width: 100%; height: auto; border-radius: 8px; background: #0f172a; margin-top: 10px; }
    details { margin-top: 10px; color: #cbd5e1; font-size: 13px; }
    summary { cursor: pointer; color: #818cf8; }
    .missing { color: #f87171; }
  </style>
</head>
<body>
  <h1>${escapeHtml(batch.batch_id ?? 'Question diagrams')}</h1>
  <section class="grid">${cards}</section>
</body>
</html>`
}

function frame(width, height, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(title)}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L8,3 z" fill="${C.yellow}"/>
    </marker>
    <marker id="arrow-teal" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L8,3 z" fill="${C.teal}"/>
    </marker>
    ${arrowMarker('arrow-red', C.red)}
    ${arrowMarker('arrow-blue', C.blue)}
    ${arrowMarker('arrow-orange', C.orange)}
    ${arrowMarker('arrow-gray', C.muted)}
  </defs>
  <rect width="100%" height="100%" rx="18" fill="${C.bg}"/>
  ${titleText(title, width)}
  ${body}
</svg>`
}

function lightFrame(width, height, title, body, options = {}) {
  const showTitle = options.showTitle ?? true
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(title)}">
  <defs>
    ${arrowMarker('arrow', '#4b5563')}
    ${arrowMarker('arrow-gray', '#4b5563')}
    ${arrowMarker('arrow-red', '#ef4444')}
    ${arrowMarker('arrow-blue', '#1d4ed8')}
    ${arrowMarker('arrow-teal', '#0ea5a5')}
    ${arrowMarker('arrow-orange', '#f59e0b')}
    ${arrowMarker('arrow-yellow', '#fbbf24')}
  </defs>
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${showTitle ? text(width / 2, 38, title, { fill: '#111827', size: 22, weight: 800 }) : ''}
  ${body}
</svg>`
}

function arrowMarker(id, fill) {
  return `<marker id="${id}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L8,3 z" fill="${fill}"/>
    </marker>`
}

function titleText(title, width) {
  return `<text x="${width / 2}" y="42" fill="${C.fg}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" text-anchor="middle">${escapeHtml(title)}</text>`
}

function text(x, y, value, options = {}) {
  const {
    size = 16,
    fill = C.fg,
    weight = 500,
    anchor = 'middle',
    family = 'Inter, Arial, sans-serif',
  } = options
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeHtml(value)}</text>`
}

function multiline(x, y, value, options = {}) {
  const lines = wrapText(value, options.maxChars ?? 42)
  return `<text x="${x}" y="${y}" fill="${options.fill ?? C.muted}" font-family="Inter, Arial, sans-serif" font-size="${options.size ?? 14}" font-weight="${options.weight ?? 500}" text-anchor="${options.anchor ?? 'middle'}">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : (options.lineHeight ?? 20)}">${escapeHtml(line)}</tspan>`)
    .join('')}</text>`
}

function rect(x, y, w, h, options = {}) {
  const dash = options.dash ? ` stroke-dasharray="${options.dash}"` : ''
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${options.rx ?? 8}" fill="${options.fill ?? C.panel}" stroke="${options.stroke ?? C.dim}" stroke-width="${options.strokeWidth ?? 2}"${dash}/>`
}

function line(x1, y1, x2, y2, options = {}) {
  const dash = options.dash ? ` stroke-dasharray="${options.dash}"` : ''
  const marker = options.arrow ? ` marker-end="url(#${markerName(options.arrow)})"` : ''
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${options.stroke ?? C.fg}" stroke-width="${options.width ?? 3}" stroke-linecap="round"${dash}${marker}/>`
}

function path(d, options = {}) {
  return `<path d="${d}" fill="${options.fill ?? 'none'}" stroke="${options.stroke ?? C.fg}" stroke-width="${options.width ?? 3}" stroke-linecap="round" stroke-linejoin="round"${options.dash ? ` stroke-dasharray="${options.dash}"` : ''}${options.arrow ? ` marker-end="url(#${markerName(options.arrow)})"` : ''}/>`
}

function markerName(arrow) {
  if (arrow === true) return 'arrow'
  return `arrow-${arrow}`
}

function circle(cx, cy, r, options = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${options.fill ?? 'none'}" stroke="${options.stroke ?? C.fg}" stroke-width="${options.strokeWidth ?? 2}"/>`
}

function grid(x, y, w, h) {
  const vertical = Array.from({ length: 9 }, (_, i) => line(x + (w / 8) * i, y, x + (w / 8) * i, y + h, { stroke: '#1e293b', width: 1 }))
  const horizontal = Array.from({ length: 5 }, (_, i) => line(x, y + (h / 4) * i, x + w, y + (h / 4) * i, { stroke: '#1e293b', width: 1 }))
  return [...vertical, ...horizontal].join('\n')
}

function opAmpGeometry(cx, cy, w = 154, h = 132) {
  const left = cx - w / 2
  const right = cx + w / 2
  const top = cy - h / 2
  const bottom = cy + h / 2
  return {
    cx,
    cy,
    left,
    right,
    top,
    bottom,
    minus: { x: left, y: cy - h * 0.25 },
    plus: { x: left, y: cy + h * 0.25 },
    out: { x: right, y: cy },
  }
}

function opAmp(cx, cy, options = {}) {
  const g = opAmpGeometry(cx, cy, options.w, options.h)
  return `
    <path d="M${g.left} ${g.top} L${g.left} ${g.bottom} L${g.right} ${g.cy} Z" fill="${options.fill ?? C.panel2}" stroke="${options.stroke ?? C.teal}" stroke-width="3"/>
    ${text(g.left + 27, g.minus.y - 9, '-', { fill: C.red, size: 22, weight: 800 })}
    ${text(g.left + 27, g.plus.y + 23, '+', { fill: C.green, size: 22, weight: 800 })}
    ${text(g.cx + 8, g.cy + 6, options.label ?? 'op-amp', { fill: C.fg, size: options.labelSize ?? 16, weight: 700 })}
  `
}

function resistorH(x1, y, x2, label, options = {}) {
  const lead = Math.min(22, Math.max(10, (x2 - x1) * 0.18))
  const bodyX = x1 + lead
  const bodyW = x2 - x1 - lead * 2
  return `
    ${line(x1, y, bodyX, y, { stroke: options.stroke ?? C.fg, width: options.width ?? 3 })}
    ${rect(bodyX, y - 13, bodyW, 26, { fill: options.fill ?? '#101827', stroke: options.stroke ?? C.yellow, strokeWidth: 2, rx: 5 })}
    ${line(bodyX + bodyW, y, x2, y, { stroke: options.stroke ?? C.fg, width: options.width ?? 3 })}
    ${text((x1 + x2) / 2, y - 23, label, { fill: options.labelFill ?? C.yellow, size: options.size ?? 14 })}
  `
}

function resistorV(x, y1, y2, label, options = {}) {
  const lead = Math.min(22, Math.max(10, (y2 - y1) * 0.18))
  const bodyY = y1 + lead
  const bodyH = y2 - y1 - lead * 2
  return `
    ${line(x, y1, x, bodyY, { stroke: options.stroke ?? C.fg, width: options.width ?? 3 })}
    ${rect(x - 13, bodyY, 26, bodyH, { fill: options.fill ?? '#101827', stroke: options.stroke ?? C.yellow, strokeWidth: 2, rx: 5 })}
    ${line(x, bodyY + bodyH, x, y2, { stroke: options.stroke ?? C.fg, width: options.width ?? 3 })}
    ${text(x + 28, (y1 + y2) / 2 + 5, label, { fill: options.labelFill ?? C.yellow, size: options.size ?? 14, anchor: 'start' })}
  `
}

function ground(x, y) {
  return `
    ${line(x, y, x, y + 14, { stroke: C.fg, width: 3 })}
    ${line(x - 20, y + 14, x + 20, y + 14, { stroke: C.fg, width: 3 })}
    ${line(x - 14, y + 24, x + 14, y + 24, { stroke: C.fg, width: 3 })}
    ${line(x - 8, y + 34, x + 8, y + 34, { stroke: C.fg, width: 3 })}
  `
}

function junction(x, y) {
  return circle(x, y, 5, { fill: C.yellow, stroke: C.yellow, strokeWidth: 1 })
}

function sourceSymbol(cx, cy, stroke = '#1d4ed8') {
  return `
    ${circle(cx, cy, 18, { fill: '#ffffff', stroke, strokeWidth: 2 })}
    ${text(cx, cy - 4, '+', { fill: stroke, size: 12, weight: 700 })}
    ${text(cx, cy + 12, '-', { fill: stroke, size: 12, weight: 700 })}
    ${line(cx, cy + 18, cx, cy + 40, { stroke, width: 2 })}
    ${schematicGround(cx, cy + 40, stroke)}
  `
}

function zigzagResistor(x1, y1, x2, y2, stroke = '#111827') {
  if (x1 === x2) {
    const step = (y2 - y1) / 8
    const points = [
      [x1, y1],
      [x1 - 9, y1 + step],
      [x1 + 9, y1 + step * 2],
      [x1 - 9, y1 + step * 3],
      [x1 + 9, y1 + step * 4],
      [x1 - 9, y1 + step * 5],
      [x1 + 9, y1 + step * 6],
      [x1 - 9, y1 + step * 7],
      [x2, y2],
    ]
    return `<polyline points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
  }

  const step = (x2 - x1) / 8
  const points = [
    [x1, y1],
    [x1 + step, y1 - 9],
    [x1 + step * 2, y1 + 9],
    [x1 + step * 3, y1 - 9],
    [x1 + step * 4, y1 + 9],
    [x1 + step * 5, y1 - 9],
    [x1 + step * 6, y1 + 9],
    [x1 + step * 7, y1 - 9],
    [x2, y2],
  ]
  return `<polyline points="${points.map(([x, y]) => `${x},${y}`).join(' ')}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
}

function schematicGround(x, y, stroke = '#1d4ed8') {
  return `
    ${line(x, y, x, y + 8, { stroke, width: 2 })}
    <path d="M${x - 12} ${y + 8} L${x} ${y + 22} L${x + 12} ${y + 8} Z" fill="none" stroke="${stroke}" stroke-width="2"/>
  `
}

function renderWaveformComparison({ title }) {
  const body = `
    ${rect(44, 78, 310, 210)}
    ${rect(386, 78, 310, 210)}
    ${text(199, 112, 'Clean I2C edge', { fill: C.green, size: 17 })}
    ${text(541, 112, 'Too much RC', { fill: C.red, size: 17 })}
    ${grid(76, 134, 246, 110)}
    ${grid(418, 134, 246, 110)}
    ${path('M82 228 L122 228 L122 150 L212 150 L212 228 L308 228', { stroke: C.green, width: 4 })}
    ${path('M424 150 L466 150 L466 228 L520 228 C532 184 570 152 644 150', { stroke: C.yellow, width: 4 })}
    ${line(466, 150, 466, 228, { stroke: C.teal, width: 3 })}
    ${text(199, 268, 'Strong pull-up / low capacitance', { fill: C.muted, size: 14 })}
    ${text(541, 268, 'fast fall, slow "shark fin" rise', { fill: C.muted, size: 14 })}
    ${line(574, 204, 622, 174, { stroke: C.yellow, width: 2, arrow: true })}
    ${text(628, 176, 'slow rise', { fill: C.yellow, size: 13, anchor: 'start' })}
  `
  return frame(740, 330, title, body)
}

function renderSpiTiming({ title }) {
  const body = `
    ${rect(52, 90, 636, 214)}
    ${text(92, 138, 'SCLK', { anchor: 'start', fill: C.muted, size: 15 })}
    ${path('M150 126 L250 126 L250 204 L415 204 L415 126 L588 126', { stroke: C.teal, width: 4 })}
    ${text(173, 106, 'idle HIGH', { fill: C.green, size: 14 })}
    ${line(250, 96, 250, 258, { stroke: C.dim, width: 2, dash: '8 7' })}
    ${line(415, 96, 415, 258, { stroke: C.yellow, width: 3, dash: '8 7' })}
    ${text(250, 280, 'first edge: falling', { fill: C.muted, size: 14 })}
    ${text(415, 280, 'second edge: rising', { fill: C.yellow, size: 14 })}
    ${text(92, 216, 'MISO', { anchor: 'start', fill: C.muted, size: 15 })}
    ${path('M150 218 L222 218 L242 190 L390 190 L412 218 L588 218', { stroke: C.blue, width: 4 })}
    ${text(320, 180, 'data valid', { fill: C.blue, size: 14 })}
    ${text(415, 82, 'sample data here', { fill: C.yellow, size: 15, weight: 700 })}
    ${line(415, 90, 415, 118, { stroke: C.yellow, width: 2, arrow: true })}
    ${text(370, 326, 'CPOL = 1, CPHA = 1', { fill: C.fg, size: 22, weight: 700 })}
  `
  return frame(740, 360, title, body)
}

function renderBusComparison({ title }) {
  const leftYs = [124, 168, 212, 256]
  const rightYs = [112, 156, 200, 244]
  const leftSensors = leftYs.map((y, i) => `
    ${rect(254, y - 18, 94, 36, { fill: C.panel2, stroke: C.teal })}
    ${text(301, y + 5, `Sensor ${i + 1}`, { size: 12 })}
    ${line(224, y - 6, 254, y - 6, { stroke: C.teal, width: 2 })}
    ${line(238, y + 6, 254, y + 6, { stroke: C.teal, width: 2 })}
  `).join('')
  const rightSensors = rightYs.map((y, i) => `
    ${rect(606, y - 18, 94, 36, { fill: C.panel2, stroke: C.blue })}
    ${text(653, y + 5, `Sensor ${i + 1}`, { size: 12 })}
    ${line(548, y - 9, 606, y - 9, { stroke: C.blue, width: 2 })}
    ${line(494, y + 15, 606, y + 15, { stroke: C.yellow, width: 2 })}
    ${text(514, y + 10, `CS${i + 1}`, { fill: C.yellow, size: 10, anchor: 'start' })}
  `).join('')
  const body = `
    ${text(190, 84, 'I2C: 2 MCU pins', { fill: C.green, size: 19, weight: 700 })}
    ${rect(54, 132, 92, 116, { fill: C.panel2, stroke: C.teal })}
    ${text(100, 196, 'MCU', { size: 18, weight: 700 })}
    ${line(146, 168, 224, 168, { stroke: C.teal, width: 3 })}
    ${line(146, 202, 238, 202, { stroke: C.teal, width: 3 })}
    ${line(224, 102, 224, 278, { stroke: C.teal, width: 3 })}
    ${line(238, 102, 238, 278, { stroke: C.teal, width: 3 })}
    ${text(184, 158, 'SDA', { fill: C.teal, size: 12 })}
    ${text(184, 222, 'SCL', { fill: C.teal, size: 12 })}
    ${leftSensors}
    ${text(556, 84, 'SPI: 7 MCU pins', { fill: C.yellow, size: 19, weight: 700 })}
    ${rect(398, 126, 96, 132, { fill: C.panel2, stroke: C.blue })}
    ${text(446, 196, 'MCU', { size: 18, weight: 700 })}
    ${line(494, 150, 548, 150, { stroke: C.blue, width: 3 })}
    ${line(548, 94, 548, 270, { stroke: C.blue, width: 3 })}
    ${text(542, 288, 'MOSI / MISO / SCK', { fill: C.blue, size: 12 })}
    ${text(542, 306, '3 shared lines', { fill: C.blue, size: 12 })}
    ${rightSensors}
  `
  return frame(740, 330, title, body)
}

function renderI2cAddressPins({ title }) {
  const body = `
    ${rect(60, 122, 112, 92, { fill: C.panel2, stroke: C.teal })}
    ${text(116, 174, 'MCU', { size: 20, weight: 700 })}
    ${line(172, 150, 612, 150, { stroke: C.teal, width: 4 })}
    ${line(172, 186, 612, 186, { stroke: C.teal, width: 4 })}
    ${text(190, 140, 'SDA', { fill: C.teal, size: 13, anchor: 'start' })}
    ${text(190, 207, 'SCL', { fill: C.teal, size: 13, anchor: 'start' })}
    ${rect(300, 96, 128, 92, { fill: C.panel, stroke: C.blue })}
    ${text(364, 138, 'Sensor A', { size: 17, weight: 700 })}
    ${text(364, 164, '0x48', { fill: C.green, size: 15 })}
    ${line(364, 188, 364, 238, { stroke: C.yellow, width: 3 })}
    ${line(344, 238, 384, 238, { stroke: C.dim, width: 3 })}
    ${text(364, 258, 'ADDR = GND', { fill: C.yellow, size: 13 })}
    ${rect(500, 96, 128, 92, { fill: C.panel, stroke: C.blue })}
    ${text(564, 138, 'Sensor B', { size: 17, weight: 700 })}
    ${text(564, 164, '0x49', { fill: C.green, size: 15 })}
    ${line(564, 96, 564, 66, { stroke: C.yellow, width: 3 })}
    ${line(544, 66, 584, 66, { stroke: C.green, width: 3 })}
    ${text(564, 56, 'ADDR = VCC', { fill: C.yellow, size: 13 })}
  `
  return frame(700, 310, title, body)
}

function renderOpAmpSlew({ title }) {
  const body = `
    ${rect(48, 88, 292, 214)}
    ${rect(400, 88, 292, 214)}
    ${text(194, 122, 'Input request', { fill: C.green, size: 17 })}
    ${text(546, 122, 'Output limit', { fill: C.red, size: 17 })}
    ${grid(80, 142, 228, 112)}
    ${grid(432, 142, 228, 112)}
    ${path('M90 234 L130 234 L130 154 L210 154 L210 234 L296 234', { stroke: C.green, width: 4 })}
    ${path('M442 234 L480 234 L552 154 L618 154 L650 188', { stroke: C.orange, width: 4 })}
    ${line(510, 220, 552, 176, { stroke: C.yellow, width: 3, arrow: true })}
    ${text(566, 210, 'SR = ΔV / Δt', { fill: C.yellow, size: 15, anchor: 'start' })}
  `
  return frame(740, 340, title, body)
}

function renderLdoThermal({ title }) {
  const heat = [0, 1, 2, 3].map((i) => path(`M${270 + i * 28} 100 C${254 + i * 28} 82 ${286 + i * 28} 68 ${270 + i * 28} 52`, { stroke: C.red, width: 3 })).join('')
  const body = `
    ${line(70, 170, 238, 170, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${rect(238, 112, 180, 116, { fill: C.panel2, stroke: C.teal })}
    ${text(328, 164, 'LDO', { size: 30, weight: 800 })}
    ${text(328, 196, 'linear regulator', { fill: C.muted, size: 14 })}
    ${line(418, 170, 594, 170, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${text(96, 152, 'Vin', { fill: C.green, size: 18 })}
    ${text(570, 152, 'Vout', { fill: C.green, size: 18 })}
    ${heat}
    ${text(418, 96, 'heat to ambient', { fill: C.red, size: 14, anchor: 'start' })}
    ${text(330, 262, 'P_D = (V_in - V_out) * I_load', { fill: C.yellow, size: 22, weight: 700 })}
    ${text(330, 296, 'Check dropout voltage and theta_JA', { fill: C.muted, size: 16 })}
  `
  return frame(700, 340, title, body)
}

function renderLdoFeedbackPmos({ title }) {
  return renderLdoFeedback({ title, device: 'PMOS' })
}

function renderLdoFeedbackNmos({ title }) {
  return renderLdoFeedback({ title, device: 'NMOS' })
}

function renderLdoFeedback({ title, device }) {
  const isPmos = device === 'PMOS'
  const fbY = isPmos ? 256 : 316
  const refY = isPmos ? 316 : 256
  const response = isPmos
    ? 'VOUT rises -> VFB rises -> gate rises -> PMOS conducts less -> VOUT falls'
    : 'VOUT falls -> VFB falls -> gate rises -> NMOS conducts more -> VOUT rises'
  const body = `
    ${text(70, 126, 'VIN', { fill: C.green, size: 18, weight: 800, anchor: 'start' })}
    ${line(70, 150, 154, 150, { stroke: C.green, width: 4 })}
    ${rect(154, 106, 150, 88, { fill: C.panel2, stroke: isPmos ? C.orange : C.blue, rx: 6 })}
    ${text(229, 140, `${device} PASS`, { fill: isPmos ? C.orange : C.blue, size: 17, weight: 800 })}
    ${text(229, 166, isPmos ? 'source -> drain' : 'drain -> source', { fill: C.muted, size: 12 })}
    ${line(304, 150, 502, 150, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${circle(394, 150, 6, { fill: C.green, stroke: C.green })}
    ${text(492, 126, 'VOUT', { fill: C.green, size: 18, weight: 800, anchor: 'end' })}

    ${line(394, 150, 394, 192, { stroke: C.fg, width: 3 })}
    ${rect(366, 192, 56, 70, { fill: C.panel2, stroke: C.yellow, rx: 3 })}
    ${text(394, 232, 'R1', { fill: C.yellow, size: 15, weight: 800 })}
    ${line(394, 262, 394, 278, { stroke: C.fg, width: 3 })}
    ${circle(394, 278, 6, { fill: C.teal, stroke: C.teal })}
    ${rect(366, 294, 56, 56, { fill: C.panel2, stroke: C.yellow, rx: 3 })}
    ${text(394, 327, 'R2', { fill: C.yellow, size: 15, weight: 800 })}
    ${line(394, 350, 394, 358, { stroke: C.fg, width: 3 })}
    ${ground(394, 358)}
    ${text(370, 274, 'VFB', { fill: C.teal, size: 15, weight: 800, anchor: 'end' })}

    ${path('M620 226 L620 346 L742 286 Z', { fill: C.panel2, stroke: C.blue, width: 3 })}
    ${text(668, 292, 'ERROR', { size: 14, weight: 800 })}
    ${text(668, 312, 'AMP', { size: 14, weight: 800 })}
    ${text(608, 262, isPmos ? '+' : '-', { fill: isPmos ? C.green : C.red, size: 22, weight: 800 })}
    ${text(608, 322, isPmos ? '-' : '+', { fill: isPmos ? C.red : C.green, size: 22, weight: 800 })}
    ${path(`M394 278 L520 278 L520 ${fbY} L620 ${fbY}`, { stroke: C.teal, width: 3 })}
    ${line(520, refY, 620, refY, { stroke: C.yellow, width: 3 })}
    ${text(512, refY - 10, 'VREF', { fill: C.yellow, size: 14, weight: 800, anchor: 'end' })}

    ${line(742, 286, 790, 286, { stroke: C.orange, width: 4 })}
    ${path('M790 286 L790 82 L229 82 L229 106', { stroke: C.orange, width: 4, arrow: 'orange' })}
    ${text(770, 270, 'VGATE', { fill: C.orange, size: 14, weight: 800, anchor: 'end' })}
    ${text(512, 420, response, { fill: C.fg, size: 15, weight: 800 })}
    ${text(512, 446, 'The polarity closes a negative-feedback loop.', { fill: C.muted, size: 14 })}
  `
  return frame(900, 480, title, body)
}

function renderCapacitorRealModelSrf({ title }) {
  const body = `
    ${rect(34, 78, 400, 320, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(234, 112, 'Equivalent circuit', { fill: C.teal, size: 18, weight: 800 })}
    ${circle(66, 220, 6, { fill: C.fg, stroke: C.fg })}
    ${circle(400, 220, 6, { fill: C.fg, stroke: C.fg })}
    ${line(66, 220, 94, 220, { stroke: C.fg, width: 3 })}
    ${path('M94 220 C104 198 116 242 126 220 C136 198 148 242 158 220', { stroke: C.blue, width: 3 })}
    ${text(126, 188, 'ESL', { fill: C.blue, size: 14, weight: 800 })}
    ${zigzagResistor(158, 220, 246, 220, C.orange)}
    ${text(202, 188, 'ESR', { fill: C.orange, size: 14, weight: 800 })}
    ${line(246, 220, 284, 220, { stroke: C.fg, width: 3 })}
    ${line(284, 194, 284, 246, { stroke: C.yellow, width: 4 })}
    ${line(300, 194, 300, 246, { stroke: C.yellow, width: 4 })}
    ${text(292, 178, 'C', { fill: C.yellow, size: 15, weight: 800 })}
    ${line(300, 220, 400, 220, { stroke: C.fg, width: 3 })}
    ${line(66, 220, 66, 318, { stroke: C.muted, width: 2 })}
    ${zigzagResistor(66, 318, 400, 318, C.red)}
    ${line(400, 318, 400, 220, { stroke: C.muted, width: 2 })}
    ${text(234, 294, 'RLEAK', { fill: C.red, size: 14, weight: 800 })}
    ${text(234, 368, 'Leakage resistance is in parallel with the series R-L-C branch.', { fill: C.muted, size: 13 })}

    ${rect(466, 78, 400, 320, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(666, 112, 'Impedance vs frequency', { fill: C.teal, size: 18, weight: 800 })}
    ${line(520, 346, 828, 346, { stroke: C.fg, width: 2, arrow: 'gray' })}
    ${line(520, 346, 520, 142, { stroke: C.fg, width: 2, arrow: 'gray' })}
    ${text(826, 372, 'Frequency (log)', { fill: C.muted, size: 12, anchor: 'end' })}
    ${text(494, 152, '|Z|', { fill: C.muted, size: 13 })}
    ${path('M542 164 L650 316 L812 126', { stroke: C.green, width: 5 })}
    ${circle(650, 316, 7, { fill: C.yellow, stroke: C.yellow })}
    ${line(650, 142, 650, 346, { stroke: C.yellow, width: 2, dash: '7 6' })}
    ${text(650, 338, 'SRF', { fill: C.yellow, size: 13, weight: 800 })}
    ${text(580, 206, 'capacitive', { fill: C.blue, size: 14, weight: 700 })}
    ${text(752, 206, 'inductive', { fill: C.orange, size: 14, weight: 700 })}
    ${text(650, 298, 'minimum = ESR', { fill: C.yellow, size: 12, weight: 700 })}
  `
  return frame(900, 430, title, body)
}

function renderDecouplingParallelImpedance({ title }) {
  const body = `
    ${rect(54, 78, 792, 320, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${line(112, 346, 800, 346, { stroke: C.fg, width: 2, arrow: 'gray' })}
    ${line(112, 346, 112, 126, { stroke: C.fg, width: 2, arrow: 'gray' })}
    ${text(796, 374, 'Frequency (log)', { fill: C.muted, size: 13, anchor: 'end' })}
    ${text(82, 136, '|Z|', { fill: C.muted, size: 13 })}
    ${path('M136 148 L306 314 L480 156', { stroke: C.blue, width: 3, dash: '8 6' })}
    ${path('M224 146 L438 314 L646 154', { stroke: C.orange, width: 3, dash: '8 6' })}
    ${path('M350 148 L590 314 L780 164', { stroke: C.red, width: 3, dash: '8 6' })}
    ${text(252, 170, '4.7 uF', { fill: C.blue, size: 14, weight: 800 })}
    ${text(448, 180, '1 uF', { fill: C.orange, size: 14, weight: 800 })}
    ${text(670, 178, '0.1 uF', { fill: C.red, size: 14, weight: 800 })}
    ${path('M136 148 L306 314 L366 258 L438 314 L510 259 L590 314 L780 164', { stroke: C.green, width: 6 })}
    ${text(452, 276, 'combined parallel impedance', { fill: C.green, size: 14, weight: 800 })}
    ${line(286, 328, 612, 328, { stroke: C.yellow, width: 3 })}
    ${text(449, 354, 'broadband low impedance', { fill: C.yellow, size: 13, weight: 800 })}
  `
  return frame(900, 430, title, body)
}

function renderDecouplingDecadePackages({ title }) {
  const body = `
    ${rect(54, 78, 792, 320, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${line(112, 346, 800, 346, { stroke: C.fg, width: 2, arrow: 'gray' })}
    ${line(112, 346, 112, 126, { stroke: C.fg, width: 2, arrow: 'gray' })}
    ${text(796, 374, 'Frequency (log)', { fill: C.muted, size: 13, anchor: 'end' })}
    ${text(82, 136, '|Z|', { fill: C.muted, size: 13 })}
    ${path('M136 148 L382 314 L618 154', { stroke: C.orange, width: 3, dash: '8 6' })}
    ${path('M300 150 L594 314 L780 168', { stroke: C.red, width: 3, dash: '8 6' })}
    ${text(286, 176, '1 uF / 0402', { fill: C.orange, size: 15, weight: 800 })}
    ${text(674, 190, '0.1 uF / 0201', { fill: C.red, size: 15, weight: 800 })}
    ${circle(382, 314, 6, { fill: C.orange, stroke: C.orange })}
    ${circle(594, 314, 6, { fill: C.red, stroke: C.red })}
    ${text(382, 338, 'lower SRF', { fill: C.orange, size: 12, weight: 700 })}
    ${text(594, 338, 'higher SRF', { fill: C.red, size: 12, weight: 700 })}
    ${path('M136 148 L382 314 L478 249 L594 314 L780 168', { stroke: C.blue, width: 6 })}
    ${text(490, 272, 'overall parallel impedance', { fill: C.blue, size: 14, weight: 800 })}
  `
  return frame(900, 430, title, body)
}

function sampledSine(x, y, width, amplitude, phase = 0) {
  const points = Array.from({ length: 65 }, (_, index) => {
    const t = index / 64
    return `${(x + t * width).toFixed(1)},${(y - Math.sin(t * Math.PI * 4 + phase) * amplitude).toFixed(1)}`
  })
  return `M${points.join(' L')}`
}

function renderPassivePhaseRelationships({ title }) {
  const panel = (y, label, relationship, vPhase, iPhase) => `
    ${rect(44, y, 812, 116, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(70, y + 28, label, { fill: C.yellow, size: 16, weight: 800, anchor: 'start' })}
    ${text(824, y + 28, relationship, { fill: C.muted, size: 13, anchor: 'end' })}
    ${line(176, y + 72, 816, y + 72, { stroke: C.dim, width: 1 })}
    ${path(sampledSine(176, y + 72, 640, 28, vPhase), { stroke: C.green, width: 4 })}
    ${path(sampledSine(176, y + 72, 640, 28, iPhase), { stroke: C.blue, width: 3, dash: '7 5' })}
  `
  const body = `
    ${panel(70, 'RESISTOR', 'V and I in phase (0 deg)', 0, 0)}
    ${panel(202, 'CAPACITOR', 'I leads V by 90 deg', 0, Math.PI / 2)}
    ${panel(334, 'INDUCTOR', 'V leads I by 90 deg', Math.PI / 2, 0)}
    ${line(606, 476, 648, 476, { stroke: C.green, width: 4 })}
    ${text(660, 481, 'V', { fill: C.green, size: 14, weight: 800, anchor: 'start' })}
    ${line(704, 476, 746, 476, { stroke: C.blue, width: 3, dash: '7 5' })}
    ${text(758, 481, 'I', { fill: C.blue, size: 14, weight: 800, anchor: 'start' })}
  `
  return frame(900, 510, title, body)
}

function renderI2cFrame({ title }) {
  const blocks = [
    [50, 70, 'START', C.green], [120, 238, '7-bit address', C.blue], [358, 62, 'R/W', C.orange],
    [420, 58, 'ACK', C.yellow], [478, 230, '8-bit data', C.teal], [708, 58, 'ACK', C.yellow], [766, 82, 'STOP', C.red],
  ]
  const frameBlocks = blocks.map(([x, w, label, stroke]) => `
    ${rect(x, 152, w, 82, { fill: '#0b1528', stroke, rx: 4 })}
    ${text(x + w / 2, 188, label, { fill: stroke, size: w < 70 ? 13 : 16, weight: 800 })}
    ${text(x + w / 2, 214, w === 238 ? 'A6 ... A0' : w === 230 ? 'D7 ... D0' : w === 62 ? '1 bit' : '', { fill: C.muted, size: 11 })}
  `).join('')
  const body = `
    ${text(450, 104, 'One addressed byte transfer', { fill: C.fg, size: 17, weight: 800 })}
    ${frameBlocks}
    ${line(50, 270, 848, 270, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${text(50, 294, 'SDA changes while SCL is LOW; receiver samples while SCL is HIGH.', { fill: C.muted, size: 13, anchor: 'start' })}
    ${rect(170, 326, 560, 58, { fill: C.panel2, stroke: C.teal, rx: 5 })}
    ${text(450, 350, '7-bit addressing = 128 codes', { fill: C.teal, size: 16, weight: 800 })}
    ${text(450, 374, 'Typically 112 usable device addresses after reserved ranges', { fill: C.muted, size: 13 })}
  `
  return frame(900, 420, title, body)
}

function renderI2cClockStretching({ title }) {
  const body = `
    ${rect(54, 78, 792, 326, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(82, 136, 'Master intent', { fill: C.muted, size: 14, anchor: 'start' })}
    ${path('M200 124 L250 124 L250 174 L300 174 L300 124 L350 124 L350 174 L400 174 L400 124 L450 124 L450 174 L500 174 L500 124 L550 124 L550 174 L600 174 L600 124 L650 124', { stroke: C.muted, width: 3, dash: '7 5' })}
    ${text(82, 236, 'Actual SCL', { fill: C.teal, size: 14, weight: 800, anchor: 'start' })}
    ${path('M200 224 L250 224 L250 274 L300 274 L300 224 L350 224 L350 274 L600 274 L600 224 L650 224 L650 274 L700 274', { stroke: C.teal, width: 4 })}
    ${rect(350, 252, 250, 44, { fill: '#3a2510', stroke: C.orange, rx: 4 })}
    ${text(475, 280, 'SLAVE HOLDS SCL LOW', { fill: C.orange, size: 14, weight: 800 })}
    ${line(350, 104, 350, 328, { stroke: C.orange, width: 2, dash: '7 5' })}
    ${line(600, 104, 600, 328, { stroke: C.green, width: 2, dash: '7 5' })}
    ${text(350, 342, 'master releases', { fill: C.orange, size: 12 })}
    ${text(600, 342, 'slave releases', { fill: C.green, size: 12 })}
    ${text(475, 378, 'The master waits; data transfer resumes only after SCL can rise.', { fill: C.fg, size: 15, weight: 700 })}
  `
  return frame(900, 440, title, body)
}

function renderSpiSelectDaisyChain({ title }) {
  const body = `
    ${rect(34, 78, 404, 338, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(236, 110, 'Dedicated chip selects', { fill: C.teal, size: 18, weight: 800 })}
    ${rect(58, 174, 104, 98, { fill: C.panel2, stroke: C.blue })}
    ${text(110, 226, 'MASTER', { fill: C.blue, size: 16, weight: 800 })}
    ${[0, 1, 2].map((i) => `
      ${rect(292, 138 + i * 82, 112, 54, { fill: C.panel2, stroke: C.teal, rx: 5 })}
      ${text(348, 170 + i * 82, `SLAVE ${i + 1}`, { size: 13, weight: 800 })}
      ${path(`M162 ${194 + i * 18} L${206 + i * 12} ${194 + i * 18} L${206 + i * 12} ${165 + i * 82} L292 ${165 + i * 82}`, { stroke: [C.yellow, C.orange, C.red][i], width: 3 })}
      ${text(178, 188 + i * 18, `CS${i + 1}`, { fill: [C.yellow, C.orange, C.red][i], size: 11, anchor: 'start' })}
    `).join('')}
    ${text(236, 386, '3 slaves require 3 CS pins', { fill: C.muted, size: 13 })}

    ${rect(462, 78, 404, 338, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(664, 110, 'Daisy-chained data', { fill: C.green, size: 18, weight: 800 })}
    ${rect(490, 144, 96, 66, { fill: C.panel2, stroke: C.blue })}
    ${text(538, 182, 'MASTER', { fill: C.blue, size: 14, weight: 800 })}
    ${[0, 1, 2].map((i) => `
      ${rect(500 + i * 112, 268, 92, 58, { fill: C.panel2, stroke: C.teal, rx: 5 })}
      ${text(546 + i * 112, 302, `S${i + 1}`, { size: 14, weight: 800 })}
    `).join('')}
    ${path('M538 210 L538 242 L476 242 L476 297 L500 297', { stroke: C.green, width: 4 })}
    ${path('M592 297 L612 297', { stroke: C.green, width: 4 })}
    ${path('M704 297 L724 297', { stroke: C.green, width: 4 })}
    ${path('M816 297 L842 297 L842 174 L586 174', { stroke: C.green, width: 4 })}
    <path d="M500 297 l-9 -5 v10 z M612 297 l-9 -5 v10 z M724 297 l-9 -5 v10 z M586 174 l9 -5 v10 z" fill="${C.green}" stroke="none"/>
    ${[0, 1, 2].map((i) => `
      ${text(508 + i * 112, 288, 'SDI', { fill: C.muted, size: 9, weight: 700, anchor: 'start' })}
      ${text(584 + i * 112, 288, 'SDO', { fill: C.muted, size: 9, weight: 700, anchor: 'end' })}
    `).join('')}
    ${line(500, 352, 816, 352, { stroke: C.yellow, width: 3 })}
    ${[546, 658, 770].map((x) => line(x, 326, x, 352, { stroke: C.yellow, width: 2 })).join('')}
    ${text(658, 376, 'one shared CS (and shared clock)', { fill: C.yellow, size: 13, weight: 700 })}
    ${text(500, 232, 'MOSI enters first SDI', { fill: C.green, size: 11 })}
    ${text(658, 250, 'each SDO feeds next SDI', { fill: C.green, size: 11 })}
    ${text(750, 164, 'final SDO returns as MISO', { fill: C.green, size: 11 })}
  `
  return frame(900, 450, title, body)
}

function renderOpenDrainPushPull({ title }) {
  const body = `
    ${rect(34, 78, 404, 338, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(236, 110, 'I2C: open-drain', { fill: C.teal, size: 18, weight: 800 })}
    ${text(96, 150, 'VCC', { fill: C.green, size: 14, weight: 800 })}
    ${zigzagResistor(96, 164, 96, 244, C.yellow)}
    ${text(126, 204, 'external pull-up', { fill: C.yellow, size: 12, anchor: 'start' })}
    ${line(96, 244, 292, 244, { stroke: C.teal, width: 4 })}
    ${circle(210, 244, 6, { fill: C.teal, stroke: C.teal })}
    ${text(302, 249, 'BUS', { fill: C.teal, size: 15, weight: 800, anchor: 'start' })}
    ${rect(160, 278, 100, 60, { fill: C.panel2, stroke: C.blue })}
    ${text(210, 314, 'NMOS', { fill: C.blue, size: 15, weight: 800 })}
    ${line(210, 244, 210, 278, { stroke: C.fg, width: 3 })}
    ${line(210, 338, 210, 342, { stroke: C.fg, width: 3 })}
    ${ground(210, 342)}
    ${text(236, 398, 'actively LOW, passively HIGH', { fill: C.muted, size: 13 })}

    ${rect(462, 78, 404, 338, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(664, 110, 'SPI: push-pull', { fill: C.orange, size: 18, weight: 800 })}
    ${text(646, 132, 'VCC', { fill: C.green, size: 14, weight: 800, anchor: 'end' })}
    ${rect(610, 154, 108, 60, { fill: C.panel2, stroke: C.orange })}
    ${text(664, 190, 'PMOS', { fill: C.orange, size: 15, weight: 800 })}
    ${line(664, 126, 664, 154, { stroke: C.fg, width: 3 })}
    ${line(664, 214, 664, 244, { stroke: C.fg, width: 3 })}
    ${circle(664, 244, 6, { fill: C.teal, stroke: C.teal })}
    ${line(664, 244, 782, 244, { stroke: C.teal, width: 4 })}
    ${text(792, 249, 'OUT', { fill: C.teal, size: 15, weight: 800, anchor: 'start' })}
    ${rect(610, 274, 108, 60, { fill: C.panel2, stroke: C.blue })}
    ${text(664, 310, 'NMOS', { fill: C.blue, size: 15, weight: 800 })}
    ${line(664, 244, 664, 274, { stroke: C.fg, width: 3 })}
    ${line(664, 334, 664, 342, { stroke: C.fg, width: 3 })}
    ${ground(664, 342)}
    ${text(664, 398, 'actively drives HIGH and LOW', { fill: C.muted, size: 13 })}
  `
  return frame(900, 450, title, body)
}

function renderBuckPowerStage({ title }) {
  const body = `
    ${line(80, 100, 80, 262, { stroke: C.green, width: 4 })}
    ${text(80, 86, 'VIN', { fill: C.green, size: 18 })}
    ${rect(150, 112, 72, 56, { fill: C.panel2, stroke: C.teal })}
    ${text(186, 146, 'HS FET', { size: 13 })}
    ${rect(150, 206, 72, 56, { fill: C.panel2, stroke: C.teal })}
    ${text(186, 240, 'LS FET', { size: 13 })}
    ${line(80, 140, 150, 140, { stroke: C.fg, width: 3 })}
    ${line(222, 168, 274, 188, { stroke: C.yellow, width: 4 })}
    ${line(222, 206, 274, 188, { stroke: C.yellow, width: 4 })}
    ${circle(274, 188, 7, { fill: C.yellow, stroke: C.yellow })}
    ${text(274, 174, 'SW', { fill: C.yellow, size: 14 })}
    ${path('M274 188 C296 158 322 218 344 188 C366 158 392 218 414 188', { stroke: C.fg, width: 4 })}
    ${text(344, 154, 'L', { size: 18, weight: 700 })}
    ${line(414, 188, 548, 188, { stroke: C.fg, width: 3 })}
    ${text(568, 184, 'VOUT', { fill: C.green, size: 18, anchor: 'start' })}
    ${line(494, 188, 494, 246, { stroke: C.fg, width: 3 })}
    ${line(474, 246, 514, 246, { stroke: C.blue, width: 4 })}
    ${line(474, 260, 514, 260, { stroke: C.blue, width: 4 })}
    ${line(494, 260, 494, 294, { stroke: C.dim, width: 3 })}
    ${text(536, 254, 'Cout', { fill: C.blue, size: 15, anchor: 'start' })}
    ${rect(430, 80, 208, 74, { fill: '#101827', stroke: C.dim })}
    ${path('M452 132 C472 104 492 158 512 132 C532 104 552 158 572 132 C592 104 612 158 632 132', { stroke: C.yellow, width: 3 })}
    ${text(534, 102, 'inductor ripple', { fill: C.yellow, size: 13 })}
  `
  return frame(680, 330, title, body)
}

function renderBuckPowerStageBasic({ title }) {
  return renderBuckCircuit({ title })
}

function renderBuckMissingInductor({ title }) {
  return renderBuckScopeComparison({ title, kind: 'inductor' })
}

function renderBuckMissingDiode({ title }) {
  const normalWaveform = 'M90 176 L165 176 L165 207 L250 207 L250 176 L325 176 L325 207 L400 207'
  const flybackWaveform = 'M520 176 L595 176 L600 285 C610 250 620 190 635 205 C648 218 660 195 672 207 C684 216 694 200 705 205 L705 176 L780 176 L785 285 C795 250 805 190 820 205 C833 218 845 195 857 207'
  const panel = (x, heading) => `
    ${rect(x, 96, 390, 232, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(x + 195, 122, heading, { fill: heading.startsWith('WITH ') ? C.green : C.red, size: 17, weight: 800 })}
    ${line(x + 50, 290, x + 360, 290, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${line(x + 50, 290, x + 50, 138, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${text(x + 356, 309, 'time', { fill: C.muted, size: 11, anchor: 'end' })}
    ${text(x + 28, 150, 'VSW', { fill: C.blue, size: 13, weight: 800 })}
  `
  const body = `
    ${panel(40, 'WITH FREEWHEEL DIODE')}
    ${panel(470, 'NO FREEWHEEL DIODE')}

    ${line(90, 176, 400, 176, { stroke: C.dim, width: 1, dash: '5 5' })}
    ${line(90, 205, 400, 205, { stroke: C.dim, width: 1, dash: '5 5' })}
    ${path(normalWaveform, { stroke: C.green, width: 4 })}
    ${text(104, 170, '12 V = VIN', { fill: C.green, size: 12, weight: 700, anchor: 'start' })}
    ${text(176, 222, '-0.7 V diode clamp', { fill: C.blue, size: 12, weight: 700, anchor: 'start' })}
    ${text(96, 201, '0 V', { fill: C.muted, size: 10, anchor: 'start' })}
    ${text(165, 146, 'QHS turns OFF', { fill: C.orange, size: 12, weight: 700 })}
    ${line(165, 154, 165, 285, { stroke: C.orange, width: 1, dash: '5 5' })}
    ${text(245, 316, 'Diode safely carries IL', { fill: C.fg, size: 13, weight: 700 })}

    ${line(520, 176, 860, 176, { stroke: C.dim, width: 1, dash: '5 5' })}
    ${line(520, 205, 860, 205, { stroke: C.dim, width: 1, dash: '5 5' })}
    ${line(520, 273, 860, 273, { stroke: C.red, width: 2, dash: '7 5' })}
    ${path(flybackWaveform, { stroke: C.red, width: 4 })}
    ${text(534, 170, '12 V = VIN', { fill: C.green, size: 12, weight: 700, anchor: 'start' })}
    ${text(526, 201, '0 V', { fill: C.muted, size: 10, anchor: 'start' })}
    ${text(850, 252, 'VSW = -28 V means VDS = 40 V', { fill: C.red, size: 11, weight: 700, anchor: 'end' })}
    ${text(610, 284, '-33 V VSW', { fill: C.yellow, size: 12, weight: 800, anchor: 'start' })}
    ${text(600, 150, 'QHS turns OFF', { fill: C.orange, size: 12, weight: 700 })}
    ${line(600, 154, 600, 285, { stroke: C.orange, width: 1, dash: '5 5' })}
    ${text(705, 316, 'Negative flyback spike + ringing', { fill: C.fg, size: 13, weight: 700 })}

    ${text(450, 367, 'The inductor forces current to continue when QHS opens.', { fill: C.fg, size: 16, weight: 800 })}
    ${text(450, 393, 'Without a diode path, VSW falls until a parasitic path or device breakdown absorbs the energy.', { fill: C.muted, size: 14 })}
    ${text(450, 419, 'Example: VDS = 12 V - (-33 V) = 45 V; the actual spike depends on circuit parasitics.', { fill: C.yellow, size: 13, weight: 700 })}
  `
  return frame(900, 450, title, body)
}

function renderBuckMissingOutputCapacitor({ title }) {
  return renderBuckScopeComparison({ title, kind: 'output-capacitor' })
}

function renderBuckMissingInputCapacitor({ title }) {
  return renderBuckScopeComparison({ title, kind: 'input-capacitor' })
}

function renderBuckCircuit({ title, missing = null, warning = null }) {
  const componentX = {
    inductor: 390,
    diode: 268,
    'output-capacitor': 532,
    'input-capacitor': 132,
  }
  const componentY = {
    inductor: 154,
    diode: 232,
    'output-capacitor': 232,
    'input-capacitor': 232,
  }
  const overlay = missing
    ? `${crossMark(componentX[missing], componentY[missing], 28)}
       ${line(componentX[missing], componentY[missing] + 34, 378, 337, { stroke: C.red, width: 2, arrow: 'red' })}`
    : ''
  const body = `
    ${text(70, 118, 'VIN', { fill: C.green, size: 17 })}
    ${line(70, 132, 70, 174, { stroke: C.green, width: 3 })}
    ${circle(70, 220, 30, { fill: C.panel2, stroke: C.green, strokeWidth: 3 })}
    ${text(70, 214, '+', { fill: C.green, size: 18, weight: 800 })}
    ${text(70, 236, '-', { fill: C.green, size: 18, weight: 800 })}
    ${line(70, 250, 70, 294, { stroke: C.fg, width: 3 })}
    ${line(70, 132, 178, 132, { stroke: C.fg, width: 3 })}
    ${line(178, 132, 226, 154, { stroke: C.yellow, width: 4 })}
    ${circle(178, 132, 5, { fill: C.yellow, stroke: C.yellow })}
    ${circle(236, 154, 5, { fill: C.yellow, stroke: C.yellow })}
    ${text(204, 112, 'QHS', { fill: C.yellow, size: 14 })}
    ${line(236, 154, 328, 154, { stroke: C.fg, width: 3 })}
    ${junction(268, 154)}
    ${path('M328 154 C344 126 360 182 376 154 C392 126 408 182 424 154 C440 126 456 182 472 154', { stroke: C.teal, width: 4 })}
    ${text(400, 120, 'L', { fill: C.teal, size: 17, weight: 800 })}
    ${line(472, 154, 650, 154, { stroke: C.fg, width: 3 })}
    ${text(646, 132, 'VOUT', { fill: C.green, size: 17, anchor: 'end' })}
    ${line(132, 132, 132, 214, { stroke: C.fg, width: 3 })}
    ${line(114, 214, 150, 214, { stroke: C.blue, width: 4 })}
    ${line(114, 228, 150, 228, { stroke: C.blue, width: 4 })}
    ${line(132, 228, 132, 294, { stroke: C.fg, width: 3 })}
    ${text(132, 260, 'CIN', { fill: C.blue, size: 13 })}
    ${line(268, 154, 268, 194, { stroke: C.fg, width: 3 })}
    ${line(250, 204, 286, 204, { stroke: C.orange, width: 4 })}
    ${path('M250 246 L286 246 L268 210 Z', { fill: C.panel2, stroke: C.orange, width: 3 })}
    ${line(268, 246, 268, 294, { stroke: C.fg, width: 3 })}
    ${text(306, 230, 'Dfreewheel', { fill: C.orange, size: 13, anchor: 'start' })}
    ${line(532, 154, 532, 214, { stroke: C.fg, width: 3 })}
    ${line(514, 214, 550, 214, { stroke: C.blue, width: 4 })}
    ${line(514, 228, 550, 228, { stroke: C.blue, width: 4 })}
    ${line(532, 228, 532, 294, { stroke: C.fg, width: 3 })}
    ${text(532, 260, 'COUT', { fill: C.blue, size: 13 })}
    ${line(614, 154, 614, 178, { stroke: C.fg, width: 3 })}
    ${resistorV(614, 178, 268, 'RLOAD', { stroke: C.green, labelFill: C.green })}
    ${line(614, 268, 614, 294, { stroke: C.fg, width: 3 })}
    ${line(54, 294, 630, 294, { stroke: C.dim, width: 3 })}
    ${text(266, 138, 'SW', { fill: C.yellow, size: 13 })}
    ${overlay}
    ${warning
      ? `${rect(156, 322, 468, 46, { fill: '#2a1218', stroke: C.red, rx: 6 })}${text(390, 351, warning, { fill: C.red, size: 16, weight: 800 })}`
      : text(390, 344, 'PWM switch -> LC filter -> regulated DC output', { fill: C.muted, size: 16 })}
  `
  return frame(780, 395, title, body)
}

function renderBuckScopeComparison({ title, kind }) {
  const configs = {
    inductor: {
      measurement: 'Switch current',
      normalLabel: 'With inductor',
      faultLabel: 'Inductor removed',
      normalPath: 'M92 248 L132 218 L172 248 L212 218 L252 248 L292 218 L332 248',
      faultPath: 'M428 262 L454 262 L462 118 L472 262 L518 262 L526 105 L536 262 L582 262 L590 125 L600 262 L660 262',
      normalLevel: 'bounded ripple current',
      faultLevel: 'very large, narrow inrush spikes',
    },
    'output-capacitor': {
      measurement: 'VOUT',
      normalLabel: 'With COUT',
      faultLabel: 'COUT removed',
      normalPath: 'M92 210 Q132 202 172 210 Q212 218 252 210 Q292 202 332 210',
      faultPath: 'M428 258 L472 152 L518 258 L564 152 L610 258 L656 152',
      normalLevel: 'small ripple around DC',
      faultLevel: 'large triangular switching ripple',
    },
    'input-capacitor': {
      measurement: 'VIN',
      normalLabel: 'With local CIN',
      faultLabel: 'CIN removed',
      normalPath: 'M92 206 L132 206 L140 213 L148 203 L156 209 L172 206 L252 206 L260 213 L268 203 L276 209 L332 206',
      faultPath: 'M428 182 L458 182 L470 268 L478 126 L488 238 L500 166 L520 182 L564 182 L576 268 L584 126 L594 238 L606 166 L656 182',
      normalLevel: 'small local ripple',
      faultLevel: 'deep droop followed by ringing',
    },
  }
  const config = configs[kind]
  const body = `
    ${scopePanel(54, 86, 306, 226, config.normalLabel, config.measurement, config.normalPath, C.teal)}
    ${scopePanel(400, 86, 306, 226, config.faultLabel, config.measurement, config.faultPath, C.red)}
    ${text(207, 338, config.normalLevel, { fill: C.teal, size: 14, weight: 700 })}
    ${text(553, 338, config.faultLevel, { fill: C.red, size: 14, weight: 700 })}
    ${line(368, 112, 368, 300, { stroke: C.dim, width: 2, dash: '7 6' })}
  `
  return frame(760, 375, title, body)
}

function scopePanel(x, y, width, height, heading, measurement, trace, color) {
  return `
    ${rect(x, y, width, height, { fill: '#08111f', stroke: color, rx: 6 })}
    ${text(x + width / 2, y + 30, heading, { fill: color, size: 17, weight: 800 })}
    ${grid(x + 34, y + 54, width - 52, height - 84)}
    ${line(x + 34, y + height - 30, x + width - 18, y + height - 30, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${line(x + 34, y + height - 30, x + 34, y + 52, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${text(x + 46, y + 72, measurement, { fill: C.fg, size: 12, anchor: 'start' })}
    ${text(x + width - 22, y + height - 38, 'time', { fill: C.muted, size: 11, anchor: 'end' })}
    ${path(trace, { stroke: color, width: 4 })}
  `
}

function renderBuckSwitchingLoss({ title }) {
  const body = `
    ${rect(72, 82, 616, 238)}
    ${grid(112, 112, 526, 164)}
    ${line(112, 276, 638, 276, { stroke: C.fg, width: 2 })}
    ${line(112, 276, 112, 106, { stroke: C.fg, width: 2, arrow: 'gray' })}
    ${path('M120 126 L252 126 C300 128 348 174 396 258 L630 258', { stroke: C.blue, width: 4 })}
    ${path('M120 258 L252 258 C300 256 348 210 396 126 L630 126', { stroke: C.teal, width: 4 })}
    <path d="M252 274 Q324 104 396 274 Z" fill="#7f1d1d" fill-opacity="0.72" stroke="${C.red}" stroke-width="3"/>
    <path d="M284 250 L324 142 L364 250 Z" fill="none" stroke="${C.yellow}" stroke-width="3" stroke-linejoin="round"/>
    ${text(186, 116, 'VDS', { fill: C.blue, size: 15, weight: 800 })}
    ${text(560, 116, 'ID', { fill: C.teal, size: 15, weight: 800 })}
    ${text(324, 188, 'PLOSS', { fill: C.yellow, size: 16, weight: 800 })}
    ${text(638, 298, 'time', { fill: C.muted, size: 12, anchor: 'end' })}
    ${text(84, 108, 'normalized', { fill: C.muted, size: 11, anchor: 'start' })}
    ${text(380, 310, 'Shaded P = V x I overlap during MOSFET transition', { fill: C.muted, size: 15 })}
  `
  return frame(760, 350, title, body)
}

function renderBuckRectificationComparison({ title }) {
  const body = `
    ${buckHalfBridge(70, 90, false)}
    ${buckHalfBridge(410, 90, true)}
    ${text(215, 112, 'Asynchronous', { fill: C.orange, size: 18, weight: 800 })}
    ${text(555, 112, 'Synchronous', { fill: C.teal, size: 18, weight: 800 })}
    ${text(215, 316, 'Diode loss:  I x VF', { fill: C.orange, size: 16, weight: 700 })}
    ${text(555, 316, 'FET loss:  I^2 x RDS(on)', { fill: C.teal, size: 16, weight: 700 })}
  `
  return frame(760, 350, title, body)
}

function renderBuckCcmDcm({ title }) {
  const body = `
    ${rect(48, 86, 316, 236)}
    ${rect(396, 86, 316, 236)}
    ${text(206, 118, 'CCM', { fill: C.teal, size: 20, weight: 800 })}
    ${text(554, 118, 'DCM', { fill: C.orange, size: 20, weight: 800 })}
    ${line(82, 278, 334, 278, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${line(82, 278, 82, 136, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${line(430, 278, 682, 278, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${line(430, 278, 430, 136, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${line(82, 278, 330, 278, { stroke: C.red, width: 2, dash: '7 5' })}
    ${line(430, 278, 678, 278, { stroke: C.red, width: 2, dash: '7 5' })}
    ${path('M86 222 L126 158 L166 222 L206 158 L246 222 L286 158 L326 222', { stroke: C.teal, width: 4 })}
    ${path('M434 278 L474 168 L514 278 L554 278 L594 168 L634 278 L674 278', { stroke: C.orange, width: 4 })}
    ${text(90, 296, '0 A', { fill: C.red, size: 12, anchor: 'start' })}
    ${text(438, 296, '0 A', { fill: C.red, size: 12, anchor: 'start' })}
    ${text(86, 144, 'IL', { fill: C.teal, size: 13, anchor: 'start', weight: 800 })}
    ${text(434, 144, 'IL', { fill: C.orange, size: 13, anchor: 'start', weight: 800 })}
    ${text(326, 298, 'time', { fill: C.muted, size: 11, anchor: 'end' })}
    ${text(674, 298, 'time', { fill: C.muted, size: 11, anchor: 'end' })}
    ${text(206, 342, 'Current never reaches zero', { fill: C.muted, size: 15 })}
    ${text(554, 342, 'Zero-current interval at light load', { fill: C.muted, size: 15 })}
  `
  return frame(760, 380, title, body)
}

function renderBuckGateInductorCurrent({ title }) {
  return renderBuckWaveformStack({
    title,
    tracks: [
      { label: 'Gate', color: C.green, d: gateWavePath(155), levels: levelLabels([['HIGH = FET ON', 133], ['LOW = FET OFF', 177]]) },
      { label: 'IL', color: C.teal, d: triangleWavePath(305, 44), levels: levelLabels([['IAVG + ΔIL/2', 283], ['IAVG', 305], ['IAVG - ΔIL/2', 327]]) },
    ],
    labels: ['IL ramps up only while the high-side FET is ON', 'All switching edges share the same vertical time markers'],
  })
}

function renderBuckSwitchNodeWaveforms({ title }) {
  return renderBuckWaveformStack({
    title,
    tracks: [
      { label: 'Gate', color: C.green, d: gateWavePath(125), levels: levelLabels([['HIGH = ON', 103], ['LOW = OFF', 147]]) },
      { label: 'VSW async', color: C.orange, d: pulseWavePath(245, 44, 0), levels: levelLabels([['VIN', 223], ['-0.7 V', 267]]) },
      { label: 'VSW sync', color: C.teal, d: pulseWavePath(365, 44, 0), levels: levelLabels([['VIN', 343], ['0 V', 387]]) },
    ],
    labels: ['Gate HIGH: VSW = VIN', 'Gate LOW: VSW = -0.7 V async, approximately 0 V sync'],
  })
}

function renderBuckInductorWaveforms({ title }) {
  return renderBuckWaveformStack({
    title,
    tracks: [
      { label: 'Gate', color: C.green, d: gateWavePath(125), levels: levelLabels([['HIGH = ON', 103], ['LOW = OFF', 147]]) },
      { label: 'VL', color: C.orange, d: bipolarPulsePath(245), levels: levelLabels([['VIN - VOUT', 221], ['0 V', 245], ['-VOUT', 267]]) },
      { label: 'IL', color: C.teal, d: triangleWavePath(365, 44), levels: levelLabels([['IAVG + ΔIL/2', 343], ['IAVG', 365], ['IAVG - ΔIL/2', 387]]) },
    ],
    labels: ['VL > 0 ramps IL up; VL < 0 ramps IL down', 'Volt-second balance makes average VL exactly 0 V'],
  })
}

function renderBuckOutputCapacitorWaveforms({ title }) {
  return renderBuckWaveformStack({
    title,
    tracks: [
      { label: 'IL', color: C.teal, d: triangleWavePath(125, 40), levels: levelLabels([['IAVG + ΔIL/2', 105], ['IAVG', 125], ['IAVG - ΔIL/2', 145]]) },
      { label: 'IC', color: C.orange, d: triangleWavePath(245, 48), levels: levelLabels([['+ΔIL/2', 221], ['0 A', 245], ['-ΔIL/2', 269]]) },
      { label: 'VOUT', color: C.green, d: parabolicRipplePath(365), levels: levelLabels([['VOUT + ΔV/2', 351], ['VOUT (DC)', 365], ['VOUT - ΔV/2', 379]]) },
    ],
    zeroLines: [1],
    labels: ['IC = IL - ILOAD, so capacitor current is centered on 0 A', 'VOUT ripple is small and centered on a nonzero DC output'],
  })
}

function renderBuckDiodeWaveforms({ title }) {
  return renderBuckWaveformStack({
    title,
    tracks: [
      { label: 'Gate', color: C.green, d: gateWavePath(115), levels: levelLabels([['HIGH = HS ON', 93], ['LOW = HS OFF', 137]]) },
      { label: 'IL', color: C.teal, d: triangleWavePath(220, 40), levels: levelLabels([['IAVG + ΔIL/2', 200], ['IAVG', 220], ['IAVG - ΔIL/2', 240]]) },
      { label: 'ID', color: C.orange, d: offIntervalCurrentPath(325), levels: levelLabels([['IL during OFF', 303], ['0 A during ON', 349]]) },
      { label: 'VD', color: C.blue, d: diodeVoltagePath(430), levels: levelLabels([['-0.7 V (conducting)', 416], ['-VIN (blocking)', 454]]) },
    ],
    labels: ['Gate LOW: ID follows the inductor ripple current while VD is about -0.7 V', 'Gate HIGH: ID is 0 A and the diode blocks approximately VIN'],
  })
}

function renderBuckInputWaveforms({ title }) {
  return renderBuckWaveformStack({
    title,
    tracks: [
      { label: 'Gate', color: C.green, d: gateWavePath(125), levels: levelLabels([['HIGH = HS ON', 103], ['LOW = HS OFF', 147]]) },
      { label: 'IIN', color: C.orange, d: onIntervalCurrentPath(245), levels: levelLabels([['≈ IL during ON', 223], ['0 A during OFF', 269]]) },
      { label: 'VIN', color: C.blue, d: inputDroopPath(365), levels: levelLabels([['VIN nominal', 353], ['switching droop', 387]]) },
    ],
    labels: ['Input current is drawn only while the high-side FET is ON', 'The local input capacitor keeps VIN near its nonzero nominal level'],
  })
}

function renderBuckLoadWaveforms({ title }) {
  return renderBuckWaveformStack({
    title,
    tracks: [
      { label: 'Gate', color: C.green, d: gateWavePath(125), levels: levelLabels([['HIGH = HS ON', 103], ['LOW = HS OFF', 147]]) },
      { label: 'VLOAD', color: C.teal, d: 'M160 233 L680 233', levels: levelLabels([['VOUT (nonzero DC)', 233], ['0 V reference', 269]]) },
      { label: 'ILOAD', color: C.blue, d: 'M160 353 L680 353', levels: levelLabels([['ILOAD (nonzero DC)', 353], ['0 A reference', 389]]) },
    ],
    referenceLines: [{ track: 1, y: 269 }, { track: 2, y: 389 }],
    labels: ['The flat traces sit above zero: VLOAD = VOUT and ILOAD = VOUT / RLOAD', 'Small residual ripple is omitted here for clarity'],
  })
}

function renderBuckLowSideFetWaveforms({ title }) {
  return renderBuckWaveformStack({
    title,
    tracks: [
      { label: 'HS Gate', color: C.green, d: gateWavePath(125), levels: levelLabels([['HIGH = HS ON', 103], ['LOW = HS OFF', 147]]) },
      { label: 'ILS FET', color: C.orange, d: offIntervalCurrentPath(245), levels: levelLabels([['≈ IL when LS ON', 223], ['0 A when LS OFF', 269]]) },
      { label: 'VDS LS', color: C.blue, d: pulseWavePath(365, 44, 0), levels: levelLabels([['VIN when LS OFF', 343], ['≈ 0 V when LS ON', 387]]) },
    ],
    labels: ['HS gate LOW means the low-side FET is ON after dead time', 'Low-side current and VDS switch in complementary states'],
  })
}

function renderBuckWaveformStack({ title, tracks, labels = [], zeroLines = [], referenceLines = [] }) {
  const count = tracks.length
  const ys = count === 2 ? [155, 305] : count === 4 ? [115, 220, 325, 430] : [125, 245, 365]
  const lastY = ys[ys.length - 1]
  const body = tracks.map((track, index) => `
    ${rect(138, ys[index] - 38, 622, 76, { fill: '#0b1528', stroke: C.dim, rx: 4 })}
    ${grid(158, ys[index] - 28, 522, 56)}
    ${line(158, ys[index] + 28, 744, ys[index] + 28, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${line(158, ys[index] + 28, 158, ys[index] - 32, { stroke: C.muted, width: 2, arrow: 'gray' })}
    ${text(124, ys[index] + 5, track.label, { fill: track.color, size: 15, weight: 800, anchor: 'end' })}
    ${text(742, ys[index] + 21, 'time', { fill: C.muted, size: 10, anchor: 'end' })}
    ${zeroLines.includes(index) ? line(158, ys[index], 680, ys[index], { stroke: C.red, width: 1, dash: '6 5' }) : ''}
    ${path(track.d, { stroke: track.color, width: 4 })}
    ${(track.levels ?? []).map((level) => `${level.guide ? line(158, level.y, 680, level.y, { stroke: level.color ?? C.dim, width: 1, dash: '5 5' }) : ''}${text(772, level.y + 4, level.label, { fill: level.color ?? C.muted, size: 11, anchor: 'start' })}`).join('')}
  `).join('')
  const timing = `
    ${text(185, 76, 'HS FET OFF', { fill: C.orange, size: 11, weight: 700 })}
    ${text(260, 76, 'HS FET ON', { fill: C.green, size: 11, weight: 700 })}
    ${text(360, 76, 'HS FET OFF', { fill: C.orange, size: 11, weight: 700 })}
    ${text(460, 76, 'HS FET ON', { fill: C.green, size: 11, weight: 700 })}
    ${[210, 310, 410, 510, 610].map((x) => line(x, 82, x, lastY + 34, { stroke: C.yellow, width: 1, dash: '5 6' })).join('')}
  `
  const references = referenceLines.map((reference) => line(158, reference.y, 680, reference.y, { stroke: C.red, width: 1, dash: '6 5' })).join('')
  const footerY = count === 2 ? 396 : count === 4 ? 512 : 434
  const footer = labels.map((label, index) => text(450, footerY + index * 22, label, { fill: index === 0 ? C.fg : C.muted, size: 14, weight: index === 0 ? 700 : 500 })).join('')
  return frame(900, count === 2 ? 455 : count === 4 ? 565 : 485, title, `${timing}${body}${references}${footer}`)
}

function gateWavePath(y) {
  return `M160 ${y + 22} L210 ${y + 22} L210 ${y - 22} L310 ${y - 22} L310 ${y + 22} L410 ${y + 22} L410 ${y - 22} L510 ${y - 22} L510 ${y + 22} L610 ${y + 22} L610 ${y - 22} L680 ${y - 22}`
}

function triangleWavePath(y, amplitude) {
  return `M160 ${y - 2} L210 ${y + amplitude / 2} L310 ${y - amplitude / 2} L410 ${y + amplitude / 2} L510 ${y - amplitude / 2} L610 ${y + amplitude / 2} L680 ${y - 2}`
}

function pulseWavePath(y, amplitude, lowOffset) {
  const high = y - amplitude / 2
  const low = y + amplitude / 2 + lowOffset
  return `M160 ${low} L210 ${low} L210 ${high} L310 ${high} L310 ${low} L410 ${low} L410 ${high} L510 ${high} L510 ${low} L610 ${low} L610 ${high} L680 ${high}`
}

function bipolarPulsePath(y) {
  return `M160 ${y + 22} L210 ${y + 22} L210 ${y - 24} L310 ${y - 24} L310 ${y + 22} L410 ${y + 22} L410 ${y - 24} L510 ${y - 24} L510 ${y + 22} L610 ${y + 22} L610 ${y - 24} L680 ${y - 24}`
}

function offIntervalCurrentPath(y) {
  return `M160 ${y - 4} L210 ${y + 22} L210 ${y + 24} L310 ${y + 24} L310 ${y - 22} L410 ${y + 20} L410 ${y + 24} L510 ${y + 24} L510 ${y - 22} L610 ${y + 20} L610 ${y + 24} L680 ${y + 24}`
}

function onIntervalCurrentPath(y) {
  return `M160 ${y + 24} L210 ${y + 24} L210 ${y + 18} L310 ${y - 22} L310 ${y + 24} L410 ${y + 24} L410 ${y + 18} L510 ${y - 22} L510 ${y + 24} L610 ${y + 24} L610 ${y + 18} L680 ${y - 10}`
}

function inputDroopPath(y) {
  return `M160 ${y - 12} L206 ${y - 12} L214 ${y + 16} L222 ${y - 20} L232 ${y + 4} L244 ${y - 12} L406 ${y - 12} L414 ${y + 16} L422 ${y - 20} L432 ${y + 4} L444 ${y - 12} L606 ${y - 12} L614 ${y + 16} L622 ${y - 20} L632 ${y + 4} L644 ${y - 12} L680 ${y - 12}`
}

function parabolicRipplePath(y) {
  return `M160 ${y} Q210 ${y + 14} 260 ${y} Q310 ${y - 14} 360 ${y} Q410 ${y + 14} 460 ${y} Q510 ${y - 14} 560 ${y} Q610 ${y + 14} 680 ${y}`
}

function diodeVoltagePath(y) {
  return `M160 ${y - 14} L210 ${y - 14} L210 ${y + 24} L310 ${y + 24} L310 ${y - 14} L410 ${y - 14} L410 ${y + 24} L510 ${y + 24} L510 ${y - 14} L610 ${y - 14} L610 ${y + 24} L680 ${y + 24}`
}

function levelLabels(entries) {
  return entries.map(([label, y], index) => ({ label, y, guide: index > 0 }))
}

function buckHalfBridge(x, y, synchronous) {
  const swX = x + 145
  const lower = synchronous
    ? `${rect(x + 96, y + 126, 98, 48, { fill: C.panel2, stroke: C.teal })}${text(swX, y + 156, 'LS FET', { size: 13 })}`
    : `${line(swX - 20, y + 132, swX + 20, y + 132, { stroke: C.orange, width: 4 })}${path(`M${swX - 20} ${y + 174} L${swX + 20} ${y + 174} L${swX} ${y + 138} Z`, { fill: C.panel2, stroke: C.orange, width: 3 })}`
  return `
    ${text(x + 26, y + 70, 'VIN', { fill: C.green, size: 14 })}
    ${line(x + 26, y + 82, x + 96, y + 82, { stroke: C.fg, width: 3 })}
    ${rect(x + 96, y + 58, 98, 48, { fill: C.panel2, stroke: C.yellow })}
    ${text(swX, y + 88, 'HS FET', { size: 13 })}
    ${line(swX, y + 106, swX, y + 126, { stroke: C.fg, width: 3 })}
    ${lower}
    ${line(swX, y + 174, swX, y + 202, { stroke: C.fg, width: 3 })}
    ${line(swX, y + 116, x + 248, y + 116, { stroke: C.yellow, width: 3 })}
    ${path(`M${x + 248} ${y + 116} C${x + 262} ${y + 92} ${x + 276} ${y + 140} ${x + 290} ${y + 116}`, { stroke: C.teal, width: 4 })}
    ${text(x + 306, y + 121, 'VOUT', { fill: C.green, size: 14, anchor: 'start' })}
    ${line(x + 80, y + 202, x + 222, y + 202, { stroke: C.dim, width: 3 })}
  `
}

function crossMark(x, y, radius) {
  return `${line(x - radius, y - radius, x + radius, y + radius, { stroke: C.red, width: 8 })}${line(x + radius, y - radius, x - radius, y + radius, { stroke: C.red, width: 8 })}`
}

function renderOpAmpSpecMatrix({ title }) {
  const body = `
    ${rect(58, 92, 584, 202)}
    ${line(58, 142, 642, 142, { stroke: C.dim, width: 2 })}
    ${line(58, 196, 642, 196, { stroke: C.dim, width: 2 })}
    ${line(242, 92, 242, 294, { stroke: C.dim, width: 2 })}
    ${line(442, 92, 442, 294, { stroke: C.dim, width: 2 })}
    ${text(150, 122, 'Category', { fill: C.muted, size: 15 })}
    ${text(342, 122, 'Precision', { fill: C.green, size: 16, weight: 700 })}
    ${text(542, 122, 'High-speed', { fill: C.yellow, size: 16, weight: 700 })}
    ${text(150, 174, 'Offset / bias', { fill: C.fg, size: 15 })}
    ${text(342, 174, 'low Vos, low Ib', { fill: C.green, size: 14 })}
    ${text(542, 174, 'often higher', { fill: C.yellow, size: 14 })}
    ${text(150, 230, 'Speed', { fill: C.fg, size: 15 })}
    ${text(342, 230, 'low GBWP / SR', { fill: C.green, size: 14 })}
    ${text(542, 230, 'high GBWP / SR', { fill: C.yellow, size: 14 })}
    ${text(350, 326, 'Pick the op-amp for the signal, not just the pinout.', { fill: C.muted, size: 15 })}
  `
  return frame(700, 360, title, body)
}

function renderOpAmpVoltageFollower({ title }) {
  const g = opAmpGeometry(355, 184)
  const feedbackX = 540
  const body = `
    ${opAmp(g.cx, g.cy)}
    ${line(78, g.plus.y, g.left, g.plus.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${text(88, g.plus.y - 16, 'Vin', { fill: C.green, size: 18, anchor: 'start' })}
    ${line(g.out.x, g.out.y, 622, g.out.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${text(620, g.out.y - 16, 'Vout', { fill: C.green, size: 18, anchor: 'end' })}
    ${line(g.out.x + 26, g.out.y, feedbackX, g.out.y, { stroke: C.yellow, width: 3 })}
    ${line(feedbackX, g.out.y, feedbackX, g.minus.y, { stroke: C.yellow, width: 3 })}
    ${line(feedbackX, g.minus.y, g.left, g.minus.y, { stroke: C.yellow, width: 3 })}
    ${junction(g.out.x + 26, g.out.y)}
    ${text(438, 116, 'direct negative feedback', { fill: C.yellow, size: 15 })}
    ${text(358, 306, 'A_v = 1   |   Vout follows Vin', { fill: C.fg, size: 22, weight: 800 })}
  `
  return frame(720, 350, title, body)
}

function renderOpAmpInverting({ title }) {
  const g = opAmpGeometry(408, 188)
  const outNodeX = 548
  const body = `
    ${opAmp(g.cx, g.cy)}
    ${line(64, g.minus.y, 112, g.minus.y, { stroke: C.green, width: 3 })}
    ${resistorH(112, g.minus.y, 270, 'R_in')}
    ${line(270, g.minus.y, g.left, g.minus.y, { stroke: C.fg, width: 3 })}
    ${text(76, g.minus.y - 18, 'Vin', { fill: C.green, size: 18, anchor: 'start' })}
    ${line(g.left, g.plus.y, 296, g.plus.y, { stroke: C.fg, width: 3 })}
    ${ground(296, g.plus.y)}
    ${line(g.left, g.minus.y, g.left, 102, { stroke: C.yellow, width: 3 })}
    ${resistorH(g.left, 102, outNodeX, 'R_f')}
    ${line(outNodeX, 102, outNodeX, g.out.y, { stroke: C.yellow, width: 3 })}
    ${line(g.out.x, g.out.y, 630, g.out.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${junction(g.left, g.minus.y)}
    ${junction(outNodeX, g.out.y)}
    ${text(622, g.out.y - 18, 'Vout', { fill: C.green, size: 18, anchor: 'end' })}
    ${text(360, 310, 'Vout / Vin = -R_f / R_in', { fill: C.fg, size: 22, weight: 800 })}
  `
  return frame(720, 350, title, body)
}

function renderOpAmpNonInverting({ title }) {
  const g = opAmpGeometry(404, 188)
  const outNodeX = 548
  const dividerX = 270
  const vinDoglegX = g.left - 34
  const body = `
    ${opAmp(g.cx, g.cy)}
    ${path(`M70 ${g.plus.y + 62} L${vinDoglegX} ${g.plus.y + 62} L${vinDoglegX} ${g.plus.y} L${g.left} ${g.plus.y}`, { stroke: C.green, width: 4 })}
    ${text(82, g.plus.y + 44, 'Vin', { fill: C.green, size: 18, anchor: 'start' })}
    ${line(g.left, g.minus.y, dividerX, g.minus.y, { stroke: C.fg, width: 3 })}
    ${line(dividerX, g.minus.y, dividerX, 102, { stroke: C.yellow, width: 3 })}
    ${resistorH(dividerX, 102, outNodeX, 'R_f')}
    ${line(outNodeX, 102, outNodeX, g.out.y, { stroke: C.yellow, width: 3 })}
    ${resistorV(dividerX, g.minus.y, 205, 'R_in')}
    ${ground(dividerX, 205)}
    ${line(g.out.x, g.out.y, 630, g.out.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${junction(dividerX, g.minus.y)}
    ${junction(outNodeX, g.out.y)}
    ${text(622, g.out.y - 18, 'Vout', { fill: C.green, size: 18, anchor: 'end' })}
    ${text(364, 320, 'Vout / Vin = 1 + R_f / R_in', { fill: C.fg, size: 22, weight: 800 })}
  `
  return frame(720, 360, title, body)
}

function renderOpAmpComparator({ title }) {
  const g = opAmpGeometry(230, 184, 132, 112)
  const body = `
    ${opAmp(g.cx, g.cy, { label: 'comp', labelSize: 15 })}
    ${line(54, g.plus.y, g.left, g.plus.y, { stroke: C.green, width: 3, arrow: 'teal' })}
    ${line(54, g.minus.y, g.left, g.minus.y, { stroke: C.blue, width: 3, arrow: 'teal' })}
    ${text(62, g.plus.y - 16, 'V1', { fill: C.green, size: 17, anchor: 'start' })}
    ${text(62, g.minus.y - 16, 'V2', { fill: C.blue, size: 17, anchor: 'start' })}
    ${line(g.out.x, g.out.y, 360, g.out.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${text(350, g.out.y - 16, 'Vout', { fill: C.green, size: 17, anchor: 'end' })}
    ${text(230, 282, 'no feedback: output saturates', { fill: C.yellow, size: 15, weight: 700 })}
    ${rect(405, 94, 282, 202)}
    ${grid(435, 126, 218, 98)}
    ${path('M442 198 C488 152 530 156 572 196 C604 224 628 206 648 166', { stroke: C.teal, width: 3 })}
    ${line(435, 174, 654, 174, { stroke: C.muted, width: 2, dash: '6 6' })}
    ${path('M442 256 L514 256 L514 228 L590 228 L590 256 L650 256', { stroke: C.yellow, width: 4 })}
    ${text(452, 116, 'V1 crosses V2', { fill: C.teal, size: 13, anchor: 'start' })}
    ${text(452, 246, 'output snaps', { fill: C.yellow, size: 13, anchor: 'start' })}
  `
  return frame(730, 340, title, body)
}

function renderOpAmpSchmittTrigger({ title }) {
  const g = opAmpGeometry(362, 188)
  const outNodeX = 548
  const body = `
    ${opAmp(g.cx, g.cy)}
    ${line(68, g.plus.y, g.left, g.plus.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${text(78, g.plus.y - 16, 'Vin', { fill: C.green, size: 18, anchor: 'start' })}
    ${line(92, g.minus.y, g.left, g.minus.y, { stroke: C.blue, width: 3, arrow: 'teal' })}
    ${text(102, g.minus.y - 16, 'Vref', { fill: C.blue, size: 17, anchor: 'start' })}
    ${line(g.left, g.plus.y, g.left, 102, { stroke: C.yellow, width: 3 })}
    ${resistorH(g.left, 102, outNodeX, 'R_fb')}
    ${line(outNodeX, 102, outNodeX, g.out.y, { stroke: C.yellow, width: 3 })}
    ${line(g.out.x, g.out.y, 630, g.out.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${junction(g.left, g.plus.y)}
    ${junction(outNodeX, g.out.y)}
    ${text(622, g.out.y - 18, 'Vout', { fill: C.green, size: 18, anchor: 'end' })}
    ${text(362, 304, 'positive feedback creates hysteresis', { fill: C.fg, size: 21, weight: 800 })}
  `
  return frame(720, 350, title, body)
}

function renderSchmittHysteresis({ title }) {
  const body = `
    ${rect(58, 84, 604, 228)}
    ${text(104, 138, 'Vin', { anchor: 'start', fill: C.teal, size: 15 })}
    ${grid(152, 108, 458, 92)}
    ${line(152, 135, 610, 135, { stroke: C.yellow, width: 2, dash: '8 6' })}
    ${line(152, 170, 610, 170, { stroke: C.orange, width: 2, dash: '8 6' })}
    ${text(598, 128, 'Upper', { fill: C.yellow, size: 12, anchor: 'end' })}
    ${text(598, 188, 'Lower', { fill: C.orange, size: 12, anchor: 'end' })}
    ${path('M156 168 C188 118 216 184 244 142 C276 96 306 194 336 151 C370 106 398 184 430 140 C466 92 500 202 532 154 C562 116 588 178 608 140', { stroke: C.teal, width: 4 })}
    ${text(104, 258, 'Vout', { anchor: 'start', fill: C.green, size: 15 })}
    ${path('M152 272 L242 272 L242 226 L365 226 L365 272 L514 272 L514 226 L610 226', { stroke: C.green, width: 4 })}
    ${text(382, 330, 'Noise between thresholds is ignored', { fill: C.fg, size: 20, weight: 800 })}
  `
  return frame(720, 365, title, body)
}

function renderOpAmpSchmittInverting({ title }) {
  const g = opAmpGeometry(430, 190)
  const dividerX = 280
  const feedbackY = 308
  const outTapX = 606
  const body = `
    ${opAmp(g.cx, g.cy, { label: 'comparator' })}
    ${line(62, g.minus.y, g.left, g.minus.y, { stroke: C.blue, width: 4, arrow: 'teal' })}
    ${text(72, g.minus.y - 17, 'Vin', { fill: C.blue, size: 18, anchor: 'start', weight: 800 })}
    ${line(g.out.x, g.out.y, 706, g.out.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${text(692, g.out.y - 18, 'Vout', { fill: C.green, size: 18, anchor: 'end', weight: 800 })}
    ${line(dividerX, g.plus.y, g.left, g.plus.y, { stroke: C.yellow, width: 3 })}
    ${line(dividerX, feedbackY, dividerX, g.plus.y, { stroke: C.yellow, width: 3 })}
    ${resistorH(dividerX, feedbackY, outTapX, 'Rf')}
    ${line(outTapX, feedbackY, outTapX, g.out.y, { stroke: C.yellow, width: 3 })}
    ${resistorH(112, g.plus.y, dividerX, 'R1')}
    ${ground(112, g.plus.y)}
    ${junction(dividerX, g.plus.y)}
    ${junction(outTapX, g.out.y)}
    ${text(430, 372, 'β = R1 / (Rf + R1)', { fill: C.yellow, size: 17, weight: 800 })}
    ${text(430, 402, 'VTH = βVOH   |   VTL = βVOL', { fill: C.fg, size: 19, weight: 800 })}
  `
  return frame(800, 430, title, body)
}

function renderOpAmpSchmittNonInverting({ title }) {
  const g = opAmpGeometry(450, 190)
  const nodeX = 292
  const feedbackY = 82
  const outTapX = 626
  const body = `
    ${opAmp(g.cx, g.cy, { label: 'comparator' })}
    ${line(58, g.plus.y, 108, g.plus.y, { stroke: C.blue, width: 3 })}
    ${resistorH(108, g.plus.y, nodeX, 'Rin')}
    ${line(nodeX, g.plus.y, g.left, g.plus.y, { stroke: C.yellow, width: 3 })}
    ${text(68, g.plus.y - 18, 'Vin', { fill: C.blue, size: 18, anchor: 'start', weight: 800 })}
    ${line(g.out.x, g.out.y, 726, g.out.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${text(712, g.out.y - 18, 'Vout', { fill: C.green, size: 18, anchor: 'end', weight: 800 })}
    ${line(nodeX, feedbackY, nodeX, g.plus.y, { stroke: C.yellow, width: 3 })}
    ${resistorH(nodeX, feedbackY, outTapX, 'Rf')}
    ${line(outTapX, feedbackY, outTapX, g.out.y, { stroke: C.yellow, width: 3 })}
    ${line(340, g.minus.y, g.left, g.minus.y, { stroke: C.fg, width: 3 })}
    ${ground(340, g.minus.y)}
    ${text(304, g.minus.y - 16, 'Vref = 0 V', { fill: C.muted, size: 14, weight: 700 })}
    ${junction(nodeX, g.plus.y)}
    ${junction(outTapX, g.out.y)}
    ${text(440, 370, 'VTH = -(Rin / Rf) VOL', { fill: C.yellow, size: 17, weight: 800 })}
    ${text(440, 398, 'VTL = -(Rin / Rf) VOH', { fill: C.fg, size: 17, weight: 800 })}
  `
  return frame(820, 430, title, body)
}

function renderSchmittTransfer({ title }) {
  const body = `
    ${rect(74, 76, 592, 280)}
    ${grid(116, 108, 500, 208)}
    ${line(116, 212, 634, 212, { stroke: C.fg, width: 2, arrow: true })}
    ${line(366, 328, 366, 92, { stroke: C.fg, width: 2, arrow: true })}
    ${path('M152 126 H500 V298 H226 V126', { stroke: C.teal, width: 5 })}
    ${line(438, 126, 492, 126, { stroke: C.yellow, width: 2, arrow: true })}
    ${line(500, 184, 500, 284, { stroke: C.yellow, width: 2, arrow: true })}
    ${line(288, 298, 234, 298, { stroke: C.orange, width: 2, arrow: 'orange' })}
    ${line(226, 246, 226, 140, { stroke: C.orange, width: 2, arrow: 'orange' })}
    ${line(500, 298, 500, 324, { stroke: C.red, width: 2, dash: '5 5' })}
    ${line(226, 298, 226, 324, { stroke: C.red, width: 2, dash: '5 5' })}
    ${text(500, 346, 'VTH', { fill: C.yellow, size: 16, weight: 800 })}
    ${text(226, 346, 'VTL', { fill: C.orange, size: 16, weight: 800 })}
    ${text(624, 238, 'Vin', { fill: C.fg, size: 17, weight: 800 })}
    ${text(388, 102, 'Vout', { fill: C.fg, size: 17, weight: 800 })}
    ${text(176, 120, 'VOH', { fill: C.teal, size: 14, weight: 800 })}
    ${text(176, 320, 'VOL', { fill: C.teal, size: 14, weight: 800 })}
  `
  return frame(740, 390, title, body)
}

function renderSchmittNoiseComparison({ title }) {
  const noisy = 'M130 160 C214 158 258 142 294 120 C306 112 312 96 320 116 C328 132 336 92 344 110 C352 126 360 94 370 102 C406 76 470 64 612 58'
  const body = `
    ${rect(56, 72, 628, 152)}
    ${text(82, 101, 'Single threshold', { fill: C.red, size: 15, anchor: 'start', weight: 800 })}
    ${line(126, 112, 626, 112, { stroke: C.red, width: 2, dash: '7 5' })}
    ${text(618, 105, '4 V', { fill: C.red, size: 13, anchor: 'end' })}
    ${path(noisy, { stroke: C.teal, width: 3 })}
    ${path('M130 202 H300 V174 H312 V202 H324 V174 H336 V202 H348 V174 H360 V202 H372 V174 H612', { stroke: C.red, width: 3 })}
    ${text(82, 191, 'glitches', { fill: C.red, size: 14, anchor: 'start', weight: 800 })}
    ${rect(56, 240, 628, 168)}
    ${text(82, 268, 'Schmitt hysteresis', { fill: C.green, size: 15, anchor: 'start', weight: 800 })}
    ${line(126, 286, 626, 286, { stroke: C.yellow, width: 2, dash: '7 5' })}
    ${line(126, 334, 626, 334, { stroke: C.orange, width: 2, dash: '7 5' })}
    ${text(618, 280, '5 V upper', { fill: C.yellow, size: 13, anchor: 'end' })}
    ${text(618, 352, '3 V lower', { fill: C.orange, size: 13, anchor: 'end' })}
    ${path('M130 350 C214 348 258 332 294 306 C306 298 312 282 320 302 C328 318 336 278 344 296 C352 312 360 280 370 288 C406 262 470 250 612 246', { stroke: C.teal, width: 3 })}
    ${path('M130 390 H370 V366 H612', { stroke: C.green, width: 4 })}
    ${text(82, 389, 'clean', { fill: C.green, size: 14, anchor: 'start', weight: 800 })}
  `
  return frame(740, 440, title, body)
}

function filterAxes(x, y, w, h, yLabel) {
  return `${grid(x, y, w, h)}${line(x, y + h, x + w + 12, y + h, { stroke: C.fg, width: 2, arrow: true })}${line(x, y + h, x, y - 10, { stroke: C.fg, width: 2, arrow: true })}${text(x - 12, y + 4, yLabel, { fill: C.muted, size: 12, anchor: 'end', weight: 700 })}${text(x + w, y + h + 20, 'log f', { fill: C.muted, size: 12, anchor: 'end' })}`
}

function capacitorVertical(x, y1, y2, label = 'C') {
  const mid = (y1 + y2) / 2
  return `${line(x, y1, x, mid - 9, { stroke: C.fg, width: 3 })}${line(x - 18, mid - 9, x + 18, mid - 9, { stroke: C.blue, width: 4 })}${line(x - 18, mid + 9, x + 18, mid + 9, { stroke: C.blue, width: 4 })}${line(x, mid + 9, x, y2, { stroke: C.fg, width: 3 })}${text(x + 28, mid + 5, label, { fill: C.blue, size: 16, anchor: 'start', weight: 800 })}`
}

function capacitorHorizontal(x1, y, x2, label = 'C') {
  const mid = (x1 + x2) / 2
  return `${line(x1, y, mid - 9, y, { stroke: C.fg, width: 3 })}${line(mid - 9, y - 18, mid - 9, y + 18, { stroke: C.blue, width: 4 })}${line(mid + 9, y - 18, mid + 9, y + 18, { stroke: C.blue, width: 4 })}${line(mid + 9, y, x2, y, { stroke: C.fg, width: 3 })}${text(mid, y - 28, label, { fill: C.blue, size: 16, weight: 800 })}`
}

function inductorHorizontal(x1, y, x2, label = 'L') {
  const lead = 18
  const start = x1 + lead
  const end = x2 - lead
  const span = (end - start) / 4
  const coils = Array.from({ length: 4 }, (_, i) => `C${start + span * (i + 0.2)} ${y - 24} ${start + span * (i + 0.8)} ${y - 24} ${start + span * (i + 1)} ${y}`).join(' ')
  return `${line(x1, y, start, y, { stroke: C.fg, width: 3 })}${path(`M${start} ${y} ${coils}`, { stroke: C.yellow, width: 3 })}${line(end, y, x2, y, { stroke: C.fg, width: 3 })}${text((x1 + x2) / 2, y - 34, label, { fill: C.yellow, size: 16, weight: 800 })}`
}

function renderRcLowPass({ title }) {
  const body = `
    ${text(36, 184, 'Vin', { fill: C.blue, size: 17, anchor: 'start', weight: 800 })}
    ${resistorH(72, 190, 254, 'R')}
    ${line(254, 190, 330, 190, { stroke: C.green, width: 3 })}
    ${junction(282, 190)}${text(314, 174, 'Vout', { fill: C.green, size: 16, weight: 800 })}
    ${capacitorVertical(282, 190, 278, 'C')}${ground(282, 278)}
    ${filterAxes(420, 86, 260, 102, 'dB')}
    ${path('M420 112 H520 L670 178', { stroke: C.teal, width: 4 })}
    ${line(520, 86, 520, 188, { stroke: C.red, width: 2, dash: '6 5' })}
    ${text(542, 168, '-20 dB/dec', { fill: C.yellow, size: 14, anchor: 'start', weight: 800 })}
    ${filterAxes(420, 246, 260, 92, 'phase')}
    ${path('M420 264 C494 264 514 274 540 294 C570 320 612 328 680 328', { stroke: C.blue, width: 4 })}
    ${text(520, 214, 'fc = 1 / (2πRC)', { fill: C.red, size: 15, weight: 800 })}
    ${text(438, 260, '0°', { fill: C.muted, size: 12, anchor: 'start' })}${text(666, 324, '-90°', { fill: C.muted, size: 12 })}
  `
  return frame(740, 390, title, body)
}

function renderLcLowPass({ title }) {
  const body = `
    ${text(34, 184, 'Vin', { fill: C.blue, size: 17, anchor: 'start', weight: 800 })}
    ${inductorHorizontal(70, 190, 250, 'L')}${line(250, 190, 330, 190, { stroke: C.green, width: 3 })}
    ${junction(282, 190)}${text(314, 174, 'Vout', { fill: C.green, size: 16, weight: 800 })}
    ${capacitorVertical(282, 190, 278, 'C')}${ground(282, 278)}
    ${filterAxes(420, 86, 260, 102, 'dB')}
    ${path('M420 122 H500 C518 122 522 82 536 88 C548 94 554 150 680 184', { stroke: C.teal, width: 4 })}
    ${line(528, 86, 528, 188, { stroke: C.red, width: 2, dash: '6 5' })}
    ${text(558, 164, '-40 dB/dec', { fill: C.yellow, size: 14, anchor: 'start', weight: 800 })}
    ${filterAxes(420, 246, 260, 92, 'phase')}
    ${path('M420 258 C500 258 520 276 542 300 C572 332 624 334 680 334', { stroke: C.blue, width: 4 })}
    ${text(528, 214, 'f0 = 1 / (2π√LC)', { fill: C.red, size: 15, weight: 800 })}
    ${text(444, 256, '0°', { fill: C.muted, size: 12 })}${text(660, 330, '-180°', { fill: C.muted, size: 12 })}
  `
  return frame(740, 390, title, body)
}

function renderLcHighPass({ title }) {
  const body = `
    ${text(34, 184, 'Vin', { fill: C.blue, size: 17, anchor: 'start', weight: 800 })}
    ${capacitorHorizontal(70, 190, 250, 'C')}${line(250, 190, 330, 190, { stroke: C.green, width: 3 })}
    ${junction(282, 190)}${text(314, 174, 'Vout', { fill: C.green, size: 16, weight: 800 })}
    ${path('M282 190 V216 C258 216 258 232 282 232 C306 232 306 248 282 248 C258 248 258 264 282 264 V278', { stroke: C.yellow, width: 3 })}${text(318, 244, 'L', { fill: C.yellow, size: 16, weight: 800 })}${ground(282, 278)}
    ${filterAxes(420, 86, 260, 102, 'dB')}
    ${path('M420 180 L510 142 C520 136 524 88 536 88 C548 88 554 120 580 120 H680', { stroke: C.teal, width: 4 })}
    ${line(532, 86, 532, 188, { stroke: C.red, width: 2, dash: '6 5' })}
    ${text(448, 158, '+40 dB/dec', { fill: C.yellow, size: 14, anchor: 'start', weight: 800 })}
    ${filterAxes(420, 246, 260, 92, 'phase')}
    ${path('M420 256 C492 256 518 270 542 298 C574 330 626 334 680 334', { stroke: C.blue, width: 4 })}
    ${text(532, 214, 'f0 = 1 / (2π√LC)', { fill: C.red, size: 15, weight: 800 })}
    ${text(446, 256, '+180°', { fill: C.muted, size: 12 })}${text(664, 330, '0°', { fill: C.muted, size: 12 })}
  `
  return frame(740, 390, title, body)
}

function renderRlcBandPass({ title }) {
  const body = `
    ${text(28, 174, 'Vin', { fill: C.blue, size: 17, anchor: 'start', weight: 800 })}
    ${inductorHorizontal(64, 180, 170, 'L')}${capacitorHorizontal(170, 180, 270, 'C')}
    ${line(270, 180, 310, 180, { stroke: C.green, width: 3 })}${junction(310, 180)}
    ${text(328, 166, 'Vout', { fill: C.green, size: 16, anchor: 'start', weight: 800 })}
    ${resistorV(310, 180, 274, 'R')}${ground(310, 274)}
    ${filterAxes(420, 88, 260, 210, 'dB')}
    ${path('M420 286 C470 280 496 230 524 146 C532 116 540 116 548 146 C576 230 610 280 680 286', { stroke: C.teal, width: 5 })}
    ${line(536, 88, 536, 300, { stroke: C.red, width: 2, dash: '6 5' })}
    ${text(536, 326, 'f0', { fill: C.red, size: 16, weight: 800 })}
    ${text(536, 78, 'peak gain at resonance', { fill: C.yellow, size: 14, weight: 800 })}
    ${text(486, 350, 'Bandwidth set by R and Q', { fill: C.fg, size: 16, weight: 800 })}
  `
  return frame(740, 390, title, body)
}

function lightOpAmp(cx, cy, options = {}) {
  const w = options.w ?? 112
  const h = options.h ?? 88
  const left = cx - w / 2
  const right = cx + w / 2
  const top = cy - h / 2
  const bottom = cy + h / 2
  const minusY = cy - h / 4
  const plusY = cy + h / 4
  return `
    <path d="M${left} ${top} L${left} ${bottom} L${right} ${cy} Z" fill="#ffffff" stroke="#111827" stroke-width="2.5"/>
    ${text(left + 18, minusY + 5, '-', { fill: '#111827', size: 18, weight: 800 })}
    ${text(left + 18, plusY + 6, '+', { fill: '#111827', size: 16, weight: 800 })}
    ${options.label ? text(cx - 2, cy + 5, options.label, { fill: '#374151', size: 13, weight: 700 }) : ''}
  `
}

function lightResistorH(x1, y, x2, label, labelY = y - 16, options = {}) {
  const color = options.color ?? '#d97706'
  const bodyWidth = Math.min(62, Math.max(38, (x2 - x1) * 0.42))
  const bodyX = (x1 + x2 - bodyWidth) / 2
  return `
    ${line(x1, y, bodyX, y, { stroke: '#111827', width: 2 })}
    ${rect(bodyX, y - 10, bodyWidth, 20, { fill: options.fill ?? '#ffffff', stroke: color, strokeWidth: 3, rx: 2 })}
    ${line(bodyX + bodyWidth, y, x2, y, { stroke: '#111827', width: 2 })}
    ${text((x1 + x2) / 2, labelY, label, { fill: color, size: 13, weight: 800 })}
  `
}

function lightResistorV(x, y1, y2, label, labelX = x + 18, options = {}) {
  const color = options.color ?? '#d97706'
  const bodyHeight = Math.min(54, Math.max(34, Math.abs(y2 - y1) * 0.42))
  const bodyY = (y1 + y2 - bodyHeight) / 2
  return `
    ${line(x, y1, x, bodyY, { stroke: '#111827', width: 2 })}
    ${rect(x - 10, bodyY, 20, bodyHeight, { fill: options.fill ?? '#ffffff', stroke: color, strokeWidth: 3, rx: 2 })}
    ${line(x, bodyY + bodyHeight, x, y2, { stroke: '#111827', width: 2 })}
    ${text(labelX, (y1 + y2) / 2 + 5, label, { fill: color, size: 13, weight: 800, anchor: 'start' })}
  `
}

function lightLoad(x, y, w = 88, h = 62, label = 'LOAD') {
  return `${rect(x, y, w, h, { fill: '#f8fafc', stroke: '#111827', strokeWidth: 2, rx: 1 })}${text(x + w / 2, y + h / 2 + 5, label, { fill: '#111827', size: 14, weight: 800 })}`
}

function currentLoop(x, options = {}) {
  const shuntTop = options.shuntTop ?? 170
  return `
    ${sourceSymbol(x, 125, '#111827')}
    ${text(x, 88, 'VBUS', { fill: '#111827', size: 14, weight: 800 })}
    ${line(x, 143, x, shuntTop, { stroke: '#111827', width: 2 })}
    ${lightResistorV(x, shuntTop, shuntTop + 66, 'RSHUNT')}
    ${line(x, shuntTop + 66, x, shuntTop + 92, { stroke: '#111827', width: 2 })}
    ${lightLoad(x - 40, shuntTop + 92, 80, 56, 'LOAD')}
    ${line(x, shuntTop + 148, x, shuntTop + 170, { stroke: '#111827', width: 2 })}
    ${schematicGround(x, shuntTop + 170, '#111827')}
  `
}

function renderCurrentSenseHighLowV2({ title }) {
  const panel = (x, highSide) => {
    const shuntTop = highSide ? 144 : 274
    const loadTop = highSide ? 238 : 154
    const ampCx = x + 260
    const ampCy = 330
    const upperTap = highSide ? shuntTop : shuntTop
    const lowerTap = shuntTop + 62
    return `
      ${rect(x, 70, 392, 390, { fill: '#ffffff', stroke: highSide ? '#2563eb' : '#0f766e', strokeWidth: 2, rx: 6 })}
      ${text(x + 196, 103, highSide ? 'HIGH-SIDE' : 'LOW-SIDE', { fill: highSide ? '#1d4ed8' : '#0f766e', size: 18, weight: 800 })}
      ${text(x + 92, 128, 'VBUS', { fill: '#111827', size: 13, weight: 800 })}
      ${line(x + 92, 134, x + 92, highSide ? shuntTop : loadTop, { stroke: '#111827', width: 2 })}
      ${highSide ? lightResistorV(x + 92, shuntTop, lowerTap, 'RSHUNT') : lightLoad(x + 52, loadTop, 80, 58, 'LOAD')}
      ${highSide ? line(x + 92, lowerTap, x + 92, loadTop, { stroke: '#111827', width: 2 }) : line(x + 92, loadTop + 58, x + 92, shuntTop, { stroke: '#111827', width: 2 })}
      ${highSide ? lightLoad(x + 52, loadTop, 80, 58, 'LOAD') : lightResistorV(x + 92, shuntTop, lowerTap, 'RSHUNT')}
      ${line(x + 92, highSide ? loadTop + 58 : lowerTap, x + 92, 374, { stroke: '#111827', width: 2 })}
      ${schematicGround(x + 92, 374, '#111827')}
      ${lightOpAmp(ampCx, ampCy, { label: 'CSA' })}
      ${path(`M${x + 92} ${upperTap} H${x + 178} V${ampCy - 22} H${ampCx - 56}`, { stroke: '#2563eb', width: 2 })}
      ${path(`M${x + 92} ${lowerTap} H${x + 160} V${ampCy + 22} H${ampCx - 56}`, { stroke: '#dc2626', width: 2 })}
      ${line(ampCx + 56, ampCy, x + 360, ampCy, { stroke: '#0f766e', width: 2, arrow: 'teal' })}
      ${text(x + 356, ampCy - 12, 'VOUT', { fill: '#0f766e', size: 12, anchor: 'end', weight: 800 })}
      ${text(x + 196, 436, highSide ? 'Measures load current; VCM is near VBUS' : 'Simple input range; load ground is lifted', { fill: '#374151', size: 13, weight: 700 })}
    `
  }
  return lightFrame(860, 490, title, `${panel(28, true)}${panel(440, false)}`)
}

function renderCurrentShuntTradeoffV2({ title }) {
  const body = `
    ${text(80, 155, 'VIN', { fill: '#111827', size: 15, anchor: 'start', weight: 800 })}
    ${line(115, 150, 190, 150, { stroke: '#111827', width: 3, arrow: 'gray' })}
    ${lightResistorH(190, 150, 430, 'RSHUNT', 126, { color: '#7c3aed' })}
    ${line(430, 150, 500, 150, { stroke: '#111827', width: 3 })}
    ${lightLoad(500, 118, 96, 64, 'LOAD')}${line(596, 150, 640, 150, { stroke: '#111827', width: 2 })}${schematicGround(640, 150, '#111827')}
    ${path('M210 150 V284 H368', { stroke: '#2563eb', width: 2 })}
    ${path('M410 150 V190 H180 V332 H368', { stroke: '#dc2626', width: 2 })}
    ${lightOpAmp(430, 308, { w: 124, h: 96, label: 'CSA' })}
    ${line(492, 308, 610, 308, { stroke: '#0f766e', width: 2, arrow: 'teal' })}
    ${text(600, 292, 'VOUT', { fill: '#0f766e', size: 13, anchor: 'end', weight: 800 })}
    ${text(220, 228, 'VSHUNT = I × RSHUNT', { fill: '#1d4ed8', size: 16, weight: 800 })}
    ${line(232, 246, 232, 348, { stroke: '#cbd5e1', width: 2 })}
    ${text(210, 380, 'TOO SMALL', { fill: '#b45309', size: 15, weight: 800 })}
    ${text(210, 404, 'signal approaches offset + noise', { fill: '#374151', size: 13 })}
    ${text(650, 380, 'TOO LARGE', { fill: '#dc2626', size: 15, weight: 800 })}
    ${text(650, 404, 'I²R heat + load voltage loss', { fill: '#374151', size: 13 })}
    ${path('M302 436 H558', { stroke: '#0f766e', width: 8 })}
    ${text(430, 462, 'Choose enough signal margin without excessive dissipation', { fill: '#0f766e', size: 14, weight: 800 })}
  `
  return lightFrame(860, 490, title, body)
}

function renderKelvinShuntV2({ title }) {
  const body = `
    ${text(70, 142, 'CURRENT IN', { fill: '#111827', size: 14, anchor: 'start', weight: 800 })}
    ${line(70, 170, 190, 170, { stroke: '#111827', width: 3, arrow: 'gray' })}${line(190, 170, 205, 170, { stroke: '#111827', width: 5 })}
    ${lightResistorH(205, 170, 505, '4-TERMINAL SHUNT', 134, { color: '#7c3aed' })}
    ${line(505, 170, 620, 170, { stroke: '#111827', width: 5 })}${line(620, 170, 650, 170, { stroke: '#111827', width: 3, arrow: 'gray' })}
    ${lightLoad(650, 138, 104, 64, 'LOAD')}
    ${circle(230, 170, 5, { fill: '#2563eb', stroke: '#2563eb' })}
    ${circle(480, 170, 5, { fill: '#dc2626', stroke: '#dc2626' })}
    ${path('M230 170 V286 H356', { stroke: '#2563eb', width: 2 })}
    ${path('M480 170 V205 H190 V334 H356', { stroke: '#dc2626', width: 2 })}
    ${lightOpAmp(420, 310, { w: 128, h: 96, label: 'CSA' })}
    ${line(484, 310, 640, 310, { stroke: '#0f766e', width: 2, arrow: 'teal' })}
    ${text(630, 292, 'VOUT', { fill: '#0f766e', size: 13, anchor: 'end', weight: 800 })}
    ${text(355, 238, 'Dedicated Kelvin sense traces', { fill: '#1d4ed8', size: 15, weight: 800 })}
    ${text(430, 414, 'Sense traces touch the resistor terminals, not the high-current copper path', { fill: '#374151', size: 15, weight: 700 })}
    ${text(430, 442, 'This excludes connector, pad, and PCB trace voltage drops', { fill: '#0f766e', size: 14, weight: 800 })}
  `
  return lightFrame(860, 475, title, body)
}

function renderLowSideOpAmpCurrentV2({ title }) {
  const body = `
    ${sourceSymbol(92, 126, '#111827')}${text(92, 86, 'VBUS', { fill: '#111827', size: 14, weight: 800 })}
    ${line(92, 144, 92, 170, { stroke: '#111827', width: 2 })}${lightLoad(52, 170, 80, 58, 'LOAD')}
    ${line(92, 228, 92, 252, { stroke: '#111827', width: 2 })}${lightResistorV(92, 252, 320, 'RSHUNT', 112, { color: '#7c3aed' })}
    ${junction(92, 252)}${lightResistorV(92, 320, 374, 'RP', 112, { color: '#dc2626' })}${schematicGround(92, 374, '#111827')}
    ${lightOpAmp(486, 240, { w: 140, h: 112, label: 'OP AMP' })}
    ${path('M92 252 H326 V268 H416', { stroke: '#2563eb', width: 2 })}
    ${lightResistorH(276, 212, 380, 'RG', 190, { color: '#059669' })}${path('M276 212 V346 M380 212 H416', { stroke: '#111827', width: 2 })}${schematicGround(276, 346, '#111827')}
    ${line(556, 240, 690, 240, { stroke: '#0f766e', width: 2, arrow: 'teal' })}${text(680, 222, 'VOUT', { fill: '#0f766e', size: 13, anchor: 'end', weight: 800 })}
    ${path('M610 240 V116 M380 116 V212 H416', { stroke: '#111827', width: 2 })}${lightResistorH(380, 116, 610, 'RF', 94, { color: '#d97706' })}
    ${text(204, 354, 'PCB parasitic RP', { fill: '#dc2626', size: 14, weight: 800 })}
    ${line(180, 344, 116, 335, { stroke: '#dc2626', width: 2, arrow: 'red' })}
    ${text(430, 426, 'RP shifts the local ground reference and creates gain error', { fill: '#374151', size: 15, weight: 700 })}
  `
  return lightFrame(780, 460, title, body)
}

function renderInstrumentationAmpCurrentV2({ title }) {
  const body = `
    ${sourceSymbol(72, 125, '#111827')}${text(72, 87, 'VBUS', { fill: '#111827', size: 13, weight: 800 })}
    ${line(72, 143, 72, 166, { stroke: '#111827', width: 2 })}${lightLoad(35, 166, 74, 54, 'LOAD')}${line(72, 220, 72, 242, { stroke: '#111827', width: 2 })}
    ${lightResistorV(72, 242, 304, 'RSHUNT', 92, { color: '#7c3aed' })}${lightResistorV(72, 304, 352, 'RP', 92, { color: '#dc2626' })}${schematicGround(72, 352, '#111827')}
    ${rect(216, 70, 610, 350, { fill: '#ffffff', stroke: '#64748b', strokeWidth: 2, rx: 2 })}
    ${text(236, 102, 'INSTRUMENTATION AMPLIFIER', { fill: '#374151', size: 14, anchor: 'start', weight: 800 })}
    ${path('M72 242 H246 V192 H334', { stroke: '#2563eb', width: 2 })}${path('M72 304 H230 V332 H334', { stroke: '#dc2626', width: 2 })}
    ${lightOpAmp(390, 170, { w: 112, h: 88, label: 'A1' })}${lightOpAmp(390, 310, { w: 112, h: 88, label: 'A2' })}
    ${path('M446 170 H480 V108 H286 V148 H334', { stroke: '#111827', width: 2 })}
    ${path('M446 310 H480 V390 H286 V288 H334', { stroke: '#111827', width: 2 })}
    ${line(286, 148, 286, 170, { stroke: '#111827', width: 2 })}${lightResistorV(286, 170, 288, 'RG', 304, { color: '#059669' })}
    ${line(446, 170, 520, 170, { stroke: '#111827', width: 2 })}${line(446, 310, 540, 310, { stroke: '#111827', width: 2 })}
    ${lightResistorH(520, 170, 590, 'R1', 150, { color: '#2563eb' })}${path('M590 170 V214 H626', { stroke: '#111827', width: 2 })}
    ${lightResistorH(540, 310, 610, 'R1', 290, { color: '#2563eb' })}${path('M610 310 V266 H626', { stroke: '#111827', width: 2 })}
    ${lightOpAmp(690, 240, { w: 128, h: 104, label: 'A3' })}
    ${path('M754 240 H792', { stroke: '#0f766e', width: 2, arrow: 'teal' })}${text(786, 222, 'VOUT', { fill: '#0f766e', size: 12, anchor: 'end', weight: 800 })}
    ${path('M770 240 V108 M590 108 V214 H626', { stroke: '#111827', width: 2 })}${lightResistorH(590, 108, 770, 'RF', 88, { color: '#d97706' })}
    ${path('M626 266 H610 V330', { stroke: '#111827', width: 2 })}${lightResistorV(610, 330, 382, 'RF', 628, { color: '#d97706' })}${schematicGround(610, 382, '#111827')}
    ${text(430, 448, 'High input impedance and one gain-setting resistor; common-mode range still matters', { fill: '#374151', size: 14, weight: 700 })}
  `
  return lightFrame(860, 480, title, body)
}

function renderDifferenceAmpCurrentV2({ title }) {
  const body = `
    ${sourceSymbol(72, 126, '#111827')}${text(72, 88, 'VBUS', { fill: '#111827', size: 13, weight: 800 })}
    ${line(72, 144, 72, 166, { stroke: '#111827', width: 2 })}${lightLoad(35, 166, 74, 54, 'LOAD')}${line(72, 220, 72, 242, { stroke: '#111827', width: 2 })}
    ${lightResistorV(72, 242, 304, 'RSHUNT', 92, { color: '#7c3aed' })}${lightResistorV(72, 304, 352, 'RP', 92, { color: '#dc2626' })}${schematicGround(72, 352, '#111827')}
    ${rect(220, 84, 590, 300, { fill: '#ffffff', stroke: '#64748b', strokeWidth: 2, rx: 2 })}${text(240, 110, 'DIFFERENCE AMPLIFIER', { fill: '#374151', size: 14, anchor: 'start', weight: 800 })}
    ${path('M72 242 H246 V184 H292', { stroke: '#2563eb', width: 2 })}${path('M72 304 H264 V278 H292', { stroke: '#dc2626', width: 2 })}
    ${lightResistorH(292, 184, 400, 'RIN', 162, { color: '#2563eb' })}${path('M400 184 V199 H438', { stroke: '#111827', width: 2 })}
    ${lightResistorH(292, 278, 400, 'RIN', 256, { color: '#2563eb' })}${path('M400 278 V263 H438', { stroke: '#111827', width: 2 })}
    ${lightOpAmp(520, 231, { w: 164, h: 128, label: 'OP AMP' })}
    ${line(602, 231, 760, 231, { stroke: '#0f766e', width: 2, arrow: 'teal' })}${text(750, 214, 'VOUT', { fill: '#0f766e', size: 12, anchor: 'end', weight: 800 })}
    ${path('M688 231 V126 M410 126 V199 H438', { stroke: '#111827', width: 2 })}${lightResistorH(410, 126, 688, 'RF', 104, { color: '#d97706' })}${junction(410, 199)}
    ${path('M438 263 H410 V298', { stroke: '#111827', width: 2 })}${lightResistorV(410, 298, 350, 'RF', 428, { color: '#d97706' })}${schematicGround(410, 350, '#111827')}${junction(410, 263)}
    ${text(515, 430, 'Matched resistor ratios reject VCM; the input divider must keep op-amp pins in range', { fill: '#374151', size: 14, weight: 700 })}
  `
  return lightFrame(860, 460, title, body)
}

function renderCurrentSenseAmpV2({ title }) {
  const body = `
    ${sourceSymbol(78, 128, '#111827')}${text(78, 88, 'VBUS', { fill: '#111827', size: 13, weight: 800 })}
    ${line(78, 146, 150, 146, { stroke: '#111827', width: 2 })}${lightResistorH(150, 146, 340, 'RSHUNT', 124, { color: '#7c3aed' })}${line(340, 146, 400, 146, { stroke: '#111827', width: 2 })}${lightLoad(400, 114, 92, 64, 'LOAD')}${line(492, 146, 536, 146, { stroke: '#111827', width: 2 })}${schematicGround(536, 146, '#111827')}
    ${rect(190, 210, 590, 250, { fill: '#ffffff', stroke: '#64748b', strokeWidth: 2, rx: 2 })}
    ${text(225, 238, 'DEDICATED CURRENT-SENSE AMPLIFIER', { fill: '#374151', size: 14, anchor: 'start', weight: 800 })}
    ${path('M174 146 V302 H250', { stroke: '#2563eb', width: 2 })}${path('M316 146 V192 H150 V352 H250', { stroke: '#dc2626', width: 2 })}
    ${text(238, 295, 'IN+', { fill: '#2563eb', size: 12, anchor: 'end', weight: 800 })}${text(238, 345, 'IN−', { fill: '#dc2626', size: 12, anchor: 'end', weight: 800 })}
    ${rect(250, 270, 140, 104, { fill: '#f8fafc', stroke: '#111827', strokeWidth: 2, rx: 1 })}${text(320, 312, 'input bias', { fill: '#374151', size: 13, weight: 700 })}${text(320, 334, 'stage', { fill: '#374151', size: 13, weight: 700 })}
    ${lightResistorH(390, 302, 470, 'R1', 284, { color: '#2563eb' })}${lightResistorH(390, 352, 470, 'R2', 334, { color: '#059669' })}
    ${lightOpAmp(540, 327, { w: 140, h: 100, label: 'CSA' })}
    ${path('M610 327 H738', { stroke: '#0f766e', width: 2, arrow: 'teal' })}${text(728, 309, 'VOUT', { fill: '#0f766e', size: 12, anchor: 'end', weight: 800 })}
    ${path('M610 327 V248 M460 248 V302 H470', { stroke: '#111827', width: 2 })}${lightResistorH(460, 248, 610, 'RF', 230, { color: '#d97706' })}${junction(460, 302)}
    ${path('M470 352 H460 V380', { stroke: '#111827', width: 2 })}${lightResistorV(460, 380, 420, 'RREF', 480, { color: '#a855f7' })}${schematicGround(460, 420, '#111827')}
    ${text(430, 504, 'Floating inputs tolerate high VCM; integrated matching minimizes gain error and drift', { fill: '#374151', size: 14, weight: 700 })}
  `
  return lightFrame(860, 535, title, body)
}

function renderCurrentDifferenceEquation({ title }) {
  const body = `
    ${text(52, 176, 'VIN−', { fill: '#1d4ed8', size: 14, anchor: 'start', weight: 800 })}${line(102, 172, 142, 172, { stroke: '#2563eb', width: 2 })}${lightResistorH(142, 172, 296, 'RIN', 150, { color: '#2563eb' })}${path('M296 172 H318 V191', { stroke: '#111827', width: 2 })}
    ${text(52, 286, 'VIN+', { fill: '#0f766e', size: 14, anchor: 'start', weight: 800 })}${line(102, 282, 142, 282, { stroke: '#0f766e', width: 2 })}${lightResistorH(142, 282, 296, 'RIN', 260, { color: '#059669' })}${path('M296 282 H318 V263', { stroke: '#111827', width: 2 })}
    ${lightOpAmp(410, 227, { w: 184, h: 144, label: 'OP AMP' })}
    ${line(502, 227, 692, 227, { stroke: '#0f766e', width: 2, arrow: 'teal' })}${text(680, 207, 'VOUT', { fill: '#0f766e', size: 14, anchor: 'end', weight: 800 })}
    ${path('M594 227 V108 M286 108 V191 H318', { stroke: '#111827', width: 2 })}${lightResistorH(286, 108, 594, 'RF', 86, { color: '#d97706' })}
    ${path('M318 263 H286 V310', { stroke: '#111827', width: 2 })}${lightResistorV(286, 310, 370, 'RF', 304, { color: '#a855f7' })}${schematicGround(286, 370, '#111827')}
    ${junction(318, 191)}${junction(318, 263)}${junction(594, 227)}
    ${text(410, 426, 'For matched ratios:  VOUT = (RF / RIN) × (VIN+ − VIN−)', { fill: '#111827', size: 18, weight: 800 })}
  `
  return lightFrame(760, 460, title, body)
}

function currentSenseAmplifierBlock(x, y, label = 'sense amp') {
  return `${rect(x, y, 128, 72, { fill: C.panel2, stroke: C.teal, rx: 7 })}${text(x + 64, y + 31, label, { fill: C.fg, size: 15, weight: 800 })}${text(x + 18, y + 60, '+', { fill: C.green, size: 18, weight: 800 })}${text(x + 110, y + 60, '-', { fill: C.red, size: 18, weight: 800 })}`
}

function renderCurrentSenseHighLow({ title }) {
  const panel = (x, highSide) => {
    const shuntTop = highSide ? 146 : 246
    const shuntBottom = shuntTop + 58
    const loadTop = highSide ? 220 : 146
    const loadBottom = loadTop + 58
    const ampY = 300
    return `
      ${rect(x, 78, 320, 320, { fill: C.panel, stroke: highSide ? C.blue : C.teal, rx: 8 })}
      ${text(x + 160, 108, highSide ? 'High-side sensing' : 'Low-side sensing', { fill: highSide ? C.blue : C.teal, size: 20, weight: 800 })}
      ${text(x + 160, 132, highSide ? 'shunt before load' : 'shunt after load', { fill: C.muted, size: 13 })}
      ${text(x + 72, 126, 'Vin', { fill: C.yellow, size: 16, weight: 800 })}
      ${line(x + 72, 132, x + 72, Math.min(shuntTop, loadTop), { stroke: C.fg, width: 3 })}
      ${highSide ? resistorV(x + 72, shuntTop, shuntBottom, 'Rshunt') : rect(x + 38, loadTop, 68, 58, { fill: '#162235', stroke: C.green, rx: 5 })}
      ${highSide ? rect(x + 38, loadTop, 68, 58, { fill: '#162235', stroke: C.green, rx: 5 }) : resistorV(x + 72, shuntTop, shuntBottom, 'Rshunt')}
      ${text(x + 72, loadTop + 34, 'LOAD', { fill: C.green, size: 15, weight: 800 })}
      ${line(x + 72, highSide ? shuntBottom : loadBottom, x + 72, highSide ? loadTop : shuntTop, { stroke: C.fg, width: 3 })}
      ${ground(x + 72, highSide ? loadBottom : shuntBottom)}
      ${currentSenseAmplifierBlock(x + 152, ampY, 'differential amp')}
      ${path(`M${x + 72} ${shuntTop} H${x + 170} V${ampY + 58}`, { stroke: C.blue, width: 2 })}
      ${path(`M${x + 72} ${shuntBottom} H${x + 262} V${ampY + 58}`, { stroke: C.red, width: 2 })}
      ${text(x + 160, 388, highSide ? 'VCM ≈ Vin' : 'VCM ≈ GND', { fill: C.yellow, size: 14, weight: 800 })}
    `
  }
  return frame(760, 430, title, `${panel(42, true)}${panel(398, false)}`)
}

function renderCurrentShuntTradeoff({ title }) {
  const body = `
    ${text(58, 170, 'Vin', { fill: C.blue, size: 18, anchor: 'start', weight: 800 })}
    ${line(92, 176, 150, 176, { stroke: C.fg, width: 4 })}
    ${resistorH(150, 176, 360, 'Rshunt (choose carefully)')}
    ${line(360, 176, 430, 176, { stroke: C.fg, width: 4 })}
    ${rect(430, 142, 104, 68, { fill: C.panel2, stroke: C.green, rx: 6 })}${text(482, 181, 'LOAD', { fill: C.green, size: 17, weight: 800 })}
    ${ground(534, 176)}
    ${currentSenseAmplifierBlock(286, 264, 'precision amp')}
    ${path('M170 176 V322 H304', { stroke: C.blue, width: 2 })}
    ${path('M340 176 V322 H396', { stroke: C.red, width: 2 })}
    ${rect(56, 76, 252, 64, { fill: '#351a20', stroke: C.red, rx: 6 })}
    ${text(182, 102, 'Rshunt too large', { fill: C.red, size: 17, weight: 800 })}
    ${text(182, 126, 'P = I²R, heat and load drop', { fill: C.fg, size: 14 })}
    ${line(244, 140, 254, 163, { stroke: C.red, width: 2, arrow: 'red' })}
    ${rect(442, 76, 252, 64, { fill: '#302714', stroke: C.yellow, rx: 6 })}
    ${text(568, 102, 'Rshunt too small', { fill: C.yellow, size: 17, weight: 800 })}
    ${text(568, 126, 'I·Rshunt is buried by Vos', { fill: C.fg, size: 14 })}
    ${line(494, 140, 360, 163, { stroke: C.yellow, width: 2, arrow: 'yellow' })}
    ${text(370, 382, 'Signal margin must exceed input offset voltage and noise', { fill: C.fg, size: 17, weight: 800 })}
  `
  return frame(740, 420, title, body)
}

function renderKelvinShunt({ title }) {
  const body = `
    ${rect(42, 104, 230, 128, { fill: '#d97706', stroke: '#92400e', strokeWidth: 2, rx: 3 })}
    ${rect(508, 104, 230, 128, { fill: '#d97706', stroke: '#92400e', strokeWidth: 2, rx: 3 })}
    ${rect(254, 124, 272, 88, { fill: '#e5e7eb', stroke: '#475569', strokeWidth: 3, rx: 4 })}
    ${rect(272, 142, 236, 52, { fill: '#f8fafc', stroke: '#64748b', strokeWidth: 2, rx: 2 })}
    ${text(390, 174, '4-terminal shunt', { fill: '#111827', size: 19, weight: 800 })}
    ${text(92, 90, 'HIGH CURRENT IN', { fill: '#b45309', size: 16, anchor: 'start', weight: 800 })}
    ${text(688, 90, 'HIGH CURRENT OUT', { fill: '#b45309', size: 16, anchor: 'end', weight: 800 })}
    ${path('M286 194 V280 H622', { stroke: '#2563eb', width: 3 })}
    ${path('M494 194 V300 H622', { stroke: '#dc2626', width: 3 })}
    ${circle(286, 194, 5, { fill: '#2563eb', stroke: '#2563eb' })}
    ${circle(494, 194, 5, { fill: '#dc2626', stroke: '#dc2626' })}
    ${rect(622, 258, 116, 64, { fill: '#f8fafc', stroke: '#0f766e', strokeWidth: 2, rx: 5 })}
    ${text(680, 285, 'sense amp', { fill: '#0f766e', size: 16, weight: 800 })}
    ${text(642, 310, '+', { fill: '#2563eb', size: 16, weight: 800 })}${text(716, 310, '-', { fill: '#dc2626', size: 16, weight: 800 })}
    ${text(350, 276, 'thin Kelvin sense traces', { fill: '#2563eb', size: 16, weight: 800 })}
    ${text(390, 354, 'Sense directly at the resistor element, outside the high-current copper drop', { fill: '#374151', size: 17, weight: 800 })}
  `
  return lightFrame(780, 390, title, body)
}

function renderLowSideOpAmpCurrent({ title }) {
  const body = `
    ${text(92, 82, 'Vbus', { fill: C.yellow, size: 17, weight: 800 })}
    ${line(92, 94, 92, 122, { stroke: C.fg, width: 3 })}
    ${rect(54, 122, 76, 58, { fill: C.panel2, stroke: C.green, rx: 5 })}${text(92, 156, 'LOAD', { fill: C.green, size: 15, weight: 800 })}
    ${line(92, 180, 92, 208, { stroke: C.fg, width: 3 })}
    ${resistorV(92, 208, 276, 'Rshunt')}${junction(92, 208)}
    ${resistorV(92, 276, 330, 'Rp', { stroke: C.red, labelFill: C.red })}${ground(92, 330)}
    ${opAmp(424, 210, { label: 'op-amp' })}
    ${path('M92 208 H250 V243 H347', { stroke: C.blue, width: 3 })}
    ${line(347, 177, 292, 177, { stroke: C.yellow, width: 3 })}${resistorV(292, 177, 270, 'Rg')}${ground(292, 270)}
    ${line(501, 210, 650, 210, { stroke: C.green, width: 4, arrow: 'teal' })}${text(638, 192, 'Vout', { fill: C.green, size: 17, anchor: 'end', weight: 800 })}
    ${line(570, 210, 570, 112, { stroke: C.yellow, width: 3 })}${resistorH(347, 112, 570, 'Rf')}${line(347, 112, 347, 177, { stroke: C.yellow, width: 3 })}
    ${rect(492, 290, 210, 64, { fill: '#351a20', stroke: C.red, rx: 6 })}
    ${text(597, 316, 'Rp shifts local ground', { fill: C.red, size: 16, weight: 800 })}
    ${text(597, 340, 'and creates gain error', { fill: C.fg, size: 14 })}
    ${line(492, 318, 126, 300, { stroke: C.red, width: 2, arrow: 'red' })}
  `
  return frame(740, 390, title, body)
}

function renderInstrumentationAmpCurrent({ title }) {
  const body = `
    ${text(70, 82, 'Vbus', { fill: C.yellow, size: 16, weight: 800 })}${line(70, 92, 70, 116, { stroke: C.fg, width: 3 })}
    ${rect(34, 116, 72, 54, { fill: C.panel2, stroke: C.green, rx: 5 })}${text(70, 148, 'LOAD', { fill: C.green, size: 14, weight: 800 })}
    ${line(70, 170, 70, 188, { stroke: C.fg, width: 3 })}
    ${resistorV(70, 188, 254, 'Rshunt')}${resistorV(70, 254, 304, 'Rp', { stroke: C.red, labelFill: C.red })}${ground(70, 304)}
    ${path('M70 188 H210 V178 H270', { stroke: C.blue, width: 2 })}${path('M70 254 H190 V278 H270', { stroke: C.red, width: 2 })}
    ${rect(228, 92, 432, 236, { fill: C.panel, stroke: C.teal, rx: 8 })}
    ${text(444, 120, 'Instrumentation amplifier', { fill: C.teal, size: 19, weight: 800 })}
    ${opAmp(318, 160, { w: 96, h: 72, label: 'A1', labelSize: 13 })}${opAmp(318, 260, { w: 96, h: 72, label: 'A2', labelSize: 13 })}
    ${path('M366 160 H390 V142 H270', { stroke: C.yellow, width: 2 })}${path('M366 260 H390 V242 H270', { stroke: C.yellow, width: 2 })}
    ${line(250, 142, 270, 142, { stroke: C.yellow, width: 2 })}${resistorV(250, 142, 242, '')}${line(250, 242, 270, 242, { stroke: C.yellow, width: 2 })}${text(222, 198, 'Rg', { fill: C.yellow, size: 14, weight: 800 })}
    ${line(366, 160, 410, 160, { stroke: C.fg, width: 2 })}${line(366, 260, 410, 260, { stroke: C.fg, width: 2 })}
    ${rect(410, 142, 132, 136, { fill: C.panel2, stroke: C.yellow, rx: 6 })}${text(476, 205, 'difference', { fill: C.fg, size: 15, weight: 800 })}${text(476, 226, 'stage', { fill: C.fg, size: 15, weight: 800 })}
    ${line(542, 210, 692, 210, { stroke: C.green, width: 4, arrow: 'teal' })}${text(680, 191, 'Vout', { fill: C.green, size: 16, anchor: 'end', weight: 800 })}
    ${text(444, 310, 'High Zin; gain set with one Rg', { fill: C.fg, size: 16, weight: 800 })}
    ${text(370, 362, 'Kelvin inputs reject PCB parasitic drop, but VCM must stay within the IA supply range', { fill: C.yellow, size: 15, weight: 700 })}
  `
  return frame(740, 400, title, body)
}

function renderDifferenceAmpCurrent({ title }) {
  const body = `
    ${text(74, 74, 'Vbus', { fill: C.yellow, size: 16, weight: 800 })}${line(74, 82, 74, 96, { stroke: C.fg, width: 3 })}${rect(38, 96, 72, 52, { fill: C.panel2, stroke: C.green, rx: 5 })}${text(74, 127, 'LOAD', { fill: C.green, size: 14, weight: 800 })}${line(74, 148, 74, 166, { stroke: C.fg, width: 3 })}
    ${resistorV(74, 166, 226, 'Rshunt')}${resistorV(74, 226, 278, 'Rp', { stroke: C.red, labelFill: C.red })}${ground(74, 278)}
    ${path('M74 166 H244 V165 H286', { stroke: C.blue, width: 2 })}${path('M74 226 H224 V223 H286', { stroke: C.red, width: 2 })}
    ${rect(260, 82, 416, 238, { fill: C.panel, stroke: C.teal, rx: 8 })}${text(278, 106, 'Difference amplifier', { fill: C.teal, size: 17, anchor: 'start', weight: 800 })}
    ${resistorH(286, 165, 417, 'Rin')}${resistorH(286, 223, 417, 'Rin')}${opAmp(486, 194, { w: 138, h: 116, label: 'DA' })}
    ${line(555, 194, 640, 194, { stroke: C.green, width: 4, arrow: 'teal' })}${text(628, 176, 'Vout', { fill: C.green, size: 16, anchor: 'end', weight: 800 })}
    ${line(596, 194, 596, 112, { stroke: C.yellow, width: 2 })}${resistorH(417, 112, 596, 'Rf')}${line(417, 112, 417, 165, { stroke: C.yellow, width: 2 })}
    ${resistorV(417, 223, 290, 'Rf')}${ground(417, 290)}
    ${text(468, 344, 'Matched divider attenuates VCM so the op-amp pins remain safe', { fill: C.yellow, size: 16, weight: 800 })}
    ${text(468, 370, 'Tradeoff: finite input resistance loads the sensed system', { fill: C.fg, size: 15, weight: 700 })}
  `
  return frame(740, 400, title, body)
}

function renderCurrentSenseAmp({ title }) {
  const body = `
    ${text(62, 116, 'Vbus', { fill: C.yellow, size: 17, weight: 800 })}${line(90, 122, 132, 122, { stroke: C.fg, width: 4 })}
    ${resistorH(132, 122, 310, 'Rshunt')}${line(310, 122, 374, 122, { stroke: C.fg, width: 4 })}
    ${rect(374, 90, 94, 64, { fill: C.panel2, stroke: C.green, rx: 5 })}${text(421, 127, 'LOAD', { fill: C.green, size: 15, weight: 800 })}${ground(468, 122)}
    ${path('M150 122 V244 H222', { stroke: C.blue, width: 2 })}${path('M292 122 V288 H222', { stroke: C.red, width: 2 })}
    ${rect(198, 184, 474, 166, { fill: C.panel, stroke: C.teal, rx: 8 })}${text(435, 214, 'Dedicated current-sense amplifier', { fill: C.teal, size: 19, weight: 800 })}
    ${rect(222, 228, 142, 78, { fill: C.panel2, stroke: C.blue, rx: 6 })}${text(293, 258, 'floating input', { fill: C.blue, size: 15, weight: 800 })}${text(293, 281, 'bias stage', { fill: C.blue, size: 15, weight: 800 })}
    ${text(232, 240, 'IN+', { fill: C.blue, size: 11, anchor: 'start', weight: 800 })}${text(232, 302, 'IN-', { fill: C.red, size: 11, anchor: 'start', weight: 800 })}
    ${line(364, 267, 406, 267, { stroke: C.fg, width: 3, arrow: true })}
    ${rect(406, 228, 142, 78, { fill: C.panel2, stroke: C.yellow, rx: 6 })}${text(477, 258, 'precision gain', { fill: C.yellow, size: 15, weight: 800 })}${text(477, 281, 'network', { fill: C.yellow, size: 15, weight: 800 })}
    ${line(548, 267, 700, 267, { stroke: C.green, width: 4, arrow: 'teal' })}${text(688, 248, 'Vout', { fill: C.green, size: 16, anchor: 'end', weight: 800 })}
    ${text(156, 166, 'VCM ≈ Vbus and may be much greater than Vs', { fill: C.red, size: 15, anchor: 'start', weight: 800 })}
    ${text(435, 382, 'High input impedance + integrated resistor matching = low error and low drift', { fill: C.fg, size: 16, weight: 800 })}
  `
  return frame(740, 410, title, body)
}

function renderOpAmpDifference({ title }) {
  const g = opAmpGeometry(420, 190)
  const outNodeX = 552
  const plusTapX = 300
  const body = `
    ${opAmp(g.cx, g.cy)}
    ${line(62, g.minus.y, 112, g.minus.y, { stroke: C.blue, width: 3 })}
    ${resistorH(112, g.minus.y, 256, 'R1')}
    ${line(256, g.minus.y, g.left, g.minus.y, { stroke: C.fg, width: 3 })}
    ${text(72, g.minus.y - 17, 'V1', { fill: C.blue, size: 17, anchor: 'start' })}
    ${line(62, g.plus.y, 112, g.plus.y, { stroke: C.green, width: 3 })}
    ${resistorH(112, g.plus.y, 256, 'R2')}
    ${line(256, g.plus.y, g.left, g.plus.y, { stroke: C.fg, width: 3 })}
    ${text(72, g.plus.y - 17, 'V2', { fill: C.green, size: 17, anchor: 'start' })}
    ${line(g.left, g.minus.y, g.left, 102, { stroke: C.yellow, width: 3 })}
    ${resistorH(g.left, 102, outNodeX, 'R3')}
    ${line(outNodeX, 102, outNodeX, g.out.y, { stroke: C.yellow, width: 3 })}
    ${line(plusTapX, g.plus.y, plusTapX, 250, { stroke: C.fg, width: 3 })}
    ${resistorV(plusTapX, 250, 290, 'R4')}
    ${ground(plusTapX, 290)}
    ${line(g.out.x, g.out.y, 636, g.out.y, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${junction(g.left, g.minus.y)}
    ${junction(plusTapX, g.plus.y)}
    ${junction(outNodeX, g.out.y)}
    ${text(628, g.out.y - 18, 'Vout', { fill: C.green, size: 18, anchor: 'end' })}
    ${text(382, 342, 'Matched ratios: Vout = (R3 / R1) * (V2 - V1)', { fill: C.fg, size: 19, weight: 800 })}
  `
  return frame(740, 380, title, body)
}

function renderLdoPssrIq({ title }) {
  const panel = (x, heading, psrr, outputRipple, outputAmplitude, accent) => `
    ${rect(x, 82, 390, 318, { fill: '#0b1528', stroke: C.dim, rx: 6 })}
    ${text(x + 195, 112, heading, { fill: accent, size: 19, weight: 800 })}
    ${text(x + 195, 138, `${psrr} attenuation`, { fill: C.muted, size: 13 })}
    ${line(x + 54, 224, x + 350, 224, { stroke: C.dim, width: 1, dash: '5 5' })}
    ${path(`M${x + 54} 224 C${x + 72} 188 ${x + 90} 260 ${x + 108} 224 C${x + 126} 188 ${x + 144} 260 ${x + 162} 224 C${x + 180} 188 ${x + 198} 260 ${x + 216} 224 C${x + 234} 188 ${x + 252} 260 ${x + 270} 224 C${x + 288} 188 ${x + 306} 260 ${x + 324} 224 C${x + 336} 202 ${x + 344} 212 ${x + 350} 224`, { stroke: C.red, width: 3 })}
    ${text(x + 58, 178, 'VIN ripple: 100 mVpp', { fill: C.red, size: 13, weight: 700, anchor: 'start' })}
    ${line(x + 54, 326, x + 350, 326, { stroke: C.dim, width: 1, dash: '5 5' })}
    ${path(`M${x + 54} 326 C${x + 78} ${326 - outputAmplitude} ${x + 102} ${326 + outputAmplitude} ${x + 126} 326 C${x + 150} ${326 - outputAmplitude} ${x + 174} ${326 + outputAmplitude} ${x + 198} 326 C${x + 222} ${326 - outputAmplitude} ${x + 246} ${326 + outputAmplitude} ${x + 270} 326 C${x + 294} ${326 - outputAmplitude} ${x + 326} ${326 + outputAmplitude} ${x + 350} 326`, { stroke: accent, width: 4 })}
    ${text(x + 58, 286, `VOUT ripple: ${outputRipple}`, { fill: accent, size: 13, weight: 700, anchor: 'start' })}
    ${text(x + 195, 376, `100 mV / ${psrr === '20 dB' ? '10' : '1000'} = ${outputRipple}`, { fill: C.fg, size: 14, weight: 700 })}
  `
  const body = `
    ${panel(34, 'LOWER REJECTION', '20 dB', '10 mVpp', 12, C.orange)}
    ${panel(476, 'HIGHER REJECTION', '60 dB', '0.1 mVpp', 1, C.green)}
    ${text(450, 442, 'PSRR = 20 log10(VIN ripple / VOUT ripple)', { fill: C.yellow, size: 16, weight: 800 })}
  `
  return frame(900, 470, title, body)
}

function renderCapacitorBiasChart({ title }) {
  const body = `
    ${rect(72, 84, 560, 230)}
    ${line(118, 272, 590, 272, { stroke: C.fg, width: 2 })}
    ${line(118, 272, 118, 112, { stroke: C.fg, width: 2 })}
    ${path('M126 142 L580 144', { stroke: C.green, width: 4 })}
    ${path('M126 142 C240 150 356 186 580 254', { stroke: C.red, width: 4 })}
    ${text(535, 136, 'C0G stable', { fill: C.green, size: 15, anchor: 'start' })}
    ${rect(342, 150, 178, 30, { fill: '#0f172a', stroke: C.red, strokeWidth: 1, rx: 6 })}
    ${text(431, 170, 'X7R loses capacitance', { fill: C.red, size: 14 })}
    ${text(350, 304, 'Applied DC voltage', { fill: C.muted, size: 14 })}
    ${text(68, 190, 'Capacitance', { fill: C.muted, size: 14, anchor: 'middle' })}
  `
  return frame(700, 350, title, body)
}

function renderInductorLimits({ title }) {
  const body = `
    ${rect(48, 84, 292, 226)}
    ${rect(398, 84, 292, 226)}
    ${text(194, 120, 'Saturation current', { fill: C.yellow, size: 17 })}
    ${text(544, 120, 'RMS thermal limit', { fill: C.orange, size: 17 })}
    ${line(90, 262, 300, 262, { stroke: C.fg, width: 2 })}
    ${line(90, 262, 90, 142, { stroke: C.fg, width: 2 })}
    ${path('M96 154 L205 158 C228 162 242 206 286 246', { stroke: C.red, width: 4 })}
    ${line(224, 142, 224, 262, { stroke: C.yellow, width: 2, dash: '7 6' })}
    ${text(224, 284, 'I_sat', { fill: C.yellow, size: 13 })}
    ${line(440, 262, 650, 262, { stroke: C.fg, width: 2 })}
    ${line(440, 262, 440, 142, { stroke: C.fg, width: 2 })}
    ${path('M446 246 C500 236 560 204 642 152', { stroke: C.orange, width: 4 })}
    ${line(570, 142, 570, 262, { stroke: C.yellow, width: 2, dash: '7 6' })}
    ${text(570, 284, 'I_rms', { fill: C.yellow, size: 13 })}
  `
  return frame(740, 350, title, body)
}

function renderTvsIvCurve({ title }) {
  const body = `
    ${rect(62, 82, 596, 238)}
    ${line(120, 202, 604, 202, { stroke: C.fg, width: 2 })}
    ${line(362, 286, 362, 110, { stroke: C.fg, width: 2 })}
    ${path('M148 252 C222 250 270 232 292 204 C308 184 322 166 342 146', { stroke: C.blue, width: 4 })}
    ${path('M386 204 C416 206 450 216 538 260', { stroke: C.red, width: 4 })}
    ${line(430, 112, 430, 286, { stroke: C.green, width: 2, dash: '8 6' })}
    ${line(506, 112, 506, 286, { stroke: C.yellow, width: 2, dash: '8 6' })}
    ${line(574, 112, 574, 286, { stroke: C.red, width: 2, dash: '8 6' })}
    ${text(430, 104, 'V_RWM', { fill: C.green, size: 13 })}
    ${text(506, 104, 'V_BR', { fill: C.yellow, size: 13 })}
    ${text(574, 104, 'V_C', { fill: C.red, size: 13 })}
    ${text(502, 242, 'clamps surge current', { fill: C.red, size: 15 })}
  `
  return frame(720, 360, title, body)
}

function renderBuckIcBlock({ title }) {
  const body = `
    ${rect(84, 94, 230, 184, { fill: C.panel2, stroke: C.teal })}
    ${text(199, 126, 'Synchronous Buck IC', { size: 18, weight: 800 })}
    ${rect(132, 150, 80, 38, { fill: C.panel, stroke: C.blue })}
    ${text(172, 174, 'HS FET', { size: 12 })}
    ${rect(132, 212, 80, 38, { fill: C.panel, stroke: C.blue })}
    ${text(172, 236, 'LS FET', { size: 12 })}
    ${line(314, 190, 390, 190, { stroke: C.yellow, width: 4 })}
    ${text(350, 176, 'SW', { fill: C.yellow, size: 14 })}
    ${path('M390 190 C410 162 432 218 454 190 C476 162 498 218 520 190', { stroke: C.fg, width: 4 })}
    ${line(520, 190, 620, 190, { stroke: C.fg, width: 3 })}
    ${text(632, 195, 'VOUT', { fill: C.green, size: 16, anchor: 'start' })}
    ${line(566, 190, 566, 248, { stroke: C.fg, width: 3 })}
    ${line(546, 248, 586, 248, { stroke: C.blue, width: 4 })}
    ${line(546, 262, 586, 262, { stroke: C.blue, width: 4 })}
    ${line(84, 168, 38, 168, { stroke: C.green, width: 3 })}
    ${text(34, 172, 'VIN', { fill: C.green, size: 15, anchor: 'end' })}
    ${line(314, 246, 370, 246, { stroke: C.green, width: 3 })}
    ${text(378, 251, 'PG', { fill: C.green, size: 14, anchor: 'start' })}
  `
  return frame(720, 330, title, body)
}

function renderSmdResistorPackages({ title }) {
  const body = `
    ${rect(84, 132, 92, 46, { fill: C.panel2, stroke: C.teal })}
    ${rect(266, 120, 126, 58, { fill: C.panel2, stroke: C.teal })}
    ${rect(492, 104, 164, 74, { fill: C.panel2, stroke: C.teal })}
    ${text(130, 208, '0402', { size: 18, weight: 800 })}
    ${text(329, 208, '0603', { size: 18, weight: 800 })}
    ${text(574, 208, '0805', { size: 18, weight: 800 })}
    ${text(130, 236, '1/16 W', { fill: C.yellow, size: 15 })}
    ${text(329, 236, '1/10 W', { fill: C.yellow, size: 15 })}
    ${text(574, 236, '1/8 W', { fill: C.yellow, size: 15 })}
    ${path('M90 270 L648 270', { stroke: C.dim, width: 2 })}
    ${text(370, 304, 'Power rating tracks physical size and heat spreading.', { fill: C.muted, size: 16 })}
  `
  return frame(740, 340, title, body)
}

function renderMosfetCharacteristics({ title }) {
  const curves = [
    { y: 238, color: C.blue, label: 'VGS = 3 V' },
    { y: 208, color: C.teal, label: 'VGS = 4 V' },
    { y: 176, color: C.green, label: 'VGS = 5 V' },
    { y: 142, color: C.yellow, label: 'VGS = 6 V' },
  ].map(({ y, color, label }, i) => `
    ${path(`M124 270 C160 264 190 ${y + 18} 284 ${y} C390 ${y - i * 2} 494 ${y - i * 4} 590 ${y - i * 6}`, { stroke: color, width: 3 })}
    ${text(596, y - i * 6 + 4, label, { fill: color, size: 12, anchor: 'start', weight: 700 })}
  `).join('')
  const body = `
    ${rect(64, 82, 596, 268)}
    ${line(118, 270, 624, 270, { stroke: C.fg, width: 2, arrow: true })}
    ${line(118, 270, 118, 106, { stroke: C.fg, width: 2, arrow: true })}
    ${curves}
    ${path('M126 265 L586 265', { stroke: C.blue, width: 5 })}
    ${line(220, 320, 160, 270, { stroke: C.blue, width: 2, arrow: 'blue' })}
    ${path('M148 258 C190 224 228 174 270 112', { stroke: C.red, width: 2, dash: '7 6' })}
    ${text(188, 120, 'Triode / Ohmic', { fill: C.red, size: 14, weight: 700 })}
    ${text(448, 118, 'Saturation', { fill: C.yellow, size: 15, weight: 700 })}
    ${text(430, 294, 'VDS (drain-to-source voltage)', { fill: C.muted, size: 14 })}
    ${text(78, 190, 'ID', { fill: C.muted, size: 16, weight: 800 })}
    ${text(220, 340, 'Cutoff: VGS < VTH, so ID = 0', { fill: C.blue, size: 14, weight: 800 })}
  `
  return frame(720, 380, title, body)
}

function renderMosfetSymbols({ title }) {
  const card = (cx, kind) => {
    const nmos = kind === 'nmos'
    const accent = nmos ? '#2563eb' : '#db2777'
    return `
      ${rect(cx - 148, 76, 296, 310, { fill: '#f8fafc', stroke: '#cbd5e1', strokeWidth: 2, rx: 8 })}
      ${text(cx, 112, nmos ? 'N-channel MOSFET' : 'P-channel MOSFET', { fill: '#111827', size: 21, weight: 800 })}
      ${mosfetSchematicSymbol(cx - 8, 220, { kind, sourceAtTop: !nmos, scale: 1.35 })}
      ${text(cx, 336, nmos ? 'Source normally toward GND' : 'Source normally toward +V', { fill: '#475569', size: 14, weight: 700 })}
      ${text(cx, 362, nmos ? 'VGS positive -> ON' : 'VGS negative -> ON', { fill: accent, size: 16, weight: 800 })}
    `
  }
  return lightFrame(760, 430, title, `${card(200, 'nmos')}${card(560, 'pmos')}`)
}

function mosfetSchematicSymbol(cx, cy, options = {}) {
  const kind = options.kind ?? 'nmos'
  const sourceAtTop = options.sourceAtTop ?? kind === 'pmos'
  const scale = options.scale ?? 1
  const gateBubble = kind === 'pmos'
    ? '<circle cx="-20" cy="0" r="7" fill="#ffffff" stroke="#db2777" stroke-width="2.5"/>'
    : ''
  const gateLeadEnd = kind === 'pmos' ? -27 : -14
  const nmosArrow = options.flipArrow
    ? '<polygon points="17,8 29,1 29,15" fill="#2563eb"/>'
    : '<polygon points="39,8 27,1 27,15" fill="#2563eb"/>'
  const arrow = kind === 'nmos'
    ? nmosArrow
    : '<polygon points="17,8 29,1 29,15" fill="#db2777"/>'
  const bodyTie = sourceAtTop
    ? '<path d="M40 8 H46 V-28" fill="none" stroke="#111827" stroke-width="2.5"/>'
    : '<path d="M40 8 H46 V28" fill="none" stroke="#111827" stroke-width="2.5"/>'
  const topLabel = sourceAtTop ? 'S' : 'D'
  const bottomLabel = sourceAtTop ? 'D' : 'S'
  const labels = options.showLabels === false ? '' : `
    <text x="57" y="-45" fill="#475569" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700">${topLabel}</text>
    <text x="57" y="52" fill="#475569" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700">${bottomLabel}</text>
    <text x="-70" y="-8" fill="#475569" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700">G</text>`
  return `<g transform="translate(${cx} ${cy}) scale(${scale})">
    <line x1="46" y1="-60" x2="46" y2="-28" stroke="#111827" stroke-width="3"/>
    <line x1="16" y1="-28" x2="46" y2="-28" stroke="#111827" stroke-width="3"/>
    <line x1="46" y1="28" x2="46" y2="60" stroke="#111827" stroke-width="3"/>
    <line x1="16" y1="28" x2="46" y2="28" stroke="#111827" stroke-width="3"/>
    <line x1="16" y1="-34" x2="16" y2="-13" stroke="#111827" stroke-width="4"/>
    <line x1="16" y1="-9" x2="16" y2="9" stroke="#111827" stroke-width="4"/>
    <line x1="16" y1="13" x2="16" y2="34" stroke="#111827" stroke-width="4"/>
    <line x1="-8" y1="-38" x2="-8" y2="38" stroke="#111827" stroke-width="3"/>
    <line x1="-60" y1="0" x2="${gateLeadEnd}" y2="0" stroke="#111827" stroke-width="3"/>
    ${gateBubble}
    <line x1="16" y1="8" x2="40" y2="8" stroke="#111827" stroke-width="2.5"/>
    ${bodyTie}
    ${arrow}
    ${labels}
  </g>`
}

function renderPnDiodeIv({ title }) {
  const body = `
    ${rect(58, 72, 664, 326, { fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 2, rx: 8 })}
    ${line(112, 228, 686, 228, { stroke: '#111827', width: 2, arrow: true })}
    ${line(430, 360, 430, 96, { stroke: '#111827', width: 2, arrow: true })}
    ${text(684, 254, 'Voltage (V)', { fill: '#111827', size: 15, anchor: 'end', weight: 700 })}
    ${text(448, 108, 'Current (I)', { fill: '#111827', size: 15, anchor: 'start', weight: 700 })}
    ${path('M430 228 C500 228 540 226 564 214 C586 202 600 166 614 112', { stroke: '#dc2626', width: 4 })}
    ${path('M430 230 C334 230 254 232 190 234 C166 238 154 276 146 350', { stroke: '#2563eb', width: 4 })}
    ${line(570, 206, 570, 246, { stroke: '#dc2626', width: 2, dash: '5 4' })}
    ${line(150, 214, 150, 362, { stroke: '#2563eb', width: 2, dash: '5 4' })}
    ${text(570, 268, 'VF ~ +0.7 V', { fill: '#dc2626', size: 14, weight: 800 })}
    ${text(150, 204, '-VBR', { fill: '#2563eb', size: 14, weight: 800 })}
    ${text(526, 126, 'Forward conduction', { fill: '#dc2626', size: 15, weight: 800 })}
    ${text(188, 382, 'Reverse breakdown', { fill: '#2563eb', size: 15, weight: 800 })}
    ${text(286, 218, 'small reverse leakage', { fill: '#64748b', size: 12 })}
  `
  return lightFrame(780, 430, title, body)
}

function renderZenerGateClampQuestion({ title }) {
  return renderZenerGateClamp({ title, reveal: false })
}

function renderZenerGateClampAnswer({ title }) {
  return renderZenerGateClamp({ title, reveal: true })
}

function renderZenerGateClamp({ title, reveal }) {
  const branch = reveal ? `
    ${line(462, 190, 462, 220, { stroke: '#111827', width: 3 })}
    ${path('M438 220 L452 226 L472 220 L486 226', { stroke: '#0f766e', width: 4 })}
    ${path('M438 258 L486 258 L462 228 Z', { fill: '#ffffff', stroke: '#0f766e', width: 3 })}
    ${line(462, 258, 462, 304, { stroke: '#111827', width: 3 })}
    ${text(510, 244, '5.1 V Zener', { fill: '#0f766e', size: 16, anchor: 'start', weight: 800 })}
  ` : `
    ${line(462, 190, 462, 212, { stroke: '#111827', width: 3 })}
    ${rect(394, 212, 136, 82, { fill: '#f8fafc', stroke: '#64748b', strokeWidth: 2, rx: 6, dash: '7 5' })}
    ${text(462, 248, 'BLACK BOX', { fill: '#111827', size: 15, weight: 800 })}
    ${text(462, 272, '?', { fill: '#dc2626', size: 24, weight: 800 })}
    ${line(462, 294, 462, 304, { stroke: '#111827', width: 3 })}
  `
  const body = `
    ${text(68, 166, '5-12 V signal', { fill: '#2563eb', size: 16, anchor: 'start', weight: 800 })}
    ${line(68, 190, 150, 190, { stroke: '#111827', width: 3 })}
    ${zigzagResistor(150, 190, 250, 190, '#111827')}
    ${text(200, 220, 'R1 limits IZ', { fill: '#475569', size: 14, weight: 700 })}
    ${line(250, 190, 630, 190, { stroke: '#111827', width: 3 })}
    ${circle(462, 190, 5, { fill: '#0f766e', stroke: '#0f766e' })}
    ${text(474, 174, reveal ? 'clamped to 5.1 V' : 'gate node', { fill: '#0f766e', size: 14, anchor: 'start', weight: 800 })}
    ${mosfetSchematicSymbol(690, 190, { kind: 'nmos', sourceAtTop: false, scale: 1 })}
    ${line(736, 250, 736, 270, { stroke: '#111827', width: 3 })}
    ${schematicGround(736, 270, '#111827')}
    ${text(744, 120, 'D to controlled load', { fill: '#475569', size: 12, anchor: 'middle', weight: 700 })}
    ${text(690, 324, 'Sensitive NMOS: |VGS|max = 8 V', { fill: '#dc2626', size: 13, weight: 800 })}
    ${branch}
    ${schematicGround(462, 304, '#111827')}
    ${reveal ? text(390, 374, 'VIN > 5.1 V: Zener conducts and holds the gate near 5.1 V', { fill: '#0f766e', size: 16, weight: 800 }) : text(390, 374, 'Choose a component that protects the 8 V maximum gate rating', { fill: '#475569', size: 16, weight: 700 })}
  `
  return lightFrame(820, 420, title, body)
}

function renderPmosHighSideDriver({ title }) {
  const body = `
    ${text(446, 68, '+12 V', { fill: '#dc2626', size: 18, weight: 800 })}
    ${line(246, 78, 446, 78, { stroke: '#dc2626', width: 3 })}
    ${line(446, 78, 446, 90, { stroke: '#dc2626', width: 3 })}
    ${mosfetSchematicSymbol(400, 150, { kind: 'pmos', sourceAtTop: true, scale: 1 })}
    ${text(480, 130, 'PMOS', { fill: '#db2777', size: 14, anchor: 'start', weight: 800 })}
    ${line(446, 210, 446, 232, { stroke: '#111827', width: 3 })}
    ${rect(398, 232, 96, 42, { fill: '#fff7ed', stroke: '#f59e0b', strokeWidth: 2, rx: 5 })}
    ${text(446, 258, '12 V LOAD', { fill: '#111827', size: 14, weight: 800 })}
    ${line(446, 274, 446, 302, { stroke: '#111827', width: 3 })}
    ${schematicGround(446, 302, '#111827')}

    ${line(246, 150, 340, 150, { stroke: '#111827', width: 3 })}
    ${circle(246, 150, 5, { fill: '#0f766e', stroke: '#0f766e' })}
    ${zigzagResistor(246, 78, 246, 150, '#111827')}
    ${text(220, 112, 'RPU', { fill: '#0f766e', size: 14, weight: 800 })}
    ${text(276, 172, 'PMOS gate', { fill: '#0f766e', size: 12, weight: 700 })}
    ${line(246, 150, 246, 200, { stroke: '#111827', width: 3 })}
    ${mosfetSchematicSymbol(200, 260, { kind: 'nmos', sourceAtTop: false, scale: 1 })}
    ${line(246, 320, 246, 328, { stroke: '#111827', width: 3 })}
    ${schematicGround(246, 328, '#111827')}
    ${text(200, 368, 'low-side NMOS level shifter', { fill: '#2563eb', size: 13, weight: 800 })}
    ${rect(30, 232, 110, 56, { fill: '#eff6ff', stroke: '#2563eb', strokeWidth: 2, rx: 6 })}
    ${text(85, 255, 'MCU GPIO', { fill: '#1d4ed8', size: 14, weight: 800 })}
    ${text(85, 277, '0 / 3.3 V', { fill: '#1d4ed8', size: 13, weight: 700 })}

    ${rect(548, 92, 244, 238, { fill: '#f8fafc', stroke: '#cbd5e1', strokeWidth: 2, rx: 7 })}
    ${text(670, 124, 'What each GPIO state does', { fill: '#111827', size: 17, weight: 800 })}
    ${text(570, 160, 'GPIO LOW', { fill: '#2563eb', size: 14, anchor: 'start', weight: 800 })}
    ${text(570, 184, 'NMOS is OFF', { fill: '#475569', size: 13, anchor: 'start' })}
    ${text(570, 206, 'RPU raises PMOS gate to +12 V', { fill: '#475569', size: 13, anchor: 'start' })}
    ${text(570, 228, 'VGS = 0 V -> PMOS and load OFF', { fill: '#db2777', size: 13, anchor: 'start', weight: 800 })}
    ${text(570, 266, 'GPIO HIGH', { fill: '#2563eb', size: 14, anchor: 'start', weight: 800 })}
    ${text(570, 290, 'NMOS pulls PMOS gate near 0 V', { fill: '#475569', size: 13, anchor: 'start' })}
    ${text(570, 312, 'VGS < 0 V -> PMOS and load ON', { fill: '#db2777', size: 13, anchor: 'start', weight: 800 })}
  `
  return lightFrame(840, 400, title, body)
}

function renderTlOpen20Source({ title }) {
  return renderTlOpenSource({
    title,
    sourceResistance: '20Ω',
    launchVoltage: '0.714 V',
    receiverVoltage: '1.428 V',
    sourceGamma: 'ΓS = -0.428',
    returnVoltage: '-0.306 V',
    footer: 'Open load doubles the first wave; low source impedance reflects some energy back.',
  })
}

function renderTlOpen50Source({ title }) {
  return renderTlOpenSource({
    title,
    sourceResistance: '50Ω',
    launchVoltage: '0.5 V',
    receiverVoltage: '1.0 V',
    sourceGamma: 'ΓS = 0',
    returnVoltage: 'absorbed',
    footer: 'Source termination absorbs the returning wave and stops secondary ringing.',
  })
}

function renderTlOpenSource({ title, sourceResistance, launchVoltage, receiverVoltage, sourceGamma, returnVoltage, footer }) {
  const body = `
    ${text(72, 120, '1 V step', { fill: C.green, size: 16, anchor: 'start' })}
    ${line(70, 150, 120, 150, { stroke: C.green, width: 4, arrow: 'teal' })}
    ${resistorH(120, 150, 220, sourceResistance)}
    ${rect(258, 104, 258, 92, { fill: C.panel2, stroke: C.teal })}
    ${text(387, 143, 'Transmission line', { size: 18, weight: 800 })}
    ${text(387, 170, 'Z0 = 50Ω', { fill: C.teal, size: 16 })}
    ${line(220, 150, 258, 150, { stroke: C.fg, width: 3 })}
    ${line(516, 150, 610, 150, { stroke: C.fg, width: 3 })}
    ${line(610, 124, 610, 176, { stroke: C.red, width: 3 })}
    ${text(610, 106, '1 MΩ open', { fill: C.red, size: 15 })}
    ${line(292, 226, 486, 226, { stroke: C.yellow, width: 4, arrow: true })}
    ${text(389, 216, `launch ${launchVoltage}`, { fill: C.yellow, size: 14 })}
    ${line(486, 256, 292, 256, { stroke: C.orange, width: 4, arrow: true })}
    ${text(389, 282, `return ${returnVoltage}`, { fill: C.orange, size: 14 })}
    ${rect(544, 214, 122, 58, { fill: '#101827', stroke: C.red })}
    ${text(605, 236, 'ΓL ≈ +1', { fill: C.red, size: 15, weight: 800 })}
    ${text(605, 258, `Vrx = ${receiverVoltage}`, { fill: C.green, size: 14 })}
    ${rect(76, 220, 134, 58, { fill: '#101827', stroke: C.blue })}
    ${text(143, 242, sourceGamma, { fill: C.blue, size: 15, weight: 800 })}
    ${text(143, 264, `source ${sourceResistance}`, { fill: C.muted, size: 13 })}
    ${text(370, 326, footer, { fill: C.muted, size: 14 })}
  `
  return frame(740, 360, title, body)
}

function renderSParamsForward({ title }) {
  return renderSParameterMatrix({ title, mode: 'forward' })
}

function renderSParamsReverse({ title }) {
  return renderSParameterMatrix({ title, mode: 'reverse' })
}

function renderSParameterMatrix({ title, mode }) {
  const forward = mode === 'forward'
  const accent = forward ? '#ef4444' : '#0ea5a5'
  const secondary = forward ? '#0ea5a5' : '#ef4444'
  const body = `
    ${rect(144, 96, 532, 236, { fill: '#4599c8', stroke: '#4599c8', rx: 0 })}
    ${line(66, 142, 144, 142, { stroke: '#4599c8', width: 5 })}
    ${line(66, 282, 144, 282, { stroke: '#4599c8', width: 5 })}
    ${line(676, 142, 754, 142, { stroke: '#4599c8', width: 5 })}
    ${line(676, 282, 754, 282, { stroke: '#4599c8', width: 5 })}
    ${circle(66, 142, 10, { fill: '#4599c8', stroke: '#4599c8' })}
    ${circle(66, 282, 10, { fill: '#4599c8', stroke: '#4599c8' })}
    ${circle(754, 142, 10, { fill: '#4599c8', stroke: '#4599c8' })}
    ${circle(754, 282, 10, { fill: '#4599c8', stroke: '#4599c8' })}
    ${path('M14 110 L108 110', { stroke: '#4b5563', width: 3, arrow: 'gray' })}
    ${path('M108 314 L14 314', { stroke: '#4b5563', width: 3, arrow: 'gray' })}
    ${path('M708 110 L802 110', { stroke: '#4b5563', width: 3, arrow: 'gray' })}
    ${path('M802 314 L708 314', { stroke: '#4b5563', width: 3, arrow: 'gray' })}
    ${text(84, 94, 'a1', { fill: '#4b5563', size: 24, weight: 800 })}
    ${text(84, 354, 'b1', { fill: '#4b5563', size: 24, weight: 800 })}
    ${text(724, 94, 'b2', { fill: '#4b5563', size: 24, weight: 800 })}
    ${text(724, 354, 'a2', { fill: '#4b5563', size: 24, weight: 800 })}
    ${path('M356 142 L560 142', { stroke: accent, width: 4, arrow: forward ? 'red' : 'teal' })}
    ${text(460, 124, 'S21', { fill: accent, size: 27, weight: 800 })}
    ${path('M560 282 L356 282', { stroke: secondary, width: 4, arrow: forward ? 'teal' : 'red' })}
    ${text(460, 318, 'S12', { fill: secondary, size: 27, weight: 800 })}
    ${path('M170 150 C208 176 208 248 170 274', { stroke: forward ? accent : '#ffffff', width: 3, arrow: forward ? 'red' : true })}
    ${text(218, 216, 'S11', { fill: forward ? accent : '#ffffff', size: 25, weight: 800 })}
    ${path('M646 150 C608 176 608 248 646 274', { stroke: forward ? '#ffffff' : accent, width: 3, arrow: forward ? true : 'teal' })}
    ${text(596, 216, 'S22', { fill: forward ? '#ffffff' : accent, size: 25, weight: 800 })}
    ${text(410, 188, '[', { fill: '#ffffff', size: 86, weight: 500 })}
    ${text(560, 188, ']', { fill: '#ffffff', size: 86, weight: 500 })}
    ${text(458, 188, 'S11   S12', { fill: '#ffffff', size: 24, weight: 800 })}
    ${text(458, 246, 'S21   S22', { fill: '#ffffff', size: 24, weight: 800 })}
    ${text(410, 386, forward ? 'Forward view: drive Port 1; S11 reflects, S21 transmits.' : 'Reverse view: drive Port 2; S22 reflects, S12 transmits backward.', { fill: '#374151', size: 20, weight: 800 })}
  `
  return lightFrame(820, 430, title, body)
}

function renderTlLcLadder({ title }) {
  const nodes = Array.from({ length: 8 }, (_, i) => 224 + i * 78)
  const inductors = nodes.map((x, i) => `
    ${path(`M${x - 56} 122 C${x - 47} 104 ${x - 37} 140 ${x - 28} 122 C${x - 19} 104 ${x - 9} 140 ${x} 122`, { stroke: '#1d4ed8', width: 2 })}
    ${text(x - 28, 96, `L${i + 1}`, { fill: '#111827', size: 14, weight: 700 })}
  `).join('')
  const capacitors = nodes.map((x, i) => `
    ${circle(x, 122, 3, { fill: '#1d4ed8', stroke: '#1d4ed8' })}
    ${line(x, 122, x, 152, { stroke: '#1d4ed8', width: 2 })}
    ${line(x - 13, 152, x + 13, 152, { stroke: '#1d4ed8', width: 2 })}
    ${line(x - 13, 162, x + 13, 162, { stroke: '#1d4ed8', width: 2 })}
    ${line(x, 162, x, 188, { stroke: '#1d4ed8', width: 2 })}
    ${schematicGround(x, 188, '#1d4ed8')}
    ${text(x + 14, 150, `C${i + 1}`, { fill: '#111827', size: 13, anchor: 'start' })}
  `).join('')
  const body = `
    ${sourceSymbol(42, 122, '#1d4ed8')}
    ${text(60, 111, 'Vsource', { fill: '#111827', size: 13, weight: 700, anchor: 'start' })}
    ${line(60, 122, 94, 122, { stroke: '#1d4ed8', width: 2 })}
    ${zigzagResistor(94, 122, 154, 122, '#111827')}
    ${text(124, 92, 'R1', { fill: '#111827', size: 13, weight: 700 })}
    ${line(154, 122, 168, 122, { stroke: '#1d4ed8', width: 2 })}
    ${rect(168, 58, 672, 154, { fill: 'none', stroke: '#1d4ed8', strokeWidth: 1, rx: 0, dash: '4 4' })}
    ${text(504, 42, 'Transmission Line: overall impedance Z0', { fill: '#1d4ed8', size: 14, weight: 700 })}
    ${inductors}
    ${capacitors}
    ${line(840, 122, 872, 122, { stroke: '#1d4ed8', width: 2 })}
    ${zigzagResistor(872, 122, 872, 188, '#111827')}
    ${text(892, 148, 'R2', { fill: '#111827', size: 13, weight: 700, anchor: 'start' })}
    ${schematicGround(872, 188, '#1d4ed8')}
    ${text(124, 226, 'source resistance', { fill: '#4b5563', size: 12 })}
    ${text(872, 226, 'load impedance', { fill: '#4b5563', size: 12 })}
  `
  return lightFrame(940, 250, title, body, { showTitle: false })
}

function renderTlZ0Fields({ title }) {
  const body = `
    ${rect(58, 88, 246, 220)}
    ${text(181, 140, 'Z0 = √(L / C)', { fill: C.fg, size: 27, weight: 800 })}
    ${text(181, 184, 'L from magnetic field', { fill: C.yellow, size: 15 })}
    ${text(181, 214, 'C from electric field', { fill: C.blue, size: 15 })}
    ${rect(384, 126, 204, 30, { fill: C.orange, stroke: C.orange, rx: 4 })}
    ${text(486, 148, 'PCB trace', { fill: '#111827', size: 15, weight: 800 })}
    ${rect(344, 254, 284, 20, { fill: C.dim, stroke: C.dim, rx: 2 })}
    ${text(486, 300, 'ground plane', { fill: C.muted, size: 14 })}
    ${path('M400 170 C430 210 454 210 486 170 C518 210 542 210 574 170', { stroke: C.yellow, width: 3 })}
    ${line(420, 160, 420, 246, { stroke: C.blue, width: 2, dash: '6 5' })}
    ${line(486, 160, 486, 246, { stroke: C.blue, width: 2, dash: '6 5' })}
    ${line(552, 160, 552, 246, { stroke: C.blue, width: 2, dash: '6 5' })}
    ${text(486, 104, 'geometry sets L and C', { fill: C.teal, size: 17, weight: 700 })}
  `
  return frame(700, 340, title, body)
}

function renderPcbTraceGeometry({ title }) {
  const body = `
    ${rect(62, 98, 594, 170, { fill: '#143029', stroke: C.teal })}
    ${path('M170 184 L480 142 L560 176 L248 222 Z', { fill: C.orange, stroke: C.yellow, width: 3 })}
    ${line(248, 234, 560, 188, { stroke: C.green, width: 3, arrow: 'teal' })}
    ${text(410, 246, 'Length ↑', { fill: C.green, size: 16 })}
    ${line(492, 128, 560, 158, { stroke: C.blue, width: 3, arrow: 'teal' })}
    ${text(570, 154, 'Width ↑', { fill: C.blue, size: 16, anchor: 'start' })}
    ${rect(82, 286, 254, 44, { fill: C.panel, stroke: C.blue })}
    ${text(209, 313, 'Wider trace = ↑C, ↓L, ↓R', { fill: C.blue, size: 16, weight: 700 })}
    ${rect(370, 286, 270, 44, { fill: C.panel, stroke: C.green })}
    ${text(505, 313, 'Longer trace = ↑C, ↑L, ↑R', { fill: C.green, size: 16, weight: 700 })}
  `
  return frame(720, 370, title, body)
}

function renderPcbTraceCapacitance({ title }) {
  const body = `
    ${text(360, 92, 'C = εA / d', { fill: C.fg, size: 28, weight: 800 })}
    ${rect(72, 126, 244, 176, { fill: C.panel, stroke: C.blue })}
    ${rect(126, 154, 136, 24, { fill: C.orange, stroke: C.yellow, rx: 4 })}
    ${rect(104, 222, 180, 18, { fill: C.dim, stroke: C.dim, rx: 2 })}
    ${line(194, 178, 194, 222, { stroke: C.blue, width: 3, dash: '5 5' })}
    ${text(194, 324, 'small d = high C', { fill: C.blue, size: 17, weight: 800 })}
    ${rect(404, 126, 244, 176, { fill: C.panel, stroke: C.yellow })}
    ${rect(458, 148, 136, 24, { fill: C.orange, stroke: C.yellow, rx: 4 })}
    ${rect(436, 260, 180, 18, { fill: C.dim, stroke: C.dim, rx: 2 })}
    ${line(526, 172, 526, 260, { stroke: C.yellow, width: 3, dash: '5 5' })}
    ${text(526, 324, 'large d = low C', { fill: C.yellow, size: 17, weight: 800 })}
  `
  return frame(720, 350, title, body)
}

function renderPcbReturnPlane({ title }) {
  const body = `
    ${rect(52, 92, 292, 214, { fill: C.panel, stroke: C.green })}
    ${text(198, 124, 'Solid reference plane', { fill: C.green, size: 16, weight: 800 })}
    ${rect(84, 210, 228, 48, { fill: C.dim, stroke: C.dim, rx: 4 })}
    ${line(92, 174, 306, 174, { stroke: C.orange, width: 7, arrow: 'teal' })}
    ${path('M96 226 C152 198 248 198 306 226', { stroke: C.teal, width: 4 })}
    ${text(198, 282, 'return current follows underneath', { fill: C.muted, size: 13 })}
    ${rect(396, 92, 292, 214, { fill: C.panel, stroke: C.red })}
    ${text(542, 124, 'Split plane', { fill: C.red, size: 16, weight: 800 })}
    ${rect(428, 210, 86, 48, { fill: C.dim, stroke: C.dim, rx: 4 })}
    ${rect(574, 210, 82, 48, { fill: C.dim, stroke: C.dim, rx: 4 })}
    ${line(436, 174, 648, 174, { stroke: C.orange, width: 7, arrow: 'teal' })}
    ${path('M438 226 C458 292 628 292 650 226', { stroke: C.red, width: 4 })}
    ${text(542, 282, 'detour creates loop area and EMI', { fill: C.red, size: 13 })}
  `
  return frame(740, 340, title, body)
}

function renderPcbReturnVia({ title }) {
  const panel = (y, stroke, heading, headingFill) => `
    ${rect(40, y, 740, 150, { fill: '#ffffff', stroke, strokeWidth: 2, rx: 6 })}
    ${text(58, y + 24, heading, { fill: headingFill, size: 16, weight: 800, anchor: 'start' })}
    ${line(86, y + 58, 680, y + 58, { stroke: '#0ea5e9', width: 3 })}
    ${line(86, y + 108, 680, y + 108, { stroke: '#0ea5e9', width: 3 })}
    ${text(704, y + 62, 'GND plane A', { fill: '#111827', size: 12, anchor: 'start' })}
    ${text(704, y + 112, 'GND plane B', { fill: '#111827', size: 12, anchor: 'start' })}
    ${path(`M96 ${y + 38} L330 ${y + 38} L330 ${y + 88} L680 ${y + 88}`, { stroke: '#f97316', width: 8 })}
    ${line(330, y + 38, 330, y + 88, { stroke: '#f97316', width: 10 })}
    ${text(352, y + 68, 'signal via', { fill: '#f97316', size: 12, anchor: 'start' })}
  `
  const body = `
    ${panel(70, '#22c55e', 'Case 1: nearby GND stitching via exists', '#16a34a')}
    ${line(258, 128, 258, 178, { stroke: '#22c55e', width: 8 })}
    ${circle(258, 128, 7, { fill: '#22c55e', stroke: '#22c55e' })}
    ${circle(258, 178, 7, { fill: '#22c55e', stroke: '#22c55e' })}
    ${text(218, 198, 'GND stitching via', { fill: '#16a34a', size: 12, anchor: 'start' })}
    ${path('M118 128 L238 128 L258 178 L646 178', { stroke: '#0f766e', width: 4, arrow: 'teal' })}
    ${text(506, 202, 'return current crosses planes through the GND via', { fill: '#0f766e', size: 12 })}

    ${panel(250, '#ef4444', 'Case 2: no nearby GND stitching via', '#dc2626')}
    ${path('M118 308 L238 308', { stroke: '#0f766e', width: 4, arrow: 'teal' })}
    ${line(222, 326, 270, 374, { stroke: '#ef4444', width: 5 })}
    ${line(270, 326, 222, 374, { stroke: '#ef4444', width: 5 })}
    ${text(246, 392, 'no return via here', { fill: '#dc2626', size: 12 })}
    ${path('M292 308 C388 248 516 254 650 348', { stroke: '#dc2626', width: 4, dash: '8 7', arrow: 'red' })}
    ${text(498, 392, 'return path is interrupted or forced into a large detour', { fill: '#dc2626', size: 12 })}
  `
  return lightFrame(820, 430, title, body)
}

function renderPcbMicrostripStripline({ title }) {
  const body = `
    ${rect(46, 82, 376, 286, { fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 2, rx: 8 })}
    ${text(234, 118, 'Microstrip', { fill: '#111827', size: 22, weight: 800 })}
    ${rect(86, 162, 296, 126, { fill: '#dbeafe', stroke: '#93c5fd', strokeWidth: 2, rx: 0 })}
    ${text(234, 228, 'FR4 dielectric', { fill: '#1e3a8a', size: 14, weight: 700 })}
    ${rect(156, 144, 156, 20, { fill: '#f97316', stroke: '#9a3412', strokeWidth: 2, rx: 2 })}
    ${text(234, 139, 'surface signal trace', { fill: '#9a3412', size: 12, weight: 700 })}
    ${rect(106, 288, 256, 24, { fill: '#475569', stroke: '#1f2937', strokeWidth: 2, rx: 2 })}
    ${text(234, 328, 'single reference plane below', { fill: '#334155', size: 13, weight: 700 })}
    ${path('M184 166 C178 198 168 230 154 286', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M234 166 C234 202 234 236 234 286', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M284 166 C290 198 300 230 314 286', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${text(234, 358, 'Fields partly in air, partly in dielectric', { fill: '#0f766e', size: 13, weight: 700 })}

    ${rect(478, 82, 376, 286, { fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 2, rx: 8 })}
    ${text(666, 118, 'Stripline', { fill: '#111827', size: 22, weight: 800 })}
    ${rect(518, 148, 296, 168, { fill: '#dbeafe', stroke: '#93c5fd', strokeWidth: 2, rx: 0 })}
    ${rect(538, 140, 256, 22, { fill: '#475569', stroke: '#1f2937', strokeWidth: 2, rx: 2 })}
    ${rect(538, 302, 256, 22, { fill: '#475569', stroke: '#1f2937', strokeWidth: 2, rx: 2 })}
    ${rect(602, 222, 128, 20, { fill: '#f97316', stroke: '#9a3412', strokeWidth: 2, rx: 2 })}
    ${text(666, 215, 'buried signal trace', { fill: '#9a3412', size: 12, weight: 700 })}
    ${text(666, 176, 'top reference plane', { fill: '#334155', size: 12, weight: 700 })}
    ${text(666, 346, 'bottom reference plane', { fill: '#334155', size: 12, weight: 700 })}
    ${path('M628 220 C618 198 610 178 604 164', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M666 220 C666 198 666 178 666 164', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M704 220 C714 198 722 178 728 164', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M628 244 C618 266 610 286 604 300', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M666 244 C666 266 666 286 666 300', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M704 244 C714 266 722 286 728 300', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${text(666, 358, 'Fields enclosed between two planes', { fill: '#0f766e', size: 13, weight: 700 })}
  `
  return lightFrame(900, 400, title, body)
}

function renderPcbMicrostripGcpw({ title }) {
  const body = `
    ${rect(46, 82, 376, 286, { fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 2, rx: 8 })}
    ${text(234, 118, 'Standard Microstrip', { fill: '#111827', size: 21, weight: 800 })}
    ${rect(86, 166, 296, 124, { fill: '#dbeafe', stroke: '#93c5fd', strokeWidth: 2, rx: 0 })}
    ${rect(158, 148, 152, 20, { fill: '#f97316', stroke: '#9a3412', strokeWidth: 2, rx: 2 })}
    ${rect(106, 290, 256, 24, { fill: '#475569', stroke: '#1f2937', strokeWidth: 2, rx: 2 })}
    ${text(234, 144, 'signal trace only on top layer', { fill: '#9a3412', size: 12, weight: 700 })}
    ${text(234, 330, 'bottom reference plane', { fill: '#334155', size: 13, weight: 700 })}
    ${path('M186 170 C172 204 160 242 150 288', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M234 170 C234 210 234 250 234 288', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M282 170 C296 204 308 242 318 288', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${text(234, 358, 'Fields spread from trace to plane', { fill: '#0f766e', size: 13, weight: 700 })}

    ${rect(478, 82, 376, 286, { fill: '#ffffff', stroke: '#cbd5e1', strokeWidth: 2, rx: 8 })}
    ${text(666, 118, 'Grounded CPW', { fill: '#111827', size: 21, weight: 800 })}
    ${rect(518, 166, 296, 124, { fill: '#dbeafe', stroke: '#93c5fd', strokeWidth: 2, rx: 0 })}
    ${rect(538, 148, 96, 20, { fill: '#475569', stroke: '#1f2937', strokeWidth: 2, rx: 2 })}
    ${rect(666, 148, 96, 20, { fill: '#475569', stroke: '#1f2937', strokeWidth: 2, rx: 2 })}
    ${rect(638, 148, 24, 20, { fill: '#f97316', stroke: '#9a3412', strokeWidth: 2, rx: 2 })}
    ${rect(538, 290, 224, 24, { fill: '#475569', stroke: '#1f2937', strokeWidth: 2, rx: 2 })}
    ${text(650, 142, 'same-layer ground pours flank signal', { fill: '#334155', size: 12, weight: 700 })}
    ${text(650, 330, 'solid bottom ground plane', { fill: '#334155', size: 13, weight: 700 })}
    ${text(650, 184, 'gap', { fill: '#64748b', size: 11, weight: 700 })}
    ${line(586, 168, 586, 290, { stroke: '#475569', width: 4, dash: '5 5' })}
    ${line(714, 168, 714, 290, { stroke: '#475569', width: 4, dash: '5 5' })}
    ${circle(586, 190, 5, { fill: '#475569', stroke: '#1f2937' })}
    ${circle(586, 266, 5, { fill: '#475569', stroke: '#1f2937' })}
    ${circle(714, 190, 5, { fill: '#475569', stroke: '#1f2937' })}
    ${circle(714, 266, 5, { fill: '#475569', stroke: '#1f2937' })}
    ${path('M638 170 C624 184 610 196 594 210', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M662 170 C676 184 690 196 706 210', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${path('M650 170 C650 208 650 250 650 288', { stroke: '#0f766e', width: 3, dash: '7 5' })}
    ${text(666, 358, 'Fields are tighter around the surface trace', { fill: '#0f766e', size: 13, weight: 700 })}
  `
  return lightFrame(900, 400, title, body)
}

function renderDifferentialNoiseRejection({ title }) {
  const body = `
    ${rect(56, 86, 628, 236)}
    ${grid(118, 120, 500, 132)}
    ${path('M126 184 C166 132 206 132 246 184 C286 236 326 236 366 184 C406 132 446 132 486 184 C526 236 566 236 606 184', { stroke: C.green, width: 4 })}
    ${path('M126 184 C166 236 206 236 246 184 C286 132 326 132 366 184 C406 236 446 236 486 184 C526 132 566 132 606 184', { stroke: C.blue, width: 4 })}
    ${path('M330 122 L350 252', { stroke: C.red, width: 5 })}
    ${path('M348 122 L368 252', { stroke: C.red, width: 5 })}
    ${text(190, 112, 'D+', { fill: C.green, size: 15 })}
    ${text(190, 270, 'D-', { fill: C.blue, size: 15 })}
    ${text(360, 112, 'common noise', { fill: C.red, size: 15 })}
    ${line(174, 300, 548, 300, { stroke: C.yellow, width: 3, arrow: true })}
    ${text(360, 338, 'Receiver subtracts D+ - D-; common noise cancels', { fill: C.fg, size: 18, weight: 700 })}
  `
  return frame(740, 370, title, body)
}

function renderPcb3WRule({ title }) {
  const body = `
    ${rect(76, 106, 588, 170, { fill: '#143029', stroke: C.teal })}
    ${rect(144, 164, 350, 26, { fill: C.orange, stroke: C.yellow, rx: 5 })}
    ${rect(144, 238, 350, 26, { fill: C.orange, stroke: C.yellow, rx: 5 })}
    ${line(514, 164, 514, 190, { stroke: C.blue, width: 3 })}
    ${line(506, 164, 522, 164, { stroke: C.blue, width: 3 })}
    ${line(506, 190, 522, 190, { stroke: C.blue, width: 3 })}
    ${text(538, 182, 'W', { fill: C.blue, size: 17, anchor: 'start', weight: 800 })}
    ${line(116, 177, 116, 251, { stroke: C.green, width: 3 })}
    ${line(104, 177, 128, 177, { stroke: C.green, width: 3 })}
    ${line(104, 251, 128, 251, { stroke: C.green, width: 3 })}
    ${text(86, 220, '3W', { fill: C.green, size: 20, weight: 800 })}
    ${text(370, 326, 'Keep adjacent high-speed traces at least 3 trace-widths apart.', { fill: C.fg, size: 18, weight: 700 })}
  `
  return frame(740, 360, title, body)
}

function renderUartCrossover({ title }) {
  const wire = (d, color) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="square" stroke-linejoin="miter"/>`
  const device = (x, name) => `
    ${rect(x, 96, 210, 220, { fill: C.panel, stroke: C.dim, rx: 8 })}
    ${text(x + 105, 130, name, { fill: C.fg, size: 21, weight: 800 })}
    ${rect(x + 36, 168, 64, 42, { fill: '#173a52', stroke: C.blue, rx: 5 })}
    ${text(x + 68, 195, 'TX', { fill: C.blue, size: 18, weight: 800 })}
    ${rect(x + 110, 240, 64, 42, { fill: '#123a35', stroke: C.teal, rx: 5 })}
    ${text(x + 142, 267, 'RX', { fill: C.teal, size: 18, weight: 800 })}
  `
  const body = `
    ${device(60, 'Device 1')}
    ${device(470, 'Device 2')}
    ${wire('M160 189 H340 V281 H560 V261 H570', C.blue)}
    ${path('M570 256 L580 261 L570 266 Z', { fill: C.blue, stroke: C.blue, width: 1 })}
    ${wire('M506 189 H400 V241 H254 V261 H244', C.teal)}
    ${path('M244 256 L234 261 L244 266 Z', { fill: C.teal, stroke: C.teal, width: 1 })}
    ${text(268, 181, 'TX1 -> RX2', { fill: C.blue, size: 15, weight: 800 })}
    ${text(472, 181, 'TX2 -> RX1', { fill: C.teal, size: 15, weight: 800 })}
    ${text(370, 342, 'No clock wire: both ends use the same baud rate', { fill: C.yellow, size: 17, weight: 700 })}
    ${text(370, 370, 'Start bit | data bits | optional parity | stop bit', { fill: C.muted, size: 15 })}
  `
  return frame(740, 400, title, body)
}

function renderBhHysteresis({ title }) {
  const body = `
    ${line(88, 230, 662, 230, { stroke: C.fg, width: 2, arrow: true })}
    ${line(370, 354, 370, 82, { stroke: C.fg, width: 2, arrow: true })}
    ${path('M108 326 C174 326 226 312 282 270 C326 238 342 185 370 145 C404 98 474 96 632 96 C554 96 480 109 432 146 C395 175 390 216 370 230 C338 251 302 272 270 295 C226 326 168 326 108 326 Z', { stroke: C.teal, width: 4, fill: 'none' })}
    ${line(250, 230, 250, 295, { stroke: C.blue, width: 2, dash: '6 5' })}
    ${line(370, 145, 432, 145, { stroke: C.blue, width: 2, dash: '6 5' })}
    ${text(646, 252, 'H', { fill: C.fg, size: 20, weight: 800 })}
    ${text(390, 92, 'B', { fill: C.fg, size: 20, weight: 800 })}
    ${text(606, 78, '+ saturation', { fill: C.yellow, size: 16, weight: 800 })}
    ${text(134, 352, '- saturation', { fill: C.yellow, size: 16, weight: 800 })}
    ${text(442, 140, 'remanence Br', { fill: C.blue, size: 14, anchor: 'start' })}
    ${text(238, 218, '-Hc', { fill: C.blue, size: 14 })}
    ${text(370, 390, 'Loop area represents hysteresis energy loss per cycle', { fill: C.muted, size: 15, weight: 700 })}
  `
  return frame(740, 420, title, body)
}

function renderMosfetLevelShifter({ title }) {
  const resistor = (x) => path(`M${x} 104 V116 l-10 8 20 12 -20 12 20 12 -20 12 10 8 V210`, { stroke: '#991b1b', width: 3 })
  const body = `
    ${text(180, 68, '3.3 V', { fill: '#374151', size: 20, weight: 800 })}
    ${text(560, 68, '5 V', { fill: '#374151', size: 20, weight: 800 })}
    ${path('M174 91 L180 82 L186 91 M180 82 V104', { stroke: '#991b1b', width: 3 })}
    ${path('M554 91 L560 82 L566 91 M560 82 V104', { stroke: '#991b1b', width: 3 })}
    ${resistor(180)}
    ${resistor(560)}
    ${text(146, 154, 'R2', { fill: '#4b5563', size: 17, weight: 800 })}
    ${text(146, 176, '10 kΩ', { fill: '#4b5563', size: 15 })}
    ${text(526, 154, 'R3', { fill: '#4b5563', size: 17, weight: 800 })}
    ${text(526, 176, '10 kΩ', { fill: '#4b5563', size: 15 })}
    ${line(72, 210, 326, 210, { stroke: '#166534', width: 4 })}
    ${line(414, 210, 668, 210, { stroke: '#166534', width: 4 })}
    ${circle(180, 210, 5, { fill: '#166534', stroke: '#166534' })}
    ${circle(560, 210, 5, { fill: '#166534', stroke: '#166534' })}
    ${text(108, 201, 'TX - 3.3 V', { fill: '#374151', size: 17, weight: 700 })}
    ${text(628, 201, 'TX - 5 V', { fill: '#374151', size: 17, weight: 700 })}
    ${line(326, 210, 331, 210, { stroke: '#111827', width: 4 })}
    ${line(409, 210, 414, 210, { stroke: '#111827', width: 4 })}
    <g transform="translate(370 180) rotate(90)">
      ${mosfetSchematicSymbol(0, 0, { kind: 'nmos', sourceAtTop: false, scale: 0.65, showLabels: false, flipArrow: true })}
    </g>
    ${path('M338 210 V238 H350 M366 238 H402 V210', { stroke: '#111827', width: 2.5 })}
    ${path('M350 232 L362 238 L350 244 Z', { fill: '#111827', stroke: '#111827', width: 1 })}
    ${line(366, 230, 366, 246, { stroke: '#111827', width: 2.5 })}
    ${path('M180 104 H300 V136 H370 V141', { stroke: '#166534', width: 3 })}
    ${circle(180, 104, 5, { fill: '#166534', stroke: '#166534' })}
    ${text(307, 201, 'U1', { fill: '#4b5563', size: 17, weight: 800 })}
    ${text(370, 264, 'BSS138', { fill: '#4b5563', size: 18, weight: 800 })}
    ${text(370, 318, 'Either side can pull both buses LOW', { fill: '#0f766e', size: 17, weight: 800 })}
    ${text(370, 346, 'HIGH transitions are RC-limited by pull-ups and bus capacitance', { fill: '#92400e', size: 15, weight: 700 })}
  `
  return lightFrame(740, 380, title, body)
}

function renderPromptCard({ title, prompt }) {
  const body = `
    ${rect(70, 92, 560, 210, { fill: C.panel, stroke: C.teal })}
    ${multiline(350, 150, prompt || 'No render spec yet. Edit this image render JSON, then rerun the renderer.', { maxChars: 58, size: 18, lineHeight: 28, fill: C.fg })}
    ${text(350, 280, 'Renderer fallback: prompt card', { fill: C.muted, size: 14 })}
  `
  return frame(700, 340, title, body)
}

function wrapText(value, maxChars) {
  const words = cleanString(value).split(/\s+/)
  const lines = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 6)
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
