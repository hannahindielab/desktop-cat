import { CALICO, LYING, SIAMESE, SITTING, TUXEDO } from './coat-art'
import type { CoatArt, Colours, FurLine, Part, Patches, Spot } from './coat-art'
import { FISH } from './fish-art'
import { PLACE_ART } from './place-art'
import type { PlaceName } from './place-art'

// The bubbles, clouds and marks round the cat keep one ink and one paper,
// whichever coat the cat wears.
const INK = '#816C6A'
const PAPER = '#F1F1F1'
const FLOATING = '#A08C8A'
const BUBBLE = `fill="${PAPER}" stroke="${INK}" stroke-width="10"`
const HEAD_PIVOT = '830 800'
const TAIL_PIVOT = '1440 1560'

const spin = (values: number[], pivot: string, dur: number) =>
  `<animateTransform attributeName="transform" type="rotate" values="${values
    .map(angle => `${angle} ${pivot}`)
    .join(';')}" dur="${dur}s" repeatCount="indefinite"/>`

const move = (values: string, dur: number, begin = 0) =>
  `<animateTransform attributeName="transform" type="translate" values="${values}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`

const fade = (values: string, dur: number, begin = 0, keyTimes = '') =>
  `<animate attributeName="opacity" values="${values}"${keyTimes && ` keyTimes="${keyTimes}"`} dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`

// The window onto the sitting cat. It leaves room below the paws for the paw
// that reaches down to tap; the thought cloud reaches its top edge. The frame
// of the cat on its cushion grew by the same share about its top middle when
// this one did, so the cat keeps its size and place between them.
const FRAME = { x: 45, y: 30, size: 1940 }
const frame = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FRAME.x} ${FRAME.y} ${FRAME.size} ${FRAME.size}">${content}</svg>`

const flick = (angles: number[], dur: number) => spin(angles, '2080 1180', dur)

const floatingZs = (zs: [string, number][], drift: string, width: number) =>
  zs
    .map(
      ([d, begin]) => `<g opacity="0">
        ${move(drift, 3, begin)}
        ${fade('0;1;1;0', 3, begin, '0;.2;.7;1')}
        <path d="${d}" fill="none" stroke="${FLOATING}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>
      </g>`,
    )
    .join('')

const HEART = 'M0 22C-34-14-22-44 0-26 22-44 34-14 0 22Z'
// A paw print in a 100 square, toes up: a big soft main pad, round on top and
// nearly flat below, and four plump toes hugging it, the middle two higher.
export const PAW_PRINT = `<path d="M50 45C64 45 81 58 82 71C83 82 75 87.5 64 87.5C58 87.5 55 86.5 50 86.5C45 86.5 42 87.5 36 87.5C25 87.5 17 82 18 71C19 58 36 45 50 45Z"/>
  <ellipse cx="15" cy="44" rx="9.5" ry="12" transform="rotate(-20 15 44)"/>
  <ellipse cx="36.5" cy="25" rx="10.5" ry="13" transform="rotate(-6 36.5 25)"/>
  <ellipse cx="63.5" cy="25" rx="10.5" ry="13" transform="rotate(6 63.5 25)"/>
  <ellipse cx="85" cy="44" rx="9.5" ry="12" transform="rotate(20 85 44)"/>`
export const PAW_PINK = '#E998A9'

// The paw print on Claude's working row, pressing down and lifting again like
// a little stamp.
const STAMP_SECONDS = 1.1
export const WORKING_PAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="${PAW_PINK}">
  <g transform="translate(50 92)">
    <g><animateTransform attributeName="transform" type="translate" values="0 -6;0 0;0 0;0 -6" keyTimes="0;.3;.55;1" dur="${STAMP_SECONDS}s" repeatCount="indefinite"/>
      <g><animateTransform attributeName="transform" type="scale" values="1 1;1.1 0.88;1 1;1 1" keyTimes="0;.3;.55;1" dur="${STAMP_SECONDS}s" repeatCount="indefinite"/>
        <g transform="translate(0 -40) scale(.84) translate(-50 -55)">${PAW_PRINT}</g>
      </g>
    </g>
  </g>
