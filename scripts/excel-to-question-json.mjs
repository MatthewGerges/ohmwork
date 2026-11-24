#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import readXlsxFile from 'read-excel-file/node'
import {
  ROOT,
  cleanString,
  findImageTokens,
  hashPayload,
  isTruthySelection,
  loadMaterializedFingerprints,
  formatCategories,
  normalizeDifficulty,
  normalizeHeader,
  parseCategories,
  parseResourceVideos,
  parseTags,
  replaceImageMarkers,
  slugify,
} from './question-import-utils.mjs'

const args = parseArgs(process.argv.slice(2))
if (!args.input) {
  console.error('Usage: node scripts/excel-to-question-json.mjs <workbook.xlsx> [--out path/to/questions.generated.json]')
  process.exit(1)
}

const inputPath = resolve(args.input)
const rows = await readWorkbookRows(inputPath)
if (rows.length < 2) {
  throw new Error(`No data rows found in ${inputPath}`)
}

const headers = rows[0].map(normalizeHeader)
const materializedFingerprints = loadMaterializedFingerprints()
const usedSlugs = new Map()
const outputRows = []

rows.slice(1).forEach((row, index) => {
  const raw = Object.fromEntries(headers.map((header, colIndex) => [header, row[colIndex] ?? null]))

  const questionText = replaceImageMarkers(raw.question_text)
  const answerText = replaceImageMarkers(raw.answer_text)
  const explanationText = replaceImageMarkers(raw.explanation_text)
  const bonusQuestionText = replaceImageMarkers(raw.bonus_question_text)
  const bonusAnswerText = replaceImageMarkers(raw.bonus_answer_text)
  const categories = collectCategories(raw)
  const category = formatCategories(categories)

  if (!cleanString(raw.category) && !questionText && !answerText) return
  if (!category || !questionText || !answerText) {
    outputRows.push({
      row_number: index + 2,
      status: 'invalid',
      errors: ['category, question_text, and answer_text are required'],
      raw,
    })
    return
  }

  const imageSpecs = collectImageSpecs(raw, {
    question_text: questionText,
    answer_text: answerText,
    explanation_text: explanationText,
    bonus_question_text: bonusQuestionText,
    bonus_answer_text: bonusAnswerText,
  })

  const fingerprint = hashPayload({
    category,
    difficulty: normalizeDifficulty(raw.difficulty),
    question_text: questionText,
    answer_text: answerText,
    explanation_text: explanationText,
    bonus_question_text: bonusQuestionText,
    bonus_answer_text: bonusAnswerText,
    images: Object.fromEntries(Object.entries(imageSpecs).map(([key, image]) => [key, image.prompt])),
  })

  const baseSlug = slugify(`${category} ${questionText}`)
  const slug = dedupeSlug(baseSlug, usedSlugs)
  const alreadyMaterializedAs = materializedFingerprints.get(fingerprint) ?? null

  outputRows.push({
    row_number: index + 2,
    slug,
    selected: isTruthySelection(raw.use_this),
    status: alreadyMaterializedAs ? 'already_materialized' : 'ready_for_review',
    already_materialized_as: alreadyMaterializedAs,
    source_fingerprint: fingerprint,
    source: {
      workbook: inputPath,
      worksheet: 'first sheet',
      row_number: index + 2,
    },
    question: {
      category,
      categories,
      difficulty: normalizeDifficulty(raw.difficulty),
      question_text: questionText,
      answer_text: answerText,
      explanation_text: explanationText || null,
      bonus_question_text: bonusQuestionText || null,
      bonus_answer_text: bonusAnswerText || null,
      main_video_youtube_id: cleanString(raw.main_video_youtube_id) || null,
      resource_videos: parseResourceVideos(raw.resource_videos),
      ltspice_file_needed: cleanString(raw.ltspice_file_needed) || null,
      tags: parseTags(raw.tags),
    },
    images: imageSpecs,
    notes: cleanString(raw.notes) || null,
  })
})

const batchId = args.batch ?? `${slugify(basename(inputPath, '.xlsx'), 44)}-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)}`
const outputPath = resolve(args.out ?? join(ROOT, 'content', 'imports', batchId, 'questions.generated.json'))
mkdirSync(dirname(outputPath), { recursive: true })

