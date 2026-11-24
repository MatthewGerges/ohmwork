-- Publish after the matching simulations and answer plots are live.
-- Re-running adds no duplicate cards and preserves existing related links.
do $publish$
declare
  card record;
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('ohmwork-filter-response-pairs'));
  for card in
    select * from jsonb_to_recordset($cards$[
      {
        "key": "cr-high-pass-bode", "pair": 1, "category": "Filters, Passive RC", "difficulty": "medium",
        "lab": "09-rc-high-pass",
        "question": "<p>Sketch the Bode magnitude and phase of this CR high-pass filter. C is in series, R = 1 kΩ to ground, C = 100 nF, and the output is across R. What are the cutoff, the low-frequency slope, and the high-frequency gain?</p>",
        "answer": "<p>The magnitude rises at +20 dB/decade below cutoff and approaches 0 dB above it. The cutoff is 1/(2πRC) ≈ 1.59 kHz, where the gain is −3.01 dB and the phase is +45°. Phase approaches +90° at low frequency and 0° at high frequency.</p>",
        "explanation": "<p>H(s) = sRC/(1 + sRC). At low frequencies, the series capacitor has large impedance, so most of the input voltage is across the capacitor. At high frequencies, it acts nearly like a short, so nearly all of the input appears across R.</p>",
        "alt": "CR high-pass Bode plot: magnitude rises toward 0 dB and phase falls from 90 degrees toward zero."
      },
      {
        "key": "rc-low-pass-time", "pair": 107, "category": "Filters, Passive RC", "difficulty": "easy",
        "lab": "10-rc-pulse-response",
        "question": "<p>Vin is a pulse from 0 V to 3.3 V and back, with a 1 ms high interval. For this RC low-pass filter with R = 1 kΩ and C = 100 nF, sketch Vout across C on the same time axis. What is the voltage one time constant after the rising edge?</p>",
        "answer": "<p>Vout starts at 0 V, rises exponentially toward 3.3 V, and falls exponentially toward 0 V after the falling edge. The time constant is RC = 100 μs. One time constant after an ideal rising step, Vout is 3.3(1 − e<sup>−1</sup>) ≈ 2.09 V.</p>",
        "explanation": "<p>Capacitor voltage cannot change instantaneously. After the falling edge, the voltage at that instant becomes the starting value for the exponential decay. The high interval is 10 time constants, so the capacitor is nearly fully charged before that edge.</p>",
        "alt": "RC low-pass pulse response: the output rises and falls exponentially without jumping at either input edge."
      },
      {
        "key": "lc-low-pass-time", "pair": 106, "category": "Filters, Passive LC", "difficulty": "medium",
        "lab": "14-lc-low-pass-step",
        "question": "<p>Apply a 0 → 1 V step to an LC low-pass filter with a 1 mH series inductor and a 1 μF capacitor in parallel with a 100 Ω load. Sketch the output across the load. Where does it start and settle, and does it overshoot?</p>",
        "answer": "<p>Vout starts at 0 V, rises, overshoots 1 V, then rings with decreasing amplitude until it settles at 1 V.</p>",
        "explanation": "<p>The output is the capacitor voltage, so it cannot jump. Inductor current cannot jump either. The inductor and capacitor exchange energy, while the load dissipates it. This particular circuit is underdamped. At DC, the inductor is a short and the capacitor is open, so the ideal output equals the input.</p>",
        "alt": "LC low-pass step response: the output rises from zero, overshoots, and rings down to 1 V."
      },
      {
        "key": "lc-high-pass-time", "pair": 105, "category": "Filters, Passive LC", "difficulty": "medium",
        "lab": "15-lc-high-pass-step",
        "question": "<p>Apply a 0 → 1 V step through a 1 μF series capacitor to an output node with a 1 mH inductor and a 100 Ω resistor to ground. Sketch Vout. What does it do at the edge, and what voltage does it settle to?</p>",
        "answer": "<p>For an ideal step, Vout jumps to 1 V at the edge, then swings above and below zero with decreasing amplitude and settles at 0 V.</p>",
        "explanation": "<p>The voltage across the series capacitor starts at 0 V and cannot jump, so the input step initially appears at the output. The inductor current is initially zero and then changes. The load damps the ringing. At DC, the capacitor is open and the inductor holds the output at ground.</p>",
        "alt": "LC high-pass step response: the output jumps near 1 V, swings below zero, and rings down to zero."
      },
      {
        "key": "rlc-band-pass-time", "pair": 108, "category": "Filters, Passive RLC", "difficulty": "hard",
        "lab": "16-series-rlc-band-pass-step",
        "question": "<p>Apply a 0 → 1 V step to a series RLC band-pass with L = 10 mH, C = 100 nF and R = 100 Ω. Vout is measured across R. Sketch the time response. Does the output jump at the step, and where does it settle?</p>",
        "answer": "<p>Vout starts at 0 V. It rises to a positive lobe, swings negative, and rings with decreasing amplitude before settling back to 0 V.</p>",
        "explanation": "<p>Vout = Ri, and inductor current cannot jump, so Vout does not jump. The edge excites the underdamped LC pair (natural frequency ≈ 5.03 kHz); the resistor dissipates energy and damps the ringing. At DC, the series capacitor blocks current, so the resistor voltage returns to zero.</p>",
        "alt": "Series RLC band-pass step response: the output starts at zero and rings around zero before settling."
      }
    ]$cards$::jsonb) as data(
      key text, pair bigint, category text, difficulty text, lab text,
      question text, answer text, explanation text, alt text
    )
  loop
    if not exists (select 1 from public.questions where id = card.pair and category ilike 'Filters%') then
      raise exception 'Missing filter companion %', card.pair;
    end if;
    select id into new_id from public.questions where tags @> array[card.key];
    if new_id is null then
      insert into public.questions (
        category, difficulty, question_text, answer_text, explanation_text,
        ltspice_file_url, related_question_ids, tags
      ) values (
        card.category, card.difficulty,
        card.question || format('<p><img src="/simulations/%s-circuit.png" alt="Circuit schematic" /></p>', card.lab),
        card.answer || format('<p><img src="/diagrams/filter-responses/%s.svg" alt="%s" /></p>', card.key, card.alt),
        card.explanation, format('/simulations/%s.asc', card.lab),
        array[card.pair], array['filter-response-pair', card.key]
      ) returning id into new_id;
    end if;
    update public.questions
    set related_question_ids = array_append(related_question_ids, new_id)
    where id = card.pair and not (new_id = any(related_question_ids));
  end loop;
end;
$publish$;