</svg>`

// Waiting for an answer, the cat reaches its left front paw forward, further
// down than where it sits, so the leg stretches, and holds it there a moment.
// From there it taps the table twice and waits, round after round, the paw
// staying out, ready for the next taps. The reach plays once; the taps repeat.
export const TAP_REACH = 96
const TAP_REACH_SECONDS = 0.4
export const TAP_HOLD = 0.6
export const TAP_HEIGHT = 40
export const TAP_SECONDS = 0.5
export const TAP_PAUSE = 2
/**
 * A round of taps, then the wait: when each moment comes, how far the paw is
 * lifted then, and whether the bubble's paw is pressed; it stays pressed a
 * moment after the second tap and lifts again for the next round. On its own
 * so the try-out page can run it too.
 */
export function tapRound(seconds: number, pause: number) {
  const pressedFor = Math.min(0.3, pause / 3)
  const lifting = Math.min(0.25, pause / 3)
  const times = [0, 0.25, 0.5, 0.75, 1].map(share => share * seconds).concat([seconds + pressedFor, seconds + pressedFor + lifting, seconds + pause])
  return {
    keyTimes: times.map(time => Math.round((time / (seconds + pause)) * 10000) / 10000),
    lifted: [0, 1, 0, 1, 0, 0, 0, 0],
    pressed: [false, false, true, false, true, true, false, false],
  }
}
const TAP_ROUND = tapRound(TAP_SECONDS, TAP_PAUSE)
// Each move is marked with what it moves, so a try-out page can retune them.
const reaching = (type: 'translate' | 'scale', part: string, values: string) =>
  `<animateTransform data-tap="${part}" attributeName="transform" type="${type}" values="${values}" dur="${TAP_REACH_SECONDS}s" fill="freeze"/>`
const tapping = (values: (lifted: number, pressed: boolean) => string, type: 'translate' | 'scale', part: string) =>
  `<animateTransform data-tap="${part}" attributeName="transform" type="${type}" values="${TAP_ROUND.lifted.map((lifted, i) => values(lifted, TAP_ROUND.pressed[i] ?? false)).join(';')}" keyTimes="${TAP_ROUND.keyTimes.join(';')}" dur="${TAP_SECONDS + TAP_PAUSE}s" begin="${TAP_REACH_SECONDS + TAP_HOLD}s" repeatCount="indefinite"/>`
// The little speech bubble beside the head, its paw pressing down each time
// the real paw taps, and lifted until the taps begin. Lifted, the paw sits in
// the middle of the bubble (1450, 240); it presses down onto the bottom of
// its own print, where it is placed from.
const CALL_BUBBLE = `<path d="M1300 110h300a56 56 0 0 1 56 56v148a56 56 0 0 1-56 56h-196l-96 62 24-62h-32a56 56 0 0 1-56-56V166a56 56 0 0 1 56-56z" ${BUBBLE}/>
  <g transform="translate(1450 326)">
    <g transform="translate(0 -14)">${tapping((_, pressed) => `0 ${pressed ? 0 : -14}`, 'translate', 'bubble-lift')}
      <g fill="${PAW_PINK}">${tapping((_, pressed) => (pressed ? '1.1 0.88' : '1 1'), 'scale', 'bubble-squash')}
        <g transform="translate(-95 -166.25) scale(1.9)">${PAW_PRINT}</g>
      </g>
    </g>
  </g>`
const SPARKLE = 'M0-1l.28.72.72.28-.72.28L0 1l-.28-.72L-1 0l.72-.28z'
const GOLD = '#F2B134'
const ROSE = '#E8788F'
const SKY = '#6FB7C9'
const NIGHT = '#3E3A5C'
const RING = '#F7D9A0'

// The thought cloud: overlapping puffs drawn in ink a little larger and then
// paper on top, so only the outline of the whole shows, and a middle that
// fills the gaps the puffs leave between them.
const PUFFS: [number, number, number][] = [
  [1475, 240, 90],
  [1580, 150, 105],
  [1715, 155, 95],
  [1800, 245, 80],
  [1690, 300, 95],
  [1550, 310, 80],
]
const CLOUD_MIDDLE = '<ellipse cx="1640" cy="230" rx="170" ry="110"/>'
const puffs = (grow: number) =>
  PUFFS.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r + grow}"/>`).join('')
const CLOUD = `<g fill="${INK}">${puffs(10)}</g>
  <g fill="${PAPER}">${puffs(0)}${CLOUD_MIDDLE}</g>
  <clipPath id="thought-cloud">${puffs(0)}${CLOUD_MIDDLE}</clipPath>`
const THOUGHT = { x: 1640, y: 228 }
// Held smaller about its top and a little to the left, clear of the swaying tail.
const CLOUD_HOLD = `translate(-40 0) translate(${THOUGHT.x} 35) scale(.8) translate(${-THOUGHT.x} -35)`

// Two small puffs leading up from the head, bobbing and glowing out of step.
const TRAIL = ([
  [1295, 365, 15, 0],
  [1365, 320, 22, 0.5],
] as [number, number, number, number][])
  .map(
    ([cx, cy, r, begin]) => `<g>${move('0 0;0 -12;0 0', 1.8, begin)}
      <circle cx="${cx}" cy="${cy}" r="${r}" ${BUBBLE}>${fade('1;.55;1', 1.8, begin)}</circle>
    </g>`,
  )
  .join('')

const twinkle = (x: number, y: number, size: number, colour: string, begin: number) =>
  `<path d="${SPARKLE}" transform="translate(${x} ${y}) scale(${size})" fill="${colour}" opacity="0">
    ${fade('0;1;0', 1.2, begin)}
  </path>`

// Drawn small about the cloud's middle and shown larger, to fill it.
const larger = (content: string) =>
  `<g transform="translate(${THOUGHT.x} ${THOUGHT.y}) scale(1.4) translate(${-THOUGHT.x} ${-THOUGHT.y})">${content}</g>`

// The whole inside of the cloud turns to night sky, with a ringed planet.
const UNIVERSE = `
  <rect x="1360" y="30" width="560" height="400" fill="${NIGHT}"/>
  ${([
    [1470, 170, 16, PAPER, 0],
    [1560, 90, 11, GOLD, 0.4],
    [1760, 110, 14, PAPER, 0.8],
    [1820, 250, 10, GOLD, 0.2],
    [1500, 300, 12, PAPER, 0.6],
    [1700, 340, 9, GOLD, 1],
    [1440, 240, 7, PAPER, 0.3],
    [1660, 70, 8, PAPER, 0.9],
  ] as [number, number, number, string, number][])
    .map(([x, y, size, colour, begin]) => twinkle(x, y, size, colour, begin))
    .join('')}
  <g transform="rotate(-18 ${THOUGHT.x} ${THOUGHT.y})">
    <ellipse cx="${THOUGHT.x}" cy="${THOUGHT.y}" rx="74" ry="19" fill="none" stroke="${RING}" stroke-width="10"/>
    <circle cx="${THOUGHT.x}" cy="${THOUGHT.y}" r="40" fill="${GOLD}"/>
    <path d="M${THOUGHT.x - 74} ${THOUGHT.y}a74 19 0 0 0 148 0" fill="none" stroke="${RING}" stroke-width="10"/>
  </g>
  <circle r="11" fill="${ROSE}">
    <animateMotion dur="2s" repeatCount="indefinite" path="M${THOUGHT.x + 110} ${THOUGHT.y}a110 44 0 1 1 -220 0a110 44 0 1 1 220 0"/>
  </circle>`

