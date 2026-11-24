# Ohmwork LTspice review pack

Open `review.html` to review all 12 diagrams and access the corrected `.asc` files.
Each schematic includes guided experiments and common questions below the run instructions. Change one component at a time and predict the result before rerunning.
Previews use geometry read directly from the installed LTspice symbol library, not screenshots of the native application.

These schematics are intentionally laid out as teaching diagrams: signal flow is left to right, feedback paths are routed around op-amp bodies, supplies are separated from the signal path, and every simulated node has a visible label.

| File | Flashcard | Expected result |
| --- | --- | --- |
| `01-rc-low-pass.asc` | RC low-pass filter | 0 dB passband, -3 dB near 1.59 kHz, then -20 dB/decade |
| `02-series-rlc-band-pass.asc` | Series RLC band-pass | Peak near 5.03 kHz when output is measured across R |
| `03-lc-low-pass.asc` | LC low-pass filter | Second-order response with approximately -40 dB/decade roll-off |
| `04-inverting-amplifier.asc` | Inverting op-amp | Gain of -10 V/V with a 180-degree phase inversion |
| `05-non-inverting-amplifier.asc` | Non-inverting op-amp | Gain of +11 V/V |
| `06-voltage-follower.asc` | Voltage follower | Unity gain while driving a 1 kohm load |
| `07-i2c-open-drain-rise-time.asc` | I2C shark-fin rise time | The released bus rises exponentially with tau = Rpullup * Cbus = 0.94 us |
| `08-non-inverting-schmitt-trigger.asc` | Non-inverting Schmitt trigger | Output toggles near +/-1.06 V for +/-5 V rails, Rin = 10 kohm, and Rf = 47 kohm |
| `09-rc-high-pass.asc` | RC high-pass filter | -3 dB near 1.59 kHz; high-frequency gain approaches 0 dB |
| `10-rc-pulse-response.asc` | RC pulse response | Exponential rise and fall with a 100 us time constant |
| `11-loaded-voltage-divider.asc` | Divider loading | About 2.38 V, versus 2.5 V without a load |
| `12-low-side-shunt.asc` | Low-side current sensing | About 118.8 mA and 118.8 mV across the 1 ohm shunt |

## Running the files

Open a schematic in LTspice and press **Run**. The plot directive is included in each file; click the labeled nodes listed in the note on the schematic. These files use only symbols and models bundled with LTspice.

Each schematic also has a matching `.cir` file derived from its placed symbol pins, wires, and net labels. The rebuild checks that every pin is wired. The op-amp netlists use the installed UniversalOpAmp2 model, not a behavioral substitute. All 12 derived netlists were run successfully in LTspice after rebuilding.

For the Schmitt trigger, probe `VSUM` as well as `VIN` and `VOUT`. The negative input is grounded; positive feedback moves VSUM when the output switches. VIN therefore crosses different switching thresholds depending on the current output state.

Rebuild using `node scripts/rebuild-spice.mjs` on the Mac with LTspice installed. The script reads actual symbol pin coordinates and regenerates schematics, netlists, and preview images together.

The op-amp examples use `UniversalOpAmp2` with explicit supply rails. They are educational closed-loop examples, not substitutes for a real device macromodel when checking bandwidth, output current, input common-mode range, or rail-to-rail behavior.
