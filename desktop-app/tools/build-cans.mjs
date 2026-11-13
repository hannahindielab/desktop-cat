// Rebuilds src/cans.js and src/can-choices.json from the cans' drawing
// (tools/can-art.mjs): every stack the cans can show, from five cans down to
// the one empty can, its open can full, low or eaten; and the label colours
// and meats a person may give them.
//
// Run from the desktop app's folder: node tools/build-cans.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FOODS, LABEL_COLOURS, stack } from './can-art.mjs'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const LEVELS = ['full', 'low', 'empty']

// Keyed by how many cans are left and how full the open one is: "3 low".
const stacks = {}
for (let count = 0; count <= 5; count += 1) {
  for (const level of LEVELS) {
    stacks[`${count} ${level}`] = stack(count * 20, level)
  }
}

writeFileSync(
  join(app, 'src', 'cans.js'),
  `// The cans beside the cat, built from tools/can-art.mjs: each stack they can show.\nwindow.CANS = ${JSON.stringify(stacks)}\n`,
)
// The app knows each choice by its id; its names are in src/locales (colour.coral, food.tuna).
const withoutNames = choices => choices.map(({ label, ...choice }) => choice)
writeFileSync(
  join(app, 'src', 'can-choices.json'),
  `${JSON.stringify({ labels: withoutNames(LABEL_COLOURS), foods: withoutNames(FOODS) }, null, 2)}\n`,
)
console.log(`src/cans.js rebuilt: ${Object.keys(stacks).length} stacks; src/can-choices.json: ${LABEL_COLOURS.length} labels, ${FOODS.length} foods`)
