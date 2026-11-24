import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Download, ExternalLink, FlaskConical } from 'lucide-react'
import { circuitResources, getCircuitDownloadLabel } from '@/lib/circuit-resources'

export const metadata: Metadata = {
  title: 'Circuit Lab',
  description: 'Free guided LTspice circuits for electrical engineering interview practice.',
}

const circuits = [
  ['10-rc-pulse-response', circuitResources['10-rc-pulse-response'], 'Filters', 'Plot VOUT and VIN to compare the rise and fall of the capacitor voltage.'],
  ['01-rc-low-pass', circuitResources['01-rc-low-pass'], 'Filters', 'Run an AC sweep to see the passband, 1.59 kHz cutoff, and roll-off.'],
  ['13-cr-high-pass-pulse', circuitResources['13-cr-high-pass-pulse'], 'Filters', 'Probe VOUT at both edges of a 0–5 V pulse and watch it decay back toward zero.'],
  ['09-rc-high-pass', circuitResources['09-rc-high-pass'], 'Filters', 'Run an AC sweep to see the stopband, 1.59 kHz cutoff, and near-unity passband.'],
  ['14-lc-low-pass-step', circuitResources['14-lc-low-pass-step'], 'Filters', 'Watch the output overshoot and settle after a step.'],
  ['03-lc-low-pass', circuitResources['03-lc-low-pass'], 'Filters', 'Change the load and investigate the resonance peak.'],
  ['15-lc-high-pass-step', circuitResources['15-lc-high-pass-step'], 'Filters', 'Watch the output follow the edge, ring, and return to zero.'],
  ['17-lc-high-pass-ac', circuitResources['17-lc-high-pass-ac'], 'Filters', 'See the +40 dB/decade stopband and the effect of damping.'],
  ['16-series-rlc-band-pass-step', circuitResources['16-series-rlc-band-pass-step'], 'Filters', 'See why a DC step creates a burst of ringing across the series resistor.'],
  ['02-series-rlc-band-pass', circuitResources['02-series-rlc-band-pass'], 'Filters', 'Explore resonance, bandwidth, and series resistance.'],
  ['04-inverting-amplifier', 'Inverting amplifier', 'Op-amps', 'Explore gain, rail clipping, and output-current limits.'],
  ['05-non-inverting-amplifier', 'Non-inverting amplifier', 'Op-amps', 'Compare the feedback voltage with the input.'],
  ['06-voltage-follower', 'Voltage follower', 'Op-amps', 'Explore loading, bandwidth, and slew rate.'],
  ['07-i2c-open-drain-rise-time', 'I2C open-drain rise time', 'Interfaces', 'Change pull-up resistance and bus capacitance.'],
  ['08-non-inverting-schmitt-trigger', 'Schmitt trigger', 'Op-amps', 'Probe the summing node and follow both switching thresholds.'],
  ['11-loaded-voltage-divider', 'Loaded voltage divider', 'Fundamentals', 'See how load resistance changes the divider output.'],
  ['12-low-side-shunt', 'Low-side current sensing', 'Current sensing', 'Balance sense voltage against shunt power loss.'],
]

export default function SimulationsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold">Ohmwork</Link>
          <nav aria-label="Main navigation" className="flex gap-4 text-sm">
            <Link href="/" className="text-slate-300 hover:text-white">Flashcards</Link>
            <Link href="/submit" className="text-slate-300 hover:text-white">Feedback</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <FlaskConical className="size-6 text-cyan-300" aria-hidden="true" />
          <h1 className="text-2xl font-semibold">Circuit Lab</h1>
          <span className="text-sm text-slate-400">{circuits.length} experiments</span>
        </div>
        <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-300">
          Download a schematic and open it in LTspice. Each circuit includes experiments and explanations:
          predict a result, change one component, then compare your prediction with the simulation.
          These are educational models, not hardware design sign-off.
        </p>
        <details className="mb-8 border-y border-slate-800 py-4">
          <summary className="cursor-pointer text-sm font-medium text-cyan-300">First time using LTspice?</summary>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Install <a href="https://www.analog.com/en/resources/design-tools-and-calculators/ltspice-simulator.html" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">LTspice from Analog Devices</a>, then download an .asc file below.</li>
            <li>In LTspice, choose Open from the File menu and select the downloaded .asc file.</li>
            <li>Click Run, then click the labeled output wire on the schematic to plot its voltage.</li>
            <li>Read the experiments below the circuit. Right-click a component to change its value, then run again.</li>
          </ol>
        </details>
        <div className="grid gap-6 md:grid-cols-2">
          {circuits.map(([id, title, topic, description]) => (
            <article key={id} className="overflow-hidden rounded-md border border-slate-800 bg-slate-900">
              <a href={`/simulations/${id}.png`} target="_blank" rel="noopener noreferrer" aria-label={`View ${title} schematic and guided exercises`} className="block bg-white">
                <Image src={`/simulations/${id}-circuit.png`} alt={`${title} circuit schematic`} width={1200} height={640} loading={id === '10-rc-pulse-response' || id === '01-rc-low-pass' ? 'eager' : 'lazy'} sizes="(max-width: 767px) 100vw, 560px" className="h-auto w-full" />
              </a>
              <div className="space-y-3 p-5">
                <p className="text-xs text-cyan-300">{topic}</p>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="min-h-12 text-sm leading-6 text-slate-300">{description}</p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
                  <a href={`/simulations/${id}.asc`} download className="inline-flex items-center gap-2 rounded-md bg-cyan-400 px-3 py-2 font-semibold text-slate-950 hover:bg-cyan-300"><Download className="size-4" aria-hidden="true" />{getCircuitDownloadLabel(id)}</a>
                  <a href={`/simulations/${id}.png`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white">Exercises<ExternalLink className="size-3.5" aria-hidden="true" /></a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