const payload = {
  batch_id: batchId,
  generated_at: new Date().toISOString(),
  source_file: inputPath,
  rows: outputRows,
}

writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`)

const ready = outputRows.filter((row) => row.status === 'ready_for_review').length
const selected = outputRows.filter((row) => row.selected).length
const skipped = outputRows.filter((row) => row.status === 'already_materialized').length
console.log(`Wrote ${outputPath}`)
console.log(`Rows: ${outputRows.length}; ready: ${ready}; selected: ${selected}; already materialized: ${skipped}`)

function parseArgs(argv) {
  const parsed = { input: null, out: null, batch: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--out') parsed.out = argv[++i]
    else if (arg === '--batch') parsed.batch = argv[++i]
    else if (!parsed.input) parsed.input = arg
    else throw new Error(`Unexpected argument: ${arg}`)
  }
  return parsed
}

async function readWorkbookRows(workbookPath) {
  const source = readFileSync(workbookPath)
  try {
    return unwrapParsedRows(await readXlsxFile(source))
  } catch (error) {
    if (!String(error?.message ?? error).includes('Unsupported "inline string" cell value structure')) {
      throw error
    }
    return unwrapParsedRows(await readXlsxFile(cleanEmptyInlineStrings(source)))
  }
}

function unwrapParsedRows(parsed) {
  if (Array.isArray(parsed) && parsed.length === 1 && Array.isArray(parsed[0]?.data)) {
    return parsed[0].data
  }
  return parsed
}

function cleanEmptyInlineStrings(buffer) {
  const files = unzipSync(new Uint8Array(buffer))
  for (const [name, bytes] of Object.entries(files)) {
    if (!name.startsWith('xl/worksheets/') || !name.endsWith('.xml')) continue
    const xml = strFromU8(bytes)
    const cleaned = xml.replace(
      /<c\b([^>]*)\bt="inlineStr"([^>]*)>\s*<\/c>/g,
      '<c$1$2></c>'
    )
    if (cleaned !== xml) files[name] = strToU8(cleaned)
  }
  return Buffer.from(zipSync(files))
}

function collectCategories(raw) {
  const categoryValues = Object.entries(raw)
    .filter(([key]) => key === 'category' || /^category_\d+$/.test(key))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, value]) => value)
  return parseCategories(...categoryValues)
}

function collectImageSpecs(raw, fields) {
  const tokens = new Set(findImageTokens(...Object.values(fields)))
  const specs = {}

  for (let n = 1; n <= 7; n += 1) {
    const key = `image_${n}`
    const prompt = cleanImagePrompt(raw[key])
    if (!prompt && !tokens.has(key)) continue
    specs[key] = {
      prompt,
      title: inferImageTitle(prompt, fields),
      alt: prompt || key,
      placements: Object.fromEntries(
        Object.entries(fields)
          .filter(([, text]) => cleanString(text).includes(`{{${key}}}`))
          .map(([field]) => [field, true])
      ),
      render: inferRenderSpec(prompt, fields),
      output_path: null,
    }
  }

  return specs
}

function cleanImagePrompt(value) {
  const prompt = cleanString(value)
  if (/^(0|false|no|n|none|null)$/i.test(prompt)) return ''
  return prompt
}

function inferImageTitle(prompt, fields) {
  const primary = cleanString(prompt) || Object.values(fields).join(' ')
  if (/two devices communicating via uart|tx.*rx.*crossover/i.test(primary)) return 'UART crossover wiring'
  if (/b-h hysteresis|magnetic hysteresis|magnetic flux density/i.test(primary)) return 'B-H magnetic hysteresis curve'
  if (/mosfet level shifter|n-channel mosfet separates two buses/i.test(primary)) return 'Bidirectional MOSFET level shifter'
  if (/transfer curve graph.*rectangular hysteresis loop/i.test(primary)) return 'Schmitt trigger transfer curve'
  if (/two-part graph showing the effect of noise/i.test(primary)) return 'Noise rejection with hysteresis'
  if (/non-inverting schmitt trigger/i.test(primary)) return 'Non-inverting Schmitt trigger'
  if (/inverting schmitt trigger/i.test(primary)) return 'Inverting Schmitt trigger'
  if (/v_in.*resistor.*output node.*capacitor.*ground/i.test(primary)) return 'RC low-pass filter response'
  if (/v_in.*inductor.*output node.*capacitor.*ground/i.test(primary)) return 'LC low-pass filter response'
  if (/v_in.*capacitor.*output node.*inductor.*ground/i.test(primary)) return 'LC high-pass filter response'
  if (/v_in.*inductor.*capacitor.*resistor.*ground/i.test(primary)) return 'Series RLC band-pass response'
  if (/side-by-side schematics.*high-side.*low-side/i.test(primary)) return 'High-side vs low-side current sensing'
  if (/variable shunt resistor/i.test(primary)) return 'Current-shunt resistance tradeoff'
  if (/pcb layout diagram.*shunt resistor/i.test(primary)) return 'Kelvin shunt connection'
  if (/operational amplifier for current sensing/i.test(primary)) return 'Low-side op-amp current sensing'
  if (/instrumentation amplifier/i.test(primary)) return 'Instrumentation-amplifier current sensing'
  if (/difference amplifier.*v_bus.*r_shunt/i.test(primary)) return 'Difference-amplifier current sensing'
  if (/current sense amplifier.*high-side sensing/i.test(primary)) return 'Dedicated current-sense amplifier'
  if (/standard buck converter schematic/i.test(primary)) return 'Buck converter power stage'
  if (/red ['’]?x['’]?.*inductor|x['’]? drawn over the inductor/i.test(primary)) return 'Buck converter without an inductor'
  if (/red ['’]?x['’]?.*diode|x['’]? drawn over the diode/i.test(primary)) return 'Buck converter without a freewheeling diode'
  if (/red ['’]?x['’]?.*output capacitor|x['’]? over the output capacitor/i.test(primary)) return 'Buck converter without an output capacitor'
  if (/red ['’]?x['’]?.*input capacitor|x['’]? over the input capacitor/i.test(primary)) return 'Buck converter without an input capacitor'
  if (/v-i crossover|switching loss/i.test(primary)) return 'MOSFET switching loss'
  if (/asynchronous buck converter.*synchronous buck converter/i.test(primary)) return 'Asynchronous vs synchronous buck'
  if (/left \(ccm\).*right \(dcm\)|ccm.*dcm/i.test(primary)) return 'CCM vs DCM inductor current'
  if (/switch node voltage/i.test(primary)) return 'Buck switch-node voltage'
  if (/inductor voltage.*inductor current|gate signal.*inductor voltage/i.test(primary)) return 'Buck inductor voltage and current'
  if (/capacitor current.*capacitor voltage/i.test(primary)) return 'Buck output capacitor waveforms'
  if (/diode current.*diode voltage/i.test(primary)) return 'Asynchronous buck diode waveforms'
  if (/input current.*input voltage/i.test(primary)) return 'Buck input waveforms'
  if (/load voltage.*load current/i.test(primary)) return 'Buck output waveforms'
  if (/low-side nfet current.*v_ds|low-side v_ds/i.test(primary)) return 'Synchronous buck low-side FET waveforms'
  if (/gate control signal.*inductor current|inductor current.*gate/i.test(primary)) return 'Buck gate and inductor current'
  if (/voltage follower|buffer/i.test(primary)) return 'Voltage follower'
  if (/non-inverting amplifier/i.test(primary)) return 'Non-inverting amplifier'
  if (/inverting amplifier/i.test(primary)) return 'Inverting amplifier'
  if (/open-loop comparator|comparator/i.test(primary)) return 'Open-loop comparator'
  if (/schmitt trigger/i.test(primary)) return 'Schmitt trigger'
  if (/noisy input signal|upper.*lower|threshold/i.test(primary)) return 'Schmitt trigger hysteresis'
  if (/difference amplifier/i.test(primary)) return 'Difference amplifier'
  if (/20\s*Ω|20\s*ohm/i.test(primary) && /open|1\s*MΩ|1\s*Mohm/i.test(primary)) return 'Open load reflection, 20Ω source'
  if (/50\s*Ω|50\s*ohm/i.test(primary) && /matched driver|source-terminated|open circuit/i.test(primary)) return 'Open load reflection, 50Ω source'
  if (/s11|s21/i.test(primary) && /port 1/i.test(primary)) return 'Forward S-parameters'
  if (/s22|s12/i.test(primary) && /port 2/i.test(primary)) return 'Reverse S-parameters'
  if (/lc ladder|series inductors|shunt capacitors/i.test(primary)) return 'Transmission-line LC ladder'
  if (/z_?0|sqrt\(l\s*\/\s*c\)|magnetic field loops|electric field lines/i.test(primary)) return 'Characteristic impedance'
  if (/3w rule|centerlines.*3w|parallel pcb traces/i.test(primary)) return '3W crosstalk spacing rule'
  if (/wider trace|longer trace|pcb trace/i.test(primary)) return 'PCB trace geometry effects'
  if (/capacitance equation|high c|low c|ground plane/i.test(primary) && /ε|epsilon|dielectric|distance/i.test(primary)) return 'Trace-to-plane capacitance'
  if (/split in the ground plane|return current.*detour|solid ground plane/i.test(primary)) return 'Reference plane return current'
  if (/signal via|ground return via|return current loop/i.test(primary)) return 'Signal via return path'
  if (/d\+|d-|equal and opposite|noise removed/i.test(primary)) return 'Differential noise rejection'
  if (/3w rule|centerlines.*3w|parallel pcb traces/i.test(primary)) return '3W crosstalk spacing rule'
  if (/i2c.*shark|rc curve|oscilloscope/i.test(primary)) return 'I2C rise-time limit'
  if (/spi.*clock|cpol|cpha|sample data/i.test(primary)) return 'SPI mode timing'
  if (/addr pin|address conflict/i.test(primary)) return 'I2C address selection'
  if (/i2c.*spi.*pin|4 sensors|shared i2c.*shared spi|block diagrams.*i2c.*spi/i.test(primary)) return 'I2C vs SPI pin count'
  if (/op-amp.*categor|matrix.*op-amp|precision.*high-speed/i.test(primary)) return 'Op-amp selection matrix'
  if (/slew rate|square wave/i.test(primary)) return 'Op-amp slew-rate limit'
  if (/psrr/i.test(primary)) return 'LDO input ripple rejection'
  if (/quiescent/i.test(primary)) return 'LDO quiescent current'
  if (/realistic circuit model|ideal capacitor.*esr.*esl/i.test(primary)) return 'Real capacitor model and impedance'
  if (/multiple v-shaped srf curves|broadband low impedance/i.test(primary)) return 'Parallel decoupling impedance'
  if (/1µf 0402|0\.1µf 0201|overall parallel impedance/i.test(primary)) return 'Decoupling values and package size'
  if (/three stacked graphs.*resistor|capacitor.*leads.*90|inductor.*leads.*90/i.test(primary)) return 'Voltage and current phase relationships'
  if (/bit-level timing diagram of an i2c frame/i.test(primary)) return 'I2C transaction frame'
  if (/clock stretching|slave.*holding.*scl/i.test(primary)) return 'I2C clock stretching'
  if (/standard spi.*daisy-chain|daisy-chained spi/i.test(primary)) return 'SPI device selection and daisy chain'
  if (/open-drain|push-pull/i.test(primary)) return 'Open-drain vs push-pull outputs'
  if (/side-by-side schematic symbols for an nmos and a pmos/i.test(primary)) return 'NMOS and PMOS symbols'
  if (/graph with voltage \(v\).*current \(i\)|v_f \(~0\.7v\).*reverse breakdown/i.test(primary)) return 'PN diode I-V characteristic'
  if (/dashed ['’]?black box['’]? connected to ground/i.test(primary)) return 'Gate overvoltage protection challenge'
  if (/black box is replaced with a zener diode/i.test(primary)) return '5.1 V Zener gate clamp'
  if (/3\.3v mcu gpio.*low-side nmos.*high-side pmos/i.test(primary)) return '3.3 V control of a 12 V PMOS load switch'
  if (/ldo.*feedback loop|block diagram of an ldo/i.test(primary) && /pmos/i.test(primary)) return 'PMOS LDO feedback loop'
  if (/ldo.*feedback loop|block diagram of an ldo/i.test(primary) && /nmos/i.test(primary)) return 'NMOS LDO feedback loop'
  if (/block diagram of an ldo/i.test(primary)) return 'LDO feedback-loop polarity'
  if (/ldo.*thermal|thermal block|theta|radiating heat/i.test(primary)) return 'LDO thermal path'
  if (/integrated synchronous buck|power good|pg pin/i.test(primary)) return 'Integrated buck block diagram'
  if (/synchronous buck|switching node|inductor current ripple/i.test(primary)) return 'Synchronous buck converter'
  if (/x7r|c0g|capacitance/i.test(primary)) return 'Capacitor DC-bias effect'
  if (/saturation current|i_sat|i_rms|inductor|inductance vs/i.test(primary)) return 'Power inductor limits'
  if (/tvs|clamping|breakdown/i.test(primary)) return 'TVS diode I-V curve'
  if (/0402|0603|0805|smd|wattage/i.test(primary)) return 'SMD resistor package ratings'
  if (/mosfet|id vs vds|ohmic|transistor characteristic/i.test(primary)) return 'MOSFET output characteristics'
  return 'Diagram'
}

function inferRenderSpec(prompt, fields) {
  const primary = cleanString(prompt).toLowerCase()
  const fallback = `${prompt} ${Object.values(fields).join(' ')}`.toLowerCase()
  const haystack = primary || fallback

  if (/two devices communicating via uart|tx.*rx.*crossover/.test(haystack)) return { type: 'uart_crossover' }
  if (/b-h hysteresis|magnetic hysteresis|magnetic flux density/.test(haystack)) return { type: 'bh_hysteresis' }
  if (/mosfet level shifter|n-channel mosfet separates two buses/.test(haystack)) return { type: 'mosfet_level_shifter' }
  if (/transfer curve graph.*rectangular hysteresis loop/.test(haystack)) return { type: 'schmitt_transfer' }
  if (/two-part graph showing the effect of noise/.test(haystack)) return { type: 'schmitt_noise_comparison' }
  if (/non-inverting schmitt trigger/.test(haystack)) return { type: 'op_amp_schmitt_non_inverting' }
  if (/inverting schmitt trigger/.test(haystack)) return { type: 'op_amp_schmitt_inverting' }
  if (/v_in.*resistor.*output node.*capacitor.*ground/.test(haystack)) return { type: 'rc_low_pass' }
  if (/v_in.*inductor.*output node.*capacitor.*ground/.test(haystack)) return { type: 'lc_low_pass' }
  if (/v_in.*capacitor.*output node.*inductor.*ground/.test(haystack)) return { type: 'lc_high_pass' }
  if (/v_in.*inductor.*capacitor.*resistor.*ground/.test(haystack)) return { type: 'rlc_band_pass' }
  if (/side-by-side schematics.*high-side.*low-side/.test(haystack)) return { type: 'current_sense_high_low' }
  if (/schematic of an op-amp difference amplifier/.test(haystack)) return { type: 'current_difference_equation' }
  if (/variable shunt resistor/.test(haystack)) return { type: 'current_shunt_tradeoff' }
  if (/pcb layout diagram.*shunt resistor/.test(haystack)) return { type: 'kelvin_shunt' }
  if (/operational amplifier for current sensing/.test(haystack)) return { type: 'low_side_opamp_current' }
  if (/instrumentation amplifier/.test(haystack)) return { type: 'instrumentation_amp_current' }
  if (/difference amplifier.*v_bus.*r_shunt/.test(haystack)) return { type: 'difference_amp_current' }
  if (/current sense amplifier.*high-side sensing/.test(haystack)) return { type: 'current_sense_amp' }
  if (/standard buck converter schematic/.test(haystack)) return { type: 'buck_power_stage_basic' }
  if (/red ['’]?x['’]?.*inductor|x['’]? drawn over the inductor/.test(haystack)) return { type: 'buck_missing_inductor' }
  if (/red ['’]?x['’]?.*diode|x['’]? drawn over the diode/.test(haystack)) return { type: 'buck_missing_diode' }
  if (/red ['’]?x['’]?.*output capacitor|x['’]? over the output capacitor/.test(haystack)) return { type: 'buck_missing_output_capacitor' }
  if (/red ['’]?x['’]?.*input capacitor|x['’]? over the input capacitor/.test(haystack)) return { type: 'buck_missing_input_capacitor' }
  if (/v-i crossover|switching loss/.test(haystack)) return { type: 'buck_switching_loss' }
  if (/asynchronous buck converter.*synchronous buck converter/.test(haystack)) return { type: 'buck_rectification_comparison' }
  if (/left \(ccm\).*right \(dcm\)|ccm.*dcm/.test(haystack)) return { type: 'buck_ccm_dcm' }
  if (/switch node voltage/.test(haystack)) return { type: 'buck_switch_node_waveforms' }
  if (/inductor voltage.*inductor current|gate signal.*inductor voltage/.test(haystack)) return { type: 'buck_inductor_waveforms' }
  if (/capacitor current.*capacitor voltage/.test(haystack)) return { type: 'buck_output_capacitor_waveforms' }
  if (/diode current.*diode voltage/.test(haystack)) return { type: 'buck_diode_waveforms' }
  if (/input current.*input voltage/.test(haystack)) return { type: 'buck_input_waveforms' }
  if (/load voltage.*load current/.test(haystack)) return { type: 'buck_load_waveforms' }
  if (/low-side nfet current.*v_ds|low-side v_ds/.test(haystack)) return { type: 'buck_low_side_fet_waveforms' }
  if (/gate control signal.*inductor current|inductor current.*gate/.test(haystack)) return { type: 'buck_gate_inductor_current' }
  if (/voltage follower|buffer/.test(haystack)) return { type: 'op_amp_voltage_follower' }
  if (/non-inverting amplifier/.test(haystack)) return { type: 'op_amp_non_inverting' }
  if (/inverting amplifier/.test(haystack)) return { type: 'op_amp_inverting' }
  if (/open-loop comparator|comparator/.test(haystack)) return { type: 'op_amp_comparator' }
  if (/noisy input signal|upper.*lower|threshold/.test(haystack)) return { type: 'schmitt_hysteresis' }
  if (/schmitt trigger/.test(haystack)) return { type: 'op_amp_schmitt_trigger' }
  if (/difference amplifier/.test(haystack)) return { type: 'op_amp_difference' }
  if (/20\s*ω|20\s*ohm/.test(haystack) && /open|1\s*mω|1\s*mohm|1 mω|1 m/.test(haystack)) return { type: 'tl_open_20_source' }
  if (/50\s*ω|50\s*ohm/.test(haystack) && /matched driver|source-terminated|open circuit/.test(haystack)) return { type: 'tl_open_50_source' }
  if (/s11|s21/.test(haystack) && /port 1/.test(haystack)) return { type: 's_params_forward' }
  if (/s22|s12/.test(haystack) && /port 2/.test(haystack)) return { type: 's_params_reverse' }
  if (/lc ladder|series inductors|shunt capacitors/.test(haystack)) return { type: 'tl_lc_ladder' }
  if (/z_?0|sqrt\(l\s*\/\s*c\)|magnetic field loops|electric field lines/.test(haystack)) return { type: 'tl_z0_fields' }
  if (/3w rule|centerlines.*3w|parallel pcb traces/.test(haystack)) return { type: 'pcb_3w_rule' }
  if (/wider trace|longer trace|pcb trace/.test(haystack)) return { type: 'pcb_trace_geometry' }
  if (/capacitance equation|high c|low c/.test(haystack) && /dielectric|ground plane|distance|ε/.test(haystack)) return { type: 'pcb_trace_capacitance' }
  if (/split in the ground plane|return current.*detour|solid ground plane/.test(haystack)) return { type: 'pcb_return_plane' }
  if (/signal via|ground return via|return current loop/.test(haystack)) return { type: 'pcb_return_via' }
  if (/d\+|d-|equal and opposite|noise removed/.test(haystack)) return { type: 'differential_noise_rejection' }
  if (/i2c/.test(haystack) && (/shark/.test(haystack) || /rc curve/.test(haystack))) return { type: 'waveform_comparison' }
  if (/spi/.test(haystack) && (/cpol|cpha|clock|sample data/.test(haystack))) return { type: 'spi_timing' }
  if (/addr pin|address conflict/.test(haystack)) return { type: 'i2c_address_pins' }
  if (/i2c/.test(haystack) && /spi/.test(haystack) && /pin|4 sensors|shared|block diagrams/.test(haystack)) return { type: 'bus_comparison' }
  if (/op-amp.*categor|matrix.*op-amp|precision.*high-speed/.test(haystack)) return { type: 'op_amp_spec_matrix' }
  if (/slew rate|square wave/.test(haystack)) return { type: 'op_amp_slew' }
  if (/ldo/.test(haystack) && /psrr|quiescent/.test(haystack)) return { type: 'ldo_psrr_iq' }
  if (/block diagram of an ldo|ldo's feedback loop/.test(haystack)) {
    const feedbackPositive = /v_fb[^.]{0,80}positive|feedback voltage[^.]{0,80}positive/.test(haystack)
    return { type: feedbackPositive ? 'ldo_feedback_pmos' : 'ldo_feedback_nmos' }
  }
  if (/ldo|thermal block/.test(haystack) && /thermal|theta|heat|radiating/.test(haystack)) return { type: 'ldo_thermal' }
  if (/realistic circuit model|ideal capacitor.*esr.*esl/.test(haystack)) return { type: 'capacitor_real_model_srf' }
  if (/multiple v-shaped srf curves|broadband low impedance/.test(haystack)) return { type: 'decoupling_parallel_impedance' }
  if (/1µf 0402|0\.1µf 0201|overall parallel impedance/.test(haystack)) return { type: 'decoupling_decade_packages' }
  if (/three stacked graphs.*resistor|capacitor.*leads.*90|inductor.*leads.*90/.test(haystack)) return { type: 'passive_phase_relationships' }
  if (/bit-level timing diagram of an i2c frame/.test(haystack)) return { type: 'i2c_frame' }
  if (/clock stretching|slave.*holding.*scl/.test(haystack)) return { type: 'i2c_clock_stretching' }
  if (/standard spi.*daisy-chain|daisy-chained spi/.test(haystack)) return { type: 'spi_select_daisy_chain' }
  if (/open-drain|push-pull/.test(haystack)) return { type: 'open_drain_push_pull' }
  if (/side-by-side schematic symbols for an nmos and a pmos/.test(haystack)) return { type: 'mosfet_symbols' }
  if (/graph with voltage \(v\).*current \(i\)|v_f \(~0\.7v\).*reverse breakdown/.test(haystack)) return { type: 'pn_diode_iv' }
  if (/dashed ['’]?black box['’]? connected to ground/.test(haystack)) return { type: 'zener_gate_clamp_question' }
  if (/black box is replaced with a zener diode/.test(haystack)) return { type: 'zener_gate_clamp_answer' }
  if (/3\.3v mcu gpio.*low-side nmos.*high-side pmos/.test(haystack)) return { type: 'pmos_high_side_driver' }
  if (/integrated synchronous buck|power good|pg pin/.test(haystack)) return { type: 'buck_ic_block' }
  if (/synchronous buck/.test(haystack) && /switching node|inductor current ripple/.test(haystack)) return { type: 'buck_power_stage' }
  if (/x7r|c0g|dc bias|capacitance/.test(haystack)) return { type: 'capacitor_bias_chart' }
  if (/inductor|inductance vs/.test(haystack) && /saturation current|i_sat|i_rms|inductance vs/.test(haystack)) return { type: 'inductor_limits' }
  if (/tvs|clamping voltage|breakdown voltage/.test(haystack)) return { type: 'tvs_iv_curve' }
  if (/0402|0603|0805|smd|wattage/.test(haystack)) return { type: 'smd_resistor_packages' }
  if (/mosfet|id vs vds|ohmic|transistor characteristic/.test(haystack)) return { type: 'mosfet_characteristics' }
  return { type: 'prompt_card' }
}

function dedupeSlug(baseSlug, usedSlugs) {
  const count = usedSlugs.get(baseSlug) ?? 0
  usedSlugs.set(baseSlug, count + 1)
  return count === 0 ? baseSlug : `${baseSlug}-${count + 1}`
}
