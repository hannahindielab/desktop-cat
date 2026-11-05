// Writes the website's pictures into docs/art from the desktop cat's own
// drawings (src/poses.js and src/cans.js): the poses the page shows, each also
// standing still for visitors who ask for less motion, and the can stacks
// beside the donation choices.
//
// Run from the desktop app's folder: node tools/build-site-art.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(app, '..', 'docs', 'art')

// The drawings are scripts that set window.POSES and window.CANS.
const window = {}
for (const file of ['poses.js', 'cans.js']) {
  vm.runInNewContext(readFileSync(join(app, 'src', file), 'utf8'), { window })
}

const POSES = {
  calico: ['working', 'thinking', 'talking', 'calling', 'pet-head', 'resting', 'waiting'],
  tuxedo: ['waiting'],
  siamese: ['waiting'],
}
// Named for what the page says with them: one can, two, a whole stack, and
// the stack that stands for usage left. Each stack stands at the left of a
// frame wide enough for five cans; it is cut to its own width, measured in the
// drawing's units, keeping the frame's height and floor so that all of them
// show at one scale side by side.
const CANS = {
  'cans-1': { stack: '1 full', width: 138 },
  'cans-2': { stack: '2 full', width: 278 },
  'cans-many': { stack: '5 full', width: 418 },
  'cans-usage': { stack: '3 low', width: 418 },
}
const MARGIN = 3
const cutTo = (svg, width) =>
  svg.replace(/viewBox="[^"]*"/, `viewBox="${-209 - MARGIN} ${-258 - MARGIN} ${width + 2 * MARGIN} ${285 + 2 * MARGIN}"`)

// Without its animations a drawing stands still at its first moment.
const still = svg => svg.replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*?(\/>|>[\s\S]*?<\/\1>)/g, '')

mkdirSync(out, { recursive: true })
let written = 0
// A drawing that moves gets its still twin beside it.
const write = (name, svg) => {
  writeFileSync(join(out, `${name}.svg`), svg)
  written += 1

  if (still(svg) !== svg) {
    writeFileSync(join(out, `${name}-still.svg`), still(svg))
    written += 1
  }
}

for (const [coat, poses] of Object.entries(POSES)) {
  for (const pose of poses) {
    write(`${coat}-${pose}`, window.POSES[coat][pose])
  }
}
for (const [name, { stack, width }] of Object.entries(CANS)) {
  write(name, cutTo(window.CANS[stack], width))
}
console.log(`docs/art: ${written} pictures`)