const QUESTION = 'M-26-34a28 28 0 1 1 40 26c-10 6-14 12-14 24'
const question = (x: number, y: number, size: number, colour: string, begin: number) =>
  `<g transform="translate(${x} ${y}) scale(${size})">
    <g><animateTransform attributeName="transform" type="rotate" values="-8;8;-8" dur="1s" begin="${begin}s" repeatCount="indefinite"/>
      <path d="${QUESTION}" fill="none" stroke="${colour}" stroke-width="16" stroke-linecap="round"/>
      <circle cx="0" cy="40" r="10" fill="${colour}"/>
    </g>
  </g>`
const QUESTIONS = larger(`
  ${question(THOUGHT.x, THOUGHT.y + 4, 1.25, INK, 0)}
  ${question(THOUGHT.x - 78, THOUGHT.y - 34, 0.6, ROSE, 0.3)}
  ${question(THOUGHT.x + 78, THOUGHT.y + 30, 0.55, SKY, 0.6)}`)

// The fish, about 240 wide, swims across wagging its tail, with a bubble now and then.
const FISH_SCALE = 240 / FISH.box.width
const fishPart = (d: string, colour: string) => `<path fill="${colour}" fill-rule="evenodd" d="${d}"/>`
const wag = (angle: number) => `${angle} ${FISH.tailJoin.x} ${FISH.tailJoin.y}`
const SWIMMING = `
  <g>${move(`${THOUGHT.x - 70} ${THOUGHT.y + 8};${THOUGHT.x - 20} ${THOUGHT.y - 8};${THOUGHT.x + 30} ${THOUGHT.y + 8};${THOUGHT.x + 75} ${THOUGHT.y - 4}`, 2)}
    <g>${spin([-3, 3, -3], '0 0', 0.6)}
      <g transform="scale(${FISH_SCALE.toFixed(4)}) translate(${-(FISH.box.x + FISH.box.width / 2)} ${-(FISH.box.y + FISH.box.height / 2)})">
        <g><animateTransform attributeName="transform" type="rotate" values="${wag(-12)};${wag(12)};${wag(-12)}" dur=".45s" repeatCount="indefinite"/>
          ${fishPart(FISH.tail, FISH.colours.fin)}
        </g>
        ${fishPart(FISH.back, FISH.colours.fin)}
        ${fishPart(FISH.body, FISH.colours.body)}
        ${fishPart(FISH.side, FISH.colours.fin)}
        ${fishPart(FISH.eye, FISH.colours.eye)}
      </g>
    </g>
    ${[0, 0.7, 1.3]
      .map(
        begin => `<circle r="7" fill="none" stroke="${FISH.colours.fin}" stroke-width="5" opacity="0">
          ${move('122 -6;140 -90', 1.2, begin)}
          ${fade('0;1;0', 1.2, begin)}
        </circle>`,
      )
      .join('')}
  </g>`

const NOTE = 'M10-40v52a14 11 0 1 1-8-10V-40l30 10v14z'
const pop = (begin: number, content: string) =>
  `<g opacity="0">${fade('0;1;1;0', 1.6, begin, '0;.15;.8;1')}${content}</g>`
const SYMBOLS = larger(`
  ${pop(0, `<path d="${NOTE}" transform="translate(${THOUGHT.x - 70} ${THOUGHT.y - 10}) scale(1.1)" fill="${ROSE}"/>`)}
  ${pop(0.2, `<g transform="translate(${THOUGHT.x + 6} ${THOUGHT.y - 40})"><path d="M0-34v40" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><circle cx="0" cy="30" r="9" fill="${INK}"/></g>`)}
  ${pop(0.4, `<path d="${SPARKLE}" transform="translate(${THOUGHT.x + 72} ${THOUGHT.y - 30}) scale(30)" fill="${GOLD}"/>`)}
  ${pop(0.6, `<path d="M${THOUGHT.x - 18} ${THOUGHT.y + 52}h40M${THOUGHT.x + 2} ${THOUGHT.y + 32}v40" stroke="${SKY}" stroke-width="13" stroke-linecap="round"/>`)}
  ${pop(0.8, `<path d="${HEART}" transform="translate(${THOUGHT.x + 64} ${THOUGHT.y + 44}) scale(.9)" fill="${ROSE}"/>`)}
  ${pop(0.5, `<path d="M${THOUGHT.x - 76} ${THOUGHT.y + 56}q14-14 28 0t28 0" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>`)}`)

// Four scenes take turns in the cloud, two seconds each.
const SCENES = [UNIVERSE, QUESTIONS, SWIMMING, SYMBOLS]
const SCENE_SECONDS = 2
const scene = (content: string, index: number) => `<g opacity="0">
    ${fade('0;1;1;0;0', SCENE_SECONDS * SCENES.length, index * SCENE_SECONDS, '0;.04;.21;.25;1')}
    ${content}
  </g>`

const KEYS = [0, 1, 2, 3, 4, 5, 6]
  .flatMap(column =>
    [0, 1].map(
      row =>
        `<rect x="${430 + column * 92}" y="${1760 + row * 62}" width="70" height="44" rx="10" fill="#E8E9EC"/>`,
    ),
  )
  .join('')

