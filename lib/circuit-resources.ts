import type { Question } from './types'

export const circuitResources = {
  '01-rc-low-pass': 'RC low-pass: frequency response',
  '02-series-rlc-band-pass': 'Series RLC band-pass: frequency response',
  '03-lc-low-pass': 'LC low-pass: frequency response',
  '04-inverting-amplifier': 'Inverting amplifier',
  '05-non-inverting-amplifier': 'Non-inverting amplifier',
  '06-voltage-follower': 'Voltage follower',
  '07-i2c-open-drain-rise-time': 'I2C open-drain rise time',
  '08-non-inverting-schmitt-trigger': 'Non-inverting Schmitt trigger',
  '09-rc-high-pass': 'CR high-pass: frequency response',
  '10-rc-pulse-response': 'RC low-pass: step response',
  '11-loaded-voltage-divider': 'Loaded voltage divider',
  '12-low-side-shunt': 'Low-side shunt example',
  '13-cr-high-pass-pulse': 'CR high-pass: step response',
  '14-lc-low-pass-step': 'LC low-pass: step response',
  '15-lc-high-pass-step': 'LC high-pass: step response',
  '16-series-rlc-band-pass-step': 'Series RLC band-pass: step response',
  '17-lc-high-pass-ac': 'LC high-pass: frequency response',
} as const

export function getCircuitDownloadLabel(id: string) {
  const title = circuitResources[id as CircuitId]
  if (title?.endsWith(': step response')) return 'Download step response (.asc)'
  if (title?.endsWith(': frequency response')) return 'Download frequency response (.asc)'
  return 'Download LTspice (.asc)'
}

type CircuitId = keyof typeof circuitResources
// Explicit reviewed matches avoid attaching the wrong topology by keyword.
const questionCircuits: Record<number, CircuitId[]> = {
  1: ['13-cr-high-pass-pulse'],
  5: ['06-voltage-follower', '11-loaded-voltage-divider'],
  6: ['06-voltage-follower', '11-loaded-voltage-divider'],
  17: ['06-voltage-follower'],
  22: ['07-i2c-open-drain-rise-time'],
  26: ['05-non-inverting-amplifier'],
  27: ['08-non-inverting-schmitt-trigger'],
  28: ['06-voltage-follower'],
  29: ['04-inverting-amplifier'],
  89: ['07-i2c-open-drain-rise-time'],
  90: ['07-i2c-open-drain-rise-time'],
  105: ['17-lc-high-pass-ac'],
  106: ['03-lc-low-pass'],
  107: ['01-rc-low-pass'],
  108: ['02-series-rlc-band-pass'],
  109: ['08-non-inverting-schmitt-trigger'],
  115: ['12-low-side-shunt'],
  119: ['12-low-side-shunt'],
}

export function getOriginalCircuitFile(question: Pick<Question, 'id' | 'ltspice_file_url'>) {
  const url = question.ltspice_file_url
  return question.id === 1 && url?.endsWith('/1778786824208-CR2.asc') ? null : url
}

export function getCircuitResources(question: Pick<Question, 'id' | 'ltspice_file_url'>) {
  const ids = new Set<CircuitId>(questionCircuits[question.id] ?? [])
  const url = question.ltspice_file_url
  if (url) {
    const match = Object.keys(circuitResources).find(id => url.endsWith(`/simulations/${id}.asc`))
    if (match) ids.add(match as CircuitId)
  }
  return [...ids].map(id => ({ id, title: circuitResources[id], file: `/simulations/${id}.asc`, preview: `/simulations/${id}-circuit.png`, exercises: `/simulations/${id}.png` }))
}
