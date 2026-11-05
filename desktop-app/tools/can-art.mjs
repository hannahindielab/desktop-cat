// The food cans that sit beside the desktop cat and show how much of
// Claude's usage is left, drawn as SVG: up to five cans for the week, the
// highest open with this meal's food in it. The desktop cat's own drawing
// (tools/build-cans.mjs writes src/cans.js from it); the try-out pages in
// art-tools draw from it too.
// The same ink as the cat's bubbles and thought cloud, so the cans read as its things.
export const INK = '#816C6A'
export const LABEL = '#EE9A86'
// The tin, its inside and the food. The inside is dark and the rim and lid
// light, so the food stands out against both even when small: each pair that
// meet differ at least 2.4 times in lightness, the rim and the inside 6.6.
export const COLOURS = {
  tin: '#F3F5F7',
  shade: '#C7CED6',
  ridge: '#A3ACB6',
  inside: '#4F5864',
  bottom: '#8C97A3',
  // The food takes its colours from the page, so the try-out can switch meats.
  food: 'var(--food, #C98A76)',
  foodDark: 'var(--food-dark, #93584A)',
  foodLight: 'var(--food-light, #E4B3A2)',
}
// The meats a person may fill the cans with, tuna first, each as far from the
// lid and the inside in lightness as needed to read small (2.2 to 3.2 times):
// the food, its chunks, its shine.
export const FOODS = [
  { id: 'tuna', label: '鮪魚', food: '#C98A76', dark: '#93584A', light: '#E4B3A2' },
  { id: 'salmon', label: '鮭魚', food: '#D99282', dark: '#A35B4C', light: '#F0BDB1' },
  { id: 'chicken', label: '雞肉', food: '#C9A07F', dark: '#946A4C', light: '#E6C7AD' },
  { id: 'beef', label: '牛肉', food: '#B07D63', dark: '#7E5240', light: '#CC9C84' },
]
// As they were before, kept to compare.
export const BEFORE = {
  tin: '#E3E7EB',
  shade: '#C9CFD6',
  ridge: '#B3BAC2',
  inside: '#9AA2AB',
  bottom: '#BFC6CE',
  food: '#E9A27D',
  foodDark: '#CF8461',
  foodLight: '#F7CBAA',
}

// In the can's own 200 square: the rim's ellipse at y 92, the opening inside
// it, the body down to its foot at y 162 (bottom edge 186).
const BODY = 'M34 92V162A66 24 0 0 0 166 162V92Z'
const food = {
  // Heaped up over the rim, lumpy, with a few chunks in it.
  full: (id, c) => `<g clip-path="url(#hole-up-${id})">
      <path d="M44 93C40 74 56 60 70 63C78 50 96 49 105 57C116 47 136 51 141 64C154 67 160 79 156 93L156 125H44Z" style="fill:${c.food};stroke:${c.foodDark}" stroke-width="3" stroke-linejoin="round"/>
      <g style="fill:${c.foodDark}">
        <ellipse cx="76" cy="80" rx="8" ry="4.5"/>
        <ellipse cx="120" cy="76" rx="7" ry="4"/>
        <ellipse cx="98" cy="94" rx="6" ry="3.5"/>
        <ellipse cx="132" cy="96" rx="5" ry="3"/>
      </g>
      <path d="M86 60c6-4 14-4 18 0M124 58c5-2 10-1 13 2" fill="none" style="stroke:${c.foodLight}" stroke-width="4" stroke-linecap="round"/>
    </g>`,
  // Sunk well down the can: the inner wall shows above a thin layer.
  low: (id, c) => `<g clip-path="url(#hole-${id})">
      <ellipse cx="100" cy="108" rx="54" ry="15" style="fill:${c.food}"/>
      <g style="fill:${c.foodDark}">
        <ellipse cx="80" cy="102" rx="7" ry="3.5"/>
        <ellipse cx="122" cy="100" rx="6" ry="3"/>
      </g>
      <path d="M94 97c5-2 11-2 15 0" fill="none" style="stroke:${c.foodLight}" stroke-width="4" stroke-linecap="round"/>
    </g>`,
  // Licked clean.
  empty: (id, c) => `<g clip-path="url(#hole-${id})">
      <ellipse cx="100" cy="124" rx="50" ry="15" fill="${c.bottom}"/>
      <path d="M62 86c10-6 24-8 36-8" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>
    </g>`,
}

let serial = 0

const body = (id, c) => `<clipPath id="body-${id}"><path d="${BODY}"/></clipPath>
    <path d="${BODY}" fill="${c.shade}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <g clip-path="url(#body-${id})">
      <path d="M34 108A66 24 0 0 0 166 108V146A66 24 0 0 1 34 146Z" style="fill:var(--label, ${LABEL})"/>
      <rect x="46" y="80" width="12" height="110" fill="#fff" opacity=".35"/>
      <path d="M34 154A66 24 0 0 0 166 154" fill="none" stroke="${c.ridge}" stroke-width="4"/>
    </g>`

