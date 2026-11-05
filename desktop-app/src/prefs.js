const fs = require('node:fs')
const path = require('node:path')

// The choices the desktop cat shares with the Claude cat: the coat both wear,
// the colour of the cushion they sleep on, and whether Claude talks like a
// cat. This cat's menu and /cat-voice write them, each keeping what the other
// wrote. The cushions come from the Claude cat's drawings
// (tools/build-poses.mjs), the first being the one it starts on.
const CUSHIONS = require('./cushions.json')
const COATS = [
  { id: 'calico', label: '三花' },
  { id: 'tuxedo', label: '賓士' },
  { id: 'siamese', label: '暹羅' },
]
const DEFAULT_COAT = 'calico'
// How the cans beside the cat look, the desktop cat's own choice: the colour
// of their labels and the meat in them, from the cans' drawing
// (tools/build-cans.mjs), the first of each being the one they start with.
const { labels: CAN_LABELS, foods: CAN_FOODS } = require('./can-choices.json')

function readPrefs(file) {
  try {
    const prefs = JSON.parse(fs.readFileSync(file, 'utf8'))

    return typeof prefs === 'object' && prefs !== null && !Array.isArray(prefs) ? prefs : {}
  } catch {
    // Not there yet, or not ours to read: as if nothing were chosen.
    return {}
  }
}

function writePrefs(file, change) {
  const prefs = { ...readPrefs(file), ...change }
  const draft = `${file}.${process.pid}.tmp`

  fs.mkdirSync(path.dirname(file), { recursive: true })
  // Written whole beside it, then swapped in, so the Claude cat never reads half.
  fs.writeFileSync(draft, JSON.stringify(prefs, null, 2))
  fs.renameSync(draft, file)
}

const coatOf = prefs => (COATS.some(coat => coat.id === prefs.coat) ? prefs.coat : DEFAULT_COAT)
const cushionOf = prefs =>
  CUSHIONS.find(cushion => cushion.id === prefs.cushion) ?? CUSHIONS[0]
const isVoiceOn = prefs => prefs.voice !== false
const canLabelOf = id => CAN_LABELS.find(label => label.id === id) ?? CAN_LABELS[0]
const canFoodOf = id => CAN_FOODS.find(food => food.id === id) ?? CAN_FOODS[0]

module.exports = {
  CAN_FOODS,
  CAN_LABELS,
  COATS,
  CUSHIONS,
  DEFAULT_COAT,
  canFoodOf,
  canLabelOf,
  coatOf,
  cushionOf,
  isVoiceOn,
  readPrefs,
  writePrefs,
}