// The talking mouth is a round opening cut off along the top of the lip line,
// a little inside it, so the line covers the cut and no white shows between.
// Its bottom is one smooth curve that drops and widens as it opens.
const MOUTH_TOP = 612
const OPENINGS = [0.2, 0.9, 0.4, 1, 0.2]
const mouthBottom = (open: number) => 646 + 34 * open
const mouthHalfWidth = (open: number) => 30 + 8 * open
const mouthCentre = (open: number) => (MOUTH_TOP + mouthBottom(open)) / 2
const mouthHalfHeight = (open: number) => (mouthBottom(open) - MOUTH_TOP) / 2
const opening = (name: string, value: (open: number) => number) =>
  `<animate attributeName="${name}" values="${OPENINGS.map(value).join(';')}" dur=".9s" repeatCount="indefinite"/>`

const hearts = (spots: number[][]) =>
  spots
    .map(
      ([x = 0, y = 0, size = 1, begin = 0]) => `<g opacity="0">
        ${move(`${x} ${y};${x + 24} ${y - 150}`, 1.8, begin)}
        ${fade('0;1;1;0', 1.8, begin, '0;.15;.7;1')}
        <path d="${HEART}" transform="scale(${size * 2})" fill="${ROSE}"/>
      </g>`,
    )
    .join('')

const TEAR = 'M0-34C14-10 24 4 24 18A24 24 0 0 1-24 18C-24 4-14-10 0-34Z'

const falling = (x: number, y: number, size: number, drop: number, begin: number) =>
  `<g opacity="0">
    ${move(`${x} ${y};${x} ${y + drop}`, 2.2, begin)}
    ${fade('0;1;1;0', 2.2, begin, '0;.15;.7;1')}
    <path d="${TEAR}" transform="scale(${size})" fill="#8CC4EC"/>
  </g>`

// A fur line takes the shade that shows on the fur beneath it, in each coat;
// a coat without patches is white beneath them all.
const LINE_ON = { white: 'line', orange: 'tickDark', dark: 'tickLight' } as const

// The ear tips have a fade of their own, so their depth can differ from the rest.
type Fade = 'points' | 'ears'
const fadeId = (coat: CoatArt, fade: Fade) => (fade === 'ears' ? `points-${coat.name}-ears` : `points-${coat.name}`)

/** A pointed coat's soft spots, each darkest in its middle and fading out. */
const softSpots = (coat: CoatArt, spots: Spot[] = [], fade: Fade = 'points') =>
  spots
    .map(({ cx, cy, rx, ry }) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${fadeId(coat, fade)})"/>`)
    .join('')

// How dark a spot is from its middle (0) to its rim (1): easing out to nothing,
// flat at the rim, so no edge shows where it ends.
const FADE_STEPS = 12
const fadeAt = (along: number) => (1 - along ** 2) ** 2

/** The fades a pointed coat's spots share, for a drawing to define once. */
const pointsFade = (coat: CoatArt) => {
  if (coat.points === undefined) {
    return ''
  }

  const { colour, strength, earStrength } = coat.points
  const gradient = (fade: Fade, depth: number) => {
    const stops = Array.from({ length: FADE_STEPS + 1 }, (_, step) => {
      const along = step / FADE_STEPS

      return `<stop offset="${Math.round(along * 1000) / 1000}" stop-color="${colour}" stop-opacity="${Math.round(depth * fadeAt(along) * 1000) / 1000}"/>`
    })

    return `<radialGradient id="${fadeId(coat, fade)}">${stops.join('')}</radialGradient>`
  }

  return `<defs>${gradient('points', strength)}${gradient('ears', earStrength)}</defs>`
}

/** A coat's fur: its patches, the shared fur lines over them in its shades, and any soft points. */
const fur = (patches: Patches, lines: FurLine[], colours: Colours, coat: CoatArt, spots: Spot[] = []) =>
  (['white', 'orange', 'dark'] as const)
    .map(shade => {
      const d = patches[shade]

      return d === undefined ? '' : `<path fill="${colours[shade]}" fill-rule="evenodd" d="${d}"/>`
    })
    .join('') +
  lines
    .map(line => `<path fill="${colours[LINE_ON[line.on[coat.name] ?? 'white']] ?? colours.line}" fill-rule="evenodd" d="${line.d}"/>`)
    .join('') +
  softSpots(coat, spots)

// The nose is the smallest piece of the pink; the ears hold the rest.
const areaOf = (d: string) => {
  const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  const xs = numbers.filter((_, i) => i % 2 === 0)
  const ys = numbers.filter((_, i) => i % 2 === 1)

  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
}
const splitNose = (pink: string) => {
  const pieces = pink.split(/(?=M)/).filter(Boolean)
  const nose = pieces.reduce((smallest, piece) => (areaOf(piece) < areaOf(smallest) ? piece : smallest))

  return { ears: pieces.filter(piece => piece !== nose).join(''), nose }
}

/** The ears' pink and the nose: pink for most coats; a pointed coat darkens its ear tips over the pink and its nose. */
const earsAndNose = (coat: CoatArt, pink: string, pinkColour: string, outline: string, id: string, ears: Spot[]) => {
  if (coat.points === undefined) {
    return `<path fill="${pinkColour}" fill-rule="evenodd" d="${pink}"/>`
  }

  const parts = splitNose(pink)

  return `<path fill="${pinkColour}" fill-rule="evenodd" d="${parts.ears}"/>
    ${trimmed(id, outline, softSpots(coat, ears, 'ears'))}
    <path fill="${coat.points.nose}" fill-rule="evenodd" d="${parts.nose}"/>`
}

/**
 * Fur trimmed to an outline both coats share. The fur reaches past it, so the
 * outline alone says where the cat ends. A mask trims the whole at once;
 * trimming each shape on its own would let a little of the shape under it
 * show along the edge.
 */