// Open, its lid hung on the back edge of the opening (100, 75) and standing
// up, leaning back a little: its long axis level like the opening's, rounder
// the more upright it stands, its inside towards us; the ring, on its
// outside, peeks over its far edge.
const openTop = (level, id, c) => `<clipPath id="hole-${id}"><ellipse cx="100" cy="93" rx="56" ry="18"/></clipPath>
    <clipPath id="hole-up-${id}"><path d="M44 93A56 18 0 0 0 156 93V-60H44Z"/></clipPath>
    <ellipse cx="100" cy="92" rx="66" ry="24" fill="${c.tin}" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="100" cy="-15" rx="14" ry="8" fill="none" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="100" cy="33" rx="56" ry="42" fill="${c.tin}" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="100" cy="35" rx="43" ry="31" fill="none" stroke="${c.ridge}" stroke-width="3"/>
    <path d="M64 20c6-11 20-18 34-19" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="100" cy="93" rx="56" ry="18" fill="${c.inside}"/>
    ${food[level](id, c)}
    <path d="M34 92A66 24 0 0 0 166 92L156 93A56 18 0 0 1 44 93Z" fill="${c.tin}"/>
    <path d="M44 93A56 18 0 0 0 156 93" fill="none" stroke="${c.ridge}" stroke-width="3"/>
    <path d="M34 92A66 24 0 0 0 166 92" fill="none" stroke="${INK}" stroke-width="5"/>`

// Shut, with its ring lying flat near the front.
const closedTop = c => `<ellipse cx="100" cy="92" rx="66" ry="24" fill="${c.tin}" stroke="${INK}" stroke-width="5"/>
    <ellipse cx="100" cy="93" rx="56" ry="18" fill="none" stroke="${c.ridge}" stroke-width="3"/>
    <path d="M100 94V100" stroke="${c.ridge}" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="100" cy="104" rx="13" ry="5.5" fill="none" stroke="${INK}" stroke-width="4"/>`

/** One can in its own 200 square: open with food as full as `level`, or shut. */
function can(level, c) {
  const id = `can${(serial += 1)}`

  return `${body(id, c)}${level === undefined ? closedTop(c) : openTop(level, id, c)}`
}

// Across from one can's middle to the next, and up from one row's foot to the next.
const ACROSS = 140
const UP = 70
// A full week's food is five cans, three below and two on top. One goes for
// every fifth of the week used, always from the same places, top first and
// right before left, so the stack never changes its shape, only loses cans.
// The highest can left stands open: this meal. The places, by row from the
// bottom and across from the middle, in the order they empty.
const PLACES = [
  { row: 1, across: 0.5 },
  { row: 1, across: -0.5 },
  { row: 0, across: 1 },
  { row: 0, across: 0 },
  { row: 0, across: -1 },
]
// The full stack's frame, the same whatever is left: past the outer cans'
// sides, below their feet, and up to the ring of a top can's lid.
export const FRAME = { left: -ACROSS - 69, right: ACROSS + 69, top: -UP - 162 - 26, bottom: 27 }

/** How many cans are left with this share of the week left, in percent: one for each fifth begun. */
export const cansFor = weekLeft => Math.ceil(weekLeft / 20)

/**
 * The cans with this share of the week left, the open one's food as full as
 * `level`. With the week eaten up, one empty can stays, so the stack never
 * simply vanishes.
 */
export function stack(weekLeft, level = 'full', c = COLOURS) {
  const count = cansFor(weekLeft)
  const left = count === 0 ? PLACES.slice(-1) : PLACES.slice(PLACES.length - count)
  const placed = [...left]
    .sort((a, b) => a.row - b.row)
    .map(
      place =>
        `<g transform="translate(${place.across * ACROSS - 100} ${-place.row * UP - 162})">${can(place !== left[0] ? undefined : count === 0 ? 'empty' : level, c)}</g>`,
    )

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FRAME.left} ${FRAME.top} ${FRAME.right - FRAME.left} ${FRAME.bottom - FRAME.top}">${placed.join('')}</svg>`
}

// The colours a person may give the cans' labels: the coral they start in,
// then the cushion's eight.
export const LABEL_COLOURS = [
  { id: 'coral', label: '珊瑚粉', colour: LABEL },
  { id: 'matcha', label: '抹茶綠', colour: '#9FAB87' },
  { id: 'milk-tea', label: '奶茶米', colour: '#E0D5C2' },
  { id: 'dusty-pink', label: '霧粉', colour: '#DFAAAD' },
  { id: 'dusty-blue', label: '霧藍', colour: '#9DB7CD' },
  { id: 'lavender', label: '薰衣草', colour: '#B7A9D0' },
  { id: 'night-sky', label: '夜空藍', colour: '#3D3B63' },
  { id: 'berry', label: '莓果紅', colour: '#B84C67' },
  { id: 'cement', label: '水泥灰', colour: '#8E8E90' },
]
