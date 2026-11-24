/**
 * Uploads diagram images to Supabase storage and inserts the voltage-follower
 * flashcard question into the questions table.
 * Run once: node scripts/upload_question.mjs
 */
import { createClient } from '@supabase/supabase-js'
import nextEnv from '@next/env'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const { loadEnvConfig } = nextEnv
loadEnvConfig(ROOT)

const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const BUCKET = 'question-images'
const DIAGRAMS = [
  { file: 'diag1_question.png',      name: 'vf_diag1_question.png' },
  { file: 'diag2_answer.png',        name: 'vf_diag2_answer.png' },
  { file: 'diag3_loading_error.png', name: 'vf_diag3_loading_error.png' },
  { file: 'diag4_with_buffer.png',   name: 'vf_diag4_with_buffer.png' },
]

async function uploadImage(filePath, storageName) {
  const buf = readFileSync(filePath)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageName, buf, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`Upload failed for ${storageName}: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storageName)
  console.log(`  ✓ ${storageName} → ${data.publicUrl}`)
  return data.publicUrl
}

async function main() {
  console.log('Uploading images...')
  const urls = {}
  for (const { file, name } of DIAGRAMS) {
    urls[name] = await uploadImage(join(ROOT, 'diagrams', file), name)
  }

  const img = (name, alt) =>
    `<img src="${urls[name]}" alt="${alt}" style="max-width:100%;margin:1rem 0;border-radius:6px;"/>`

  const question_text = `
<p>The circuit below uses a resistor voltage divider to produce a reference voltage for an ADC. A black box sits between the divider output and the ADC input.</p>
<p><strong>What belongs in the black box, and why is it necessary?</strong></p>
${img('vf_diag1_question.png', 'Voltage divider with black box before ADC')}
`.trim()

  const answer_text = `
<p><strong>A voltage follower</strong> — an op-amp wired with its output fed directly back to its inverting (−) input.</p>
${img('vf_diag2_answer.png', 'Voltage follower circuit')}
<p>The voltage divider has a source impedance of R₁ ∥ R₂. If the ADC draws current from that node, it forms a second voltage divider with the source impedance and shifts the measured voltage. The voltage follower fixes this by presenting <strong>near-infinite input impedance</strong> to the divider — it draws essentially zero current. Real op-amps have input impedances in the <strong>MΩ to GΩ</strong> range, meaning their input current is only in the <strong>nanoamp to picoamp</strong> range. The output current the ADC needs is supplied by the <strong>op-amp's power rails (V+ / V−)</strong>, not by R₁ or R₂.</p>

<h4>Loading Effect Without a Buffer</h4>
${img('vf_diag3_loading_error.png', 'Loading error without buffer')}
<p>With R₁ = R₂ = 10 kΩ and Vcc = 5 V, open-circuit Vmid = 2.5 V. But with a 10 kΩ ADC input impedance in parallel with R₂:</p>
<ul>
  <li>R_effective = 10k ∥ 10k = <strong>5 kΩ</strong></li>
  <li>V_measured = 5 V × 5k / (10k + 5k) = <strong>1.67 V</strong></li>
  <li>Error: 0.83 V off — a <strong>33% measurement error</strong></li>
</ul>

<h4>With the Voltage Follower</h4>
${img('vf_diag4_with_buffer.png', 'Correct circuit with voltage follower')}
<p>The op-amp input draws ≈ 0 A, so R_ADC in parallel with R₂ has no effect on Vmid. The divider sees no load and the ADC reads exactly 2.5 V.</p>
`.trim()

  const bonus_question_text = 'When can you get away without a voltage follower?'

  const bonus_answer_text = `
<p><strong>Two situations:</strong></p>
<ol>
  <li><strong>The datasheet covers you.</strong> Every ADC datasheet specifies a maximum allowable source impedance (often in the acquisition time section, sometimes labeled "R_source max"). If R₁ ∥ R₂ is comfortably below that value, the ADC's internal sample-and-hold capacitor charges fast enough and no external buffer is needed.</li>
  <li><strong>Slow sampling + decoupling capacitor.</strong> Place a capacitor (e.g. 100 nF) directly at the ADC input pin. Between samples it pre-charges to the correct voltage through the divider, then supplies the burst of charge when the ADC's acquisition switch closes — instead of the divider doing it. This only works if your sample rate is low enough that the RC settling time (τ = R₁∥R₂ × C) fits within the gap between conversions.</li>
</ol>
`.trim()

  console.log('\nInserting question...')
  const { data, error } = await supabase
    .from('questions')
    .insert({
      category: 'Op-Amps',
      difficulty: 'medium',
      question_text,
      answer_text,
      bonus_question_text,
      bonus_answer_text,
      tags: ['op-amp', 'ADC', 'voltage-divider', 'impedance', 'buffering'],
      resource_videos: [],
      related_question_ids: [],
    })
    .select('id')
    .single()

  if (error) throw new Error(`Insert failed: ${error.message}`)
  console.log(`\n✅ Question created with id=${data.id}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
