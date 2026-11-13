// Each screen's real work area, without the top bar and the dock. On X11,
// Electron works it out from one _NET_WORKAREA that spans every screen, so
// with screens of different heights it cuts the tallest one short: put down
// on its lower part, the cat jumped back up. GNOME (Mutter) also keeps each
// screen's own work area, in the root window's _GTK_WORKAREAS_D<desktop>.
const { execFileSync } = require('node:child_process')

const XPROP_MS = 1000

const xprop = name =>
  execFileSync('xprop', ['-root', name], { encoding: 'utf8', timeout: XPROP_MS, stdio: ['ignore', 'pipe', 'ignore'] })

const numbersIn = text =>
  (text.split('=')[1] ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '')
    .map(Number)

/** Every four numbers xprop prints are one screen's work area; none if the
    property is missing or makes no sense. */
function parseWorkAreas(text) {
  const numbers = numbersIn(text)

  if (numbers.length % 4 !== 0 || numbers.some(number => !Number.isFinite(number))) {
    return []
  }

  return Array.from({ length: numbers.length / 4 }, (_, i) => {
    const [x, y, width, height] = numbers.slice(i * 4, i * 4 + 4)
    return { x, y, width, height }
  })
}

const overlap = (a, b) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))

/** The work area that shares most with this screen; null if none is on it. */
function pickWorkArea(areas, bounds) {
  const scored = areas.map(area => ({ area, shared: overlap(area, bounds) })).filter(({ shared }) => shared > 0)

  return scored.length === 0 ? null : scored.reduce((best, next) => (next.shared > best.shared ? next : best)).area
}

/** This screen's work area on the desktop shown now; null where it cannot be
    read (no xprop, or not GNOME). */
function readWorkArea(bounds, run = xprop) {
  try {
    const [desktop = 0] = numbersIn(run('_NET_CURRENT_DESKTOP'))
    return pickWorkArea(parseWorkAreas(run(`_GTK_WORKAREAS_D${desktop}`)), bounds)
  } catch {
    return null
  }
}

module.exports = { parseWorkAreas, pickWorkArea, readWorkArea }