const trimmed = (id: string, outline: string, content: string) =>
  `<mask id="${id}" maskUnits="userSpaceOnUse" x="-1000" y="-1000" width="4500" height="4500">
      <path fill="#fff" d="${outline}"/>
    </mask>
    <g mask="url(#${id})">${content}</g>`

// Each whisker is one stroke, from its root on the cheek out to its fine tip.
const whiskers = ({ colour, shapes }: { colour: string; shapes: string[] }) =>
  `<g fill="${colour}">${shapes.map(d => `<path d="${d}"/>`).join('')}</g>`

/**
 * How a pose moves the head, and how the neck goes with it: still, nodding up
 * and down by so many units, or tilting from side to side by so many degrees.
 */
type HeadMove =
  | { kind: 'still' }
  | { kind: 'nodding'; from: number; to: number; dur: number }
  | { kind: 'tilting'; angle: number; dur: number }
const still: HeadMove = { kind: 'still' }
const nodding = (from: number, to: number, dur: number): HeadMove => ({ kind: 'nodding', from, to, dur })
const tilting = (angle: number, dur: number): HeadMove => ({ kind: 'tilting', angle, dur })

/** The head's own move, or the share of it a band of the neck takes. */
const moved = (headMove: HeadMove, share = 1) => {
  switch (headMove.kind) {
    case 'still':
      return ''
    case 'nodding': {
      const { from, to, dur } = headMove

      return move(`0 ${from * share};0 ${to * share};0 ${from * share}`, dur)
    }
    case 'tilting': {
      const { angle, dur } = headMove

      return spin([-angle * share, angle * share, -angle * share], HEAD_PIVOT, dur)
    }
  }
}

/** Every pose of the cat in one coat. */
// The cushion the cat sleeps on comes in these colours, chosen apart from its
// coat, each with a darker share of itself for its seams. The first is the one
// it starts on.
export const CUSHIONS = [
  { id: 'matcha', label: '抹茶綠', colour: '#9FAB87', seam: '#7D8565' },
  { id: 'milk-tea', label: '奶茶米', colour: '#E0D5C2', seam: '#B0A692' },
  { id: 'dusty-pink', label: '霧粉', colour: '#DFAAAD', seam: '#AF8482' },
  { id: 'dusty-blue', label: '霧藍', colour: '#9DB7CD', seam: '#7B8E9A' },
  { id: 'lavender', label: '薰衣草', colour: '#B7A9D0', seam: '#8F839C' },
  { id: 'night-sky', label: '夜空藍', colour: '#3D3B63', seam: '#302E4A' },
  { id: 'berry', label: '莓果紅', colour: '#B84C67', seam: '#903B4D' },
  { id: 'cement', label: '水泥灰', colour: '#8E8E90', seam: '#6F6E6C' },
] as const
export type CushionName = (typeof CUSHIONS)[number]['id']
export const DEFAULT_CUSHION: CushionName = 'matcha'
/** What the cushion is filled with: a colour, or anything else a CSS fill takes. */
export type CushionColours = { colour: string; seam: string }

// What the cat wears for where it is, on its head and beside it, sitting and
// asleep, each in that drawing's own units. What is on its head moves with
// it; beside the cat, a thing stands behind it sitting and in front of the
// cushion asleep.
export type Dress = { head: { sitting: string; lying: string }; beside: { sitting: string; lying: string } }
const BARE: Dress = { head: { sitting: '', lying: '' }, beside: { sitting: '', lying: '' } }

