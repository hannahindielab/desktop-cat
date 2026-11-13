const assert = require('node:assert/strict')
const { test } = require('node:test')

const { parseWorkAreas, pickWorkArea, readWorkArea } = require('../src/platform/workarea-linux')

// As read on GNOME with three screens: 2560×1080 on the left, 2560×1440 in
// the middle, 1920×1080 on the right.
const THREE_SCREENS = '_GTK_WORKAREAS_D0(CARDINAL) = 2560, 32, 2560, 1342, 5120, 0, 1920, 1014, 0, 0, 2560, 1014\n'
const MIDDLE = { x: 2560, y: 0, width: 2560, height: 1440 }
const RIGHT = { x: 5120, y: 0, width: 1920, height: 1080 }

test("every four numbers are one screen's work area", () => {
  assert.deepEqual(parseWorkAreas(THREE_SCREENS), [
    { x: 2560, y: 32, width: 2560, height: 1342 },
    { x: 5120, y: 0, width: 1920, height: 1014 },
    { x: 0, y: 0, width: 2560, height: 1014 },
  ])
})

test('no property, no work areas', () => {
  assert.deepEqual(parseWorkAreas('_GTK_WORKAREAS_D0:  not found.\n'), [])
})

test("each screen gets its own work area: the tall one reaches right down", () => {
  const areas = parseWorkAreas(THREE_SCREENS)
  assert.deepEqual(pickWorkArea(areas, MIDDLE), { x: 2560, y: 32, width: 2560, height: 1342 })
  assert.deepEqual(pickWorkArea(areas, RIGHT), { x: 5120, y: 0, width: 1920, height: 1014 })
})

test('no work area on this screen, none picked', () => {
  assert.equal(pickWorkArea([{ x: 0, y: 0, width: 100, height: 100 }], RIGHT), null)
})

test('a screen to the left of or above the main one, at negative points, is found too', () => {
  const areas = parseWorkAreas('_GTK_WORKAREAS_D0(CARDINAL) = -1920, 0, 1920, 1014, 0, 32, 2560, 1342\n')
  assert.deepEqual(pickWorkArea(areas, { x: -1920, y: 0, width: 1920, height: 1080 }), {
    x: -1920,
    y: 0,
    width: 1920,
    height: 1014,
  })
})

test('numbers that do not come in fours are taken as none', () => {
  assert.deepEqual(parseWorkAreas('_GTK_WORKAREAS_D0(CARDINAL) = 0, 32, 2560\n'), [])
})

test('of two work areas touching the screen, the one sharing more is picked', () => {
  const areas = [
    { x: 2500, y: 0, width: 100, height: 1080 },
    { x: 2560, y: 32, width: 2560, height: 1342 },
  ]
  assert.deepEqual(pickWorkArea(areas, MIDDLE), { x: 2560, y: 32, width: 2560, height: 1342 })
})

test('the property for the desktop shown now is the one read', () => {
  const asked = []
  const run = name => {
    asked.push(name)
    return name === '_NET_CURRENT_DESKTOP'
      ? '_NET_CURRENT_DESKTOP(CARDINAL) = 1\n'
      : '_GTK_WORKAREAS_D1(CARDINAL) = 5120, 0, 1920, 1014\n'
  }
  assert.deepEqual(readWorkArea(RIGHT, run), { x: 5120, y: 0, width: 1920, height: 1014 })
  assert.deepEqual(asked, ['_NET_CURRENT_DESKTOP', '_GTK_WORKAREAS_D1'])
})

test("where it cannot be read (no xprop, not GNOME), it is null, and Electron's is used", () => {
  const missing = () => {
    throw new Error('spawn xprop ENOENT')
  }
  assert.equal(readWorkArea(RIGHT, missing), null)
  assert.equal(readWorkArea(RIGHT, () => '_GTK_WORKAREAS_D0:  not found.\n'), null)
})
