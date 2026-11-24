-- Run this in your Supabase SQL Editor:
-- supabase.com → your project → SQL Editor → paste & run

INSERT INTO questions (
  category,
  difficulty,
  question_text,
  answer_text,
  bonus_question_text,
  bonus_answer_text,
  tags,
  resource_videos,
  related_question_ids
) VALUES (
  'Op-Amps',
  'medium',

  -- question_text
  '<p>The circuit below uses a resistor voltage divider to produce a reference voltage for an ADC. A black box sits between the divider output and the ADC input.</p>
<p><strong>What belongs in the black box, and why is it necessary?</strong></p>
<img src="https://raw.githubusercontent.com/MatthewGerges/ee-flashcards/claude/ee-flashcard-hosting-wsybxl/diagrams/diag1_question.png" alt="Voltage divider with black box before ADC" style="max-width:100%;margin:1rem 0;border-radius:6px;"/>',

  -- answer_text
  '<p><strong>A voltage follower</strong> — an op-amp wired with its output fed directly back to its inverting (−) input.</p>
<img src="https://raw.githubusercontent.com/MatthewGerges/ee-flashcards/claude/ee-flashcard-hosting-wsybxl/diagrams/diag2_answer.png" alt="Voltage follower circuit" style="max-width:100%;margin:1rem 0;border-radius:6px;"/>
<p>The voltage divider has a source impedance of R₁ ∥ R₂. If the ADC draws current from that node it forms a second voltage divider with the source impedance, shifting the measured voltage. The voltage follower fixes this by presenting <strong>near-infinite input impedance</strong> to the divider. Real op-amps have input impedances in the <strong>MΩ–GΩ</strong> range, so their input current is only <strong>nanoamps to picoamps</strong> — effectively zero. The output current the ADC needs is then supplied by the <strong>op-amp''s power rails (V+ / V−)</strong>, not by R₁ or R₂.</p>

<h4>Loading Effect Without a Buffer</h4>
<img src="https://raw.githubusercontent.com/MatthewGerges/ee-flashcards/claude/ee-flashcard-hosting-wsybxl/diagrams/diag3_loading_error.png" alt="Loading error without buffer" style="max-width:100%;margin:1rem 0;border-radius:6px;"/>
<p>With R₁ = R₂ = 10 kΩ and Vcc = 5 V, open-circuit Vmid = 2.5 V. With a 10 kΩ ADC input impedance in parallel with R₂:</p>
<ul>
  <li>R_effective = 10k ∥ 10k = <strong>5 kΩ</strong></li>
  <li>V_measured = 5 V × 5k / (10k + 5k) = <strong>1.67 V</strong></li>
  <li>Error: 0.83 V — a <strong>33% measurement error</strong></li>
</ul>

<h4>With the Voltage Follower</h4>
<img src="https://raw.githubusercontent.com/MatthewGerges/ee-flashcards/claude/ee-flashcard-hosting-wsybxl/diagrams/diag4_with_buffer.png" alt="Correct circuit with voltage follower" style="max-width:100%;margin:1rem 0;border-radius:6px;"/>
<p>The op-amp input draws ≈ 0 A, so R_ADC in parallel with R₂ has no effect on Vmid. The divider sees no load and the ADC reads exactly 2.5 V.</p>',

  -- bonus_question_text
  'When can you get away without a voltage follower?',

  -- bonus_answer_text
  '<p><strong>Two situations:</strong></p>
<ol>
  <li><strong>The datasheet covers you.</strong> Every ADC datasheet specifies a maximum allowable source impedance (often in the acquisition time section, sometimes labeled "R_source max"). If R₁ ∥ R₂ is comfortably below that value, the ADC''s internal sample-and-hold cap charges fast enough and no external buffer is needed.</li>
  <li><strong>Slow sampling + decoupling capacitor.</strong> Place a capacitor (e.g. 100 nF) directly at the ADC input pin. Between samples it pre-charges to the correct voltage through the divider, then supplies the burst of charge when the ADC''s acquisition switch closes — instead of the divider doing it. Only works if your sample rate is low enough that the RC settling time (τ = R₁∥R₂ × C) fits comfortably within the gap between conversions.</li>
</ol>',

  -- tags
  ARRAY['op-amp', 'ADC', 'voltage-divider', 'impedance', 'buffering'],

  -- resource_videos
  '[]'::jsonb,

  -- related_question_ids
  '{}'::bigint[]
);