const posesFor = (coat: CoatArt, cushion: CushionColours, dress: Dress = BARE) => {
  const { colours } = coat
  const { eyes } = SITTING
  const tail = trimmed('sitting-tail', SITTING.outline.tail, fur(coat.patches.tail, SITTING.lines.tail, colours, coat, coat.points?.sitting.tail))
  // The rest wears one coat of fur, drawn once and shown in shares: the body,
  // each band of the neck, and the head. Named for its coat, so a page showing
  // both cats never lends one cat the other's fur.
  const furId = `sitting-fur-${coat.name}`
  const front = `${pointsFade(coat)}<defs><g id="${furId}">${fur(coat.patches.front, SITTING.lines.front, colours, coat, coat.points?.sitting.fur)}</g></defs>`
  const share = (id: string, outline: string) => trimmed(id, outline, `<use href="#${furId}"/>`)
  const body = `${front}${share('sitting-body', SITTING.outline.body)}`
  // The neck goes with the head, so its edges run on smoothly into the head's
  // and the body's rather than stepping where they meet. Nodding, it squashes
  // and stretches evenly, its top with the head and its foot on the body.
  // Tilting, it bends: each band turns more the nearer the head it lies.
  const wholeNeck = share('sitting-neck', SITTING.outline.wholeNeck)
  const { top, bottom } = SITTING.neck
  const squashed = (dy: number) => `1 ${Math.round((1 - dy / (bottom - top)) * 10000) / 10000}`
  const bands = SITTING.outline.neck.length
  const neck = (headMove: HeadMove) => {
    switch (headMove.kind) {
      case 'still':
        return wholeNeck
      case 'nodding': {
        const { from, to, dur } = headMove

        return `<g transform="translate(0 ${bottom})"><g>
            <animateTransform attributeName="transform" type="scale" values="${squashed(from)};${squashed(to)};${squashed(from)}" dur="${dur}s" repeatCount="indefinite"/>
            <g transform="translate(0 ${-bottom})">${wholeNeck}</g>
          </g></g>`
      }
      case 'tilting':
        return SITTING.outline.neck
          .map((outline, band) => `<g>${moved(headMove, 1 - (band + 0.5) / bands)}${share(`sitting-neck-${band}`, outline)}</g>`)
          .reverse()
          .join('')
    }
  }
  // The ears and nose; the coat's fur shows through the gaps in the ears' pink.
  const head = `${share('sitting-head', SITTING.outline.head)}
    ${earsAndNose(coat, SITTING.pink, colours.pink, SITTING.outline.head, 'sitting-ear-tips', coat.points?.sitting.ears ?? [])}
    ${whiskers(SITTING.whiskers)}`
  const mouth = `<path fill="${colours.ink}" fill-rule="evenodd" d="${SITTING.mouth}"/>`
  /** The body, the bending neck, and the head on top with whatever goes with it. */
  const sittingUp = (headMove: HeadMove, withHead: string, theBody = body) =>
    `${theBody}${neck(headMove)}<g>${moved(headMove)}${head}${withHead}${dress.head.sitting}</g>`
  /** A sitting pose, with what is beside the cat behind it. */
  const sat = (content: string) => frame(`${dress.beside.sitting}${content}`)
  // The left front paw tapping: the body without it, the leg stretching from
  // where it leaves the body as the paw reaches, and squashing a little from
  // there as the paw lifts to tap; and the paw on its end.
  const { top: legTop, joint: legJoint } = SITTING.tap
  const legLength = legJoint - legTop
  const ratio = (value: number) => Math.round(value * 10000) / 10000
  const bodyBesidePaw = `${front}${share('sitting-body-beside-paw', SITTING.outline.bodyBesidePaw)}`
  const tappingPaw = `<g transform="translate(0 ${legTop})"><g>
        ${reaching('scale', `reach-leg ${legLength}`, `1 1;1 ${ratio((legLength + TAP_REACH) / legLength)}`)}
        <g>${tapping(lifted => `1 ${ratio((legLength + TAP_REACH - lifted * TAP_HEIGHT) / (legLength + TAP_REACH))}`, 'scale', `tap-leg ${legLength}`)}
          <g transform="translate(0 ${-legTop})">${share('sitting-tap-leg', SITTING.outline.tapLeg)}</g>
        </g>
      </g></g>
    <g>${reaching('translate', 'reach-paw', `0 0;0 ${TAP_REACH}`)}
      <g>${tapping(lifted => `0 ${-lifted * TAP_HEIGHT}`, 'translate', 'tap-paw')}${share('sitting-tap-paw', SITTING.outline.tapPaw)}</g>
    </g>`
  const asleep = coat.lying
  const lyingInk = asleep.colours.ink
  // Asleep, the face's point goes with the head, the paws' with the body.
  const [lyingFace, ...lyingPaws] = coat.points?.lying.fur ?? []
  const lyingSpots = { head: lyingFace === undefined ? [] : [lyingFace], body: lyingPaws, tail: coat.points?.lying.tail ?? [] }
  const dressedAsleep = (part: Part) =>
    trimmed(`lying-${part}`, LYING.outline[part], fur(asleep.patches[part], LYING.lines[part], asleep.colours, coat, lyingSpots[part]))

  const swaying = (dur: number) => `<g>${spin([-4, 5, -4], TAIL_PIVOT, dur)}${tail}</g>`

  // Open eyes are one flat colour: ink, or a pointed coat's own.
  const eyeColour = coat.points?.eye ?? colours.ink
  const blink = (ry: number) =>
    `<animate attributeName="ry" values="${ry};${ry};2;${ry}" keyTimes="0;.92;.96;1" dur="3.6s" repeatCount="indefinite"/>`
  const openEye = (cx: number, cy: number, rx: number, ry: number, blinks: boolean) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${eyeColour}">${blinks ? blink(ry) : ''}</ellipse>`
  const openEyes = (lookX = 0, lookY = 0) =>
    eyes.map(({ cx, cy, rx, ry }) => openEye(cx + lookX, cy + lookY, rx, ry, true)).join('')

  const arcEyes = (dip: number) =>
    eyes
      .map(
        ({ cx, cy }) =>
          `<path d="M${cx - 27} ${cy - dip / 4}q27 ${dip} 54 0" fill="none" stroke="${colours.ink}" stroke-width="10" stroke-linecap="round"/>`,
      )
      .join('')

  const lying = ({
    headMove,
    face,
    tailMove,
    around,
  }: {
    headMove: string
    face: string
    tailMove: string
    around: string
  }) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-33 -428 2574 2574">
      ${pointsFade(coat)}
      <path style="fill:${cushion.colour}" d="${LYING.cushion}"/>
      <path style="fill:${cushion.seam}" fill-rule="evenodd" d="${LYING.seams}"/>
      ${dressedAsleep('body')}
      <g>${tailMove}${dressedAsleep('tail')}</g>
      <g>${headMove}${dressedAsleep('head')}
        ${earsAndNose(coat, LYING.pink, asleep.colours.pink, LYING.outline.head, 'lying-ear-tips', coat.points?.lying.ears ?? [])}
        ${whiskers(LYING.whiskers)}${face}${dress.head.lying}
      </g>
      ${around}${dress.beside.lying}
    </svg>`

  /** Dozing off sitting up with its eyes shut, the moment the work is done. */
  const DOZING = sat(`
    ${swaying(6)}
    ${sittingUp(nodding(0, 10, 3.6), `${mouth}${arcEyes(26)}`)}
    ${floatingZs(
      [
        ['M1240 350h46l-46 56h46', 0],
        ['M1330 260h66l-66 80h66', 1],
        ['M1450 130h88l-88 106h88', 2],
      ],
      '0 0;50 -90',
      16,
    )}`)

  /** Asleep on its cushion with its eyes shut, once nothing has come up for a while. */
  const RESTING = lying({
    headMove: move('0 0;0 16;0 0', 3.6),
    face: `<path fill="${lyingInk}" fill-rule="evenodd" d="${LYING.mouth}"/>
      <path fill="${lyingInk}" fill-rule="evenodd" d="${LYING.closedEyes}"/>`,
    tailMove: flick([-2, 2.5, -2], 6),
    around: floatingZs(
      [
        ['M1380 620h60l-60 72h60', 0],
        ['M1490 500h84l-84 100h84', 1],
        ['M1640 340h110l-110 132h110', 2],
      ],
      '0 0;60 -110',
      20,
    ),
  })

  /** Looking at the person and tapping the table, while a question or a permission waits for them. */
  const CALLING = sat(`
    ${swaying(4)}
    ${sittingUp(still, `${mouth}${openEyes()}`, `${bodyBesidePaw}${tappingPaw}`)}
    ${CALL_BUBBLE}`)

  /** Glancing from side to side, while a request is on its way. */
  const WAITING = sat(`
    ${swaying(4)}
    ${sittingUp(still, mouth)}
    <g>${move('0 0;14 0;14 0;-14 0;-14 0;0 0', 3.2)}${openEyes()}</g>`)

  /** Looking up at a thought cloud of little things it is turning over, while the model thinks. */
  const THINKING = sat(`
    ${swaying(3.4)}
    ${sittingUp(tilting(3, 3.4), `${mouth}${openEyes(8, -8)}`)}
    <g>${move('0 0;0 -8;0 0', 3.4)}
      ${TRAIL}
      <g transform="${CLOUD_HOLD}">
        ${CLOUD}
        <g clip-path="url(#thought-cloud)">${SCENES.map(scene).join('')}</g>
      </g>
    </g>`)

  // A pointed coat's paws are darker toward their tips.
  const pawTapping = (cx: number, fill: string, begin: number) =>
    `<g>${move('0 0;0 -36;0 0', 0.44, begin)}
      <ellipse cx="${cx}" cy="1704" rx="74" ry="50" fill="${fill}" stroke="${colours.line}" stroke-width="6"/>
      ${coat.points === undefined ? '' : `<ellipse cx="${cx}" cy="1728" rx="80" ry="58" fill="url(#${fadeId(coat, 'points')})"/>`}
    </g>`

  /** Tapping away at a keyboard, while a tool runs. */
  const WORKING = sat(`
    ${swaying(2.2)}
    ${sittingUp(nodding(0, 14, 0.88), `${mouth}${openEyes(0, 10)}`)}
    <rect x="396" y="1722" width="720" height="176" rx="34" fill="#8B8F97"/>
    ${KEYS}
    ${pawTapping(555, coat.paws[0] ?? colours.white, 0)}
    ${pawTapping(760, coat.paws[1] ?? colours.white, 0.22)}
    <path d="M1330 210l28 66 66 28-66 28-28 66-28-66-66-28 66-28z" fill="${GOLD}">
      ${fade('0;1;0', 1.3)}
    </path>`)

  // The opening's top follows the lip line.
  const [lipsLeft = 780, , lipsRight = 900] = SITTING.mouthBox
  const openMouth = `<clipPath id="talking-mouth"><path transform="translate(0 3)" d="${SITTING.mouthTop}L${lipsRight} 720L${lipsLeft} 720Z"/></clipPath>
    <ellipse clip-path="url(#talking-mouth)" cx="${(lipsLeft + lipsRight) / 2}" cy="${mouthCentre(0.2)}" rx="${mouthHalfWidth(0.2)}" ry="${mouthHalfHeight(0.2)}" fill="#8C3B3B">
      ${opening('cy', mouthCentre)}${opening('ry', mouthHalfHeight)}${opening('rx', mouthHalfWidth)}
    </ellipse>`

  /** Smiling and chatting away, while the reply comes in. */
  const TALKING = sat(`
    ${swaying(1.6)}
    ${sittingUp(nodding(0, 8, 0.9), `${openMouth}${mouth}${arcEyes(-26)}`)}
    <path d="M1290 70h390a50 50 0 0 1 50 50v150a50 50 0 0 1-50 50h-300l-110 70 26-70a50 50 0 0 1-56-50V120a50 50 0 0 1 50-50z" ${BUBBLE}/>
    ${[1370, 1485, 1600]
      .map(
        (cx, index) => `<circle cx="${cx}" cy="200" r="26" fill="${INK}">
          ${move('0 0;0 -36;0 0', 0.9, index * 0.15)}
        </circle>`,
      )
      .join('')}`)

  /** Leaning into a hand on its head, eyes shut. */
  const PET_HEAD = sat(`
    ${swaying(3)}
    ${sittingUp(nodding(14, 26, 0.7), `${mouth}${arcEyes(-26)}`)}
    ${hearts([
      [1240, 330, 1.5, 0],
      [1360, 240, 1, 0.6],
      [400, 300, 1.2, 1.1],
    ])}`)

  const happyCushionEyes = LYING.eyes
    .map(
      ({ cx, cy }) =>
        `<path d="M${cx - 50} ${cy + 12}q50 -52 100 0" fill="none" stroke="${colours.ink}" stroke-width="15" stroke-linecap="round"/>`,
    )
    .join('')

  /** Still on its cushion, pressing its head into the hand. */
  const REST_HEAD = lying({
    headMove: move('0 8;0 34;0 8', 0.7),
    face: `<path fill="${lyingInk}" fill-rule="evenodd" d="${LYING.mouth}"/>${happyCushionEyes}`,
    tailMove: flick([-2, 3, -2], 3),
    around: hearts([
      [1420, 700, 2, 0],
      [1600, 560, 1.4, 0.6],
      [330, 720, 1.6, 1.1],
    ]),
  })

  // Each eye droops under a heavy lid: a slanting stroke across its top, thin at the
  // outer corner and thick toward the nose, with nothing of the eye above it.
  const sadEyes = eyes
    .map(({ cx, cy, rx, ry }, index) => {
      const inward = index === 0 ? 1 : -1
      const [outerX, outerY, innerX, innerY] = [cx - inward * 40, cy - 4, cx + inward * 30, cy - 29]
      const length = Math.hypot(innerX - outerX, innerY - outerY)
      const across = (width: number): [number, number] => [
        ((outerY - innerY) / length) * width,
        ((innerX - outerX) / length) * width,
      ]
      const [thinX, thinY] = across(4)
      const [thickX, thickY] = across(8.5)
      const round = (value: number) => Math.round(value * 10) / 10

      return `<clipPath id="sad-lid-${index}">
          <path d="M${outerX} ${outerY}L${innerX} ${innerY}V${cy + 80}H${outerX}Z"/>
        </clipPath>
        <ellipse cx="${cx}" cy="${cy + 8}" rx="${rx + 5}" ry="${ry + 6}" fill="${eyeColour}" clip-path="url(#sad-lid-${index})"/>
        <g fill="${colours.ink}">
          <path d="M${round(outerX + thinX)} ${round(outerY + thinY)}L${round(innerX + thickX)} ${round(innerY + thickY)}L${round(innerX - thickX)} ${round(innerY - thickY)}L${round(outerX - thinX)} ${round(outerY - thinY)}Z"/>
          <circle cx="${outerX}" cy="${outerY}" r="4"/>
          <circle cx="${innerX}" cy="${innerY}" r="8.5"/>
        </g>`
    })
    .join('')

  const frown = `<path d="M838 592V624" fill="none" stroke="${colours.ink}" stroke-width="7" stroke-linecap="round"/>
    <path d="M808 649L838 624L868 649" fill="none" stroke="${colours.ink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`

  /** Head hung and crying under a little raincloud, having got something wrong. */
  const SAD = sat(`
    <g>${spin([8, 11, 8], TAIL_PIVOT, 5)}${tail}</g>
    ${sittingUp(
      nodding(34, 46, 3.2),
      `${frown}${sadEyes}${falling(690, 590, 0.9, 170, 0)}${falling(985, 605, 0.9, 170, 1.1)}`,
    )}
    <g>${move('0 0;0 10;0 0', 3.6)}
      <g fill="#9AA0AA">
        <circle cx="1250" cy="190" r="62"/>
        <circle cx="1350" cy="150" r="86"/>
        <circle cx="1450" cy="195" r="58"/>
        <rect x="1250" y="190" width="200" height="62" rx="30"/>
      </g>
    </g>
    ${falling(1270, 280, 0.5, 120, 0)}
    ${falling(1350, 280, 0.5, 120, 0.7)}
    ${falling(1430, 280, 0.5, 120, 1.4)}`)

  /** The still face beside each reply. */
  const AVATAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="428 20 820 820">
    <clipPath id="round"><circle cx="838" cy="430" r="410"/></clipPath>
    <circle cx="838" cy="430" r="410" fill="#E8DCD6"/>
    <g clip-path="url(#round)">${sittingUp(
      still,
      `${mouth}${eyes.map(({ cx, cy, rx, ry }) => openEye(cx, cy, rx, ry, false)).join('')}`,
    )}</g>
  </svg>`

  return { RESTING, DOZING, WAITING, CALLING, THINKING, WORKING, TALKING, PET_HEAD, REST_HEAD, SAD, AVATAR }
}

const ART = { calico: CALICO, tuxedo: TUXEDO, siamese: SIAMESE }
const STARTING_CUSHION = CUSHIONS[0]

/** The cat's coats, each with every pose, asleep on the cushion it starts on. */
export const COATS = {
  calico: posesFor(CALICO, STARTING_CUSHION),
  tuxedo: posesFor(TUXEDO, STARTING_CUSHION),
  siamese: posesFor(SIAMESE, STARTING_CUSHION),
}
export type CoatName = keyof typeof COATS
export type Poses = (typeof COATS)[CoatName]
export const DEFAULT_COAT: CoatName = 'calico'

const dressed = new Map<string, Poses>()

/** What the cat wears and has beside it in a place. */
const dressFor = (place: PlaceName): Dress => ({ head: PLACE_ART[place].head, beside: PLACE_ART[place].beside })

/** Every pose in a coat, asleep on a cushion of these colours, dressed for a place or none; drawn once each. */
export function posesOn(coat: CoatName, cushion: CushionColours, place?: PlaceName): Poses {
  const key = `${coat} ${cushion.colour} ${cushion.seam} ${place ?? ''}`
  let poses = dressed.get(key)

  if (poses === undefined) {
    poses = posesFor(ART[coat], cushion, place === undefined ? BARE : dressFor(place))
    dressed.set(key, poses)
  }

  return poses
}

/** Every pose in a coat in a dress of any kind, such as marks a page fills in for each place itself. */
export const posesWearing = (coat: CoatName, cushion: CushionColours, dress: Dress): Poses =>
  posesFor(ART[coat], cushion, dress)

/** The colours of a cushion by its name, or of the one it starts on for any other. */
export const cushionColours = (name: unknown): CushionColours =>
  CUSHIONS.find(cushion => cushion.id === name) ?? STARTING_CUSHION
