import { splitCategories } from './categories'
import type { Question } from './types'

export const studyTopicOrder = [
  'Passives (Capacitors, Inductors, Resistors)',
  'Op-Amps',
  'Filters',
  'Buck Converters',
  'LDOs',
  'MOSFETs & Diodes',
  'Current Sensing',
  'PCB & Signal Integrity',
  'Communication Protocols',
  'Thinking',
  'Power Electronics',
  'Other Topics',
] as const

type StudyTopic = typeof studyTopicOrder[number]
const [fundamentals, opAmps, filters, buck, ldo, devices, sensing, pcb, protocols, thinking, power, other] = studyTopicOrder

const topicByTag = new Map<string, StudyTopic>([
  ['components', fundamentals], ['fundamentals', fundamentals], ['passives', fundamentals],
  ['capacitors', fundamentals], ['inductors & magnetics', fundamentals],
  ['amplifier topologies', opAmps], ['op-amp configurations', opAmps], ['op-amps', opAmps],
  ['comparators & triggers', opAmps], ['filters', filters], ['passive rc', filters],
  ['passive lc', filters], ['passive rlc', filters],
  ['power electronics', power], ['buck converters', buck], ['ldos', ldo],
  ['semiconductor devices', devices], ['diodes', devices], ['mosfets', devices],
  ['current sensing', sensing],
  ['pcb', pcb], ['pcb design', pcb], ['signal integrity', pcb], ['transmission line theory', pcb],
  ['protocols', protocols], ['i2c', protocols], ['spi', protocols], ['uart', protocols], ['usb', protocols],
  ['thinking', thinking],
])

// These older cards use catch-all tags that don't describe their actual subject.
const topicByLegacyCard: Record<number, StudyTopic[]> = {
  7: [ldo], 8: [buck], 9: [buck], 11: [fundamentals, buck], 13: [devices],
  14: [ldo], 15: [devices], 16: [opAmps], 17: [opAmps],
  18: [fundamentals, devices], 20: [devices],
  97: [devices], 98: [devices], 99: [devices], 104: [protocols, devices],
}

export function getStudyTopics(question: Pick<Question, 'id' | 'category'>): StudyTopic[] {
  const tags = splitCategories(question.category).map(tag => tag.toLowerCase())
  const legacy = tags.some(tag => ['components', 'thinking', 'system architecture'].includes(tag))
    ? topicByLegacyCard[question.id]
    : undefined
  const topics = new Set<StudyTopic>(legacy)
  for (const tag of tags) {
    if (legacy && tag === 'components') continue
    const topic = topicByTag.get(tag) ?? (tag.startsWith('protocols - ') ? protocols : undefined)
    if (topic) topics.add(topic)
  }
  // Show the specific converter topic instead of also showing its parent.
  if (topics.has(buck) || topics.has(ldo)) topics.delete(power)
  // "Fundamentals" also appears as a subtopic of current sensing.
  if (tags.includes('fundamentals') && topics.has(sensing) && !tags.includes('passives')) topics.delete(fundamentals)
  return topics.size ? [...topics] : [other]
}
