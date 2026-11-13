const assert = require('node:assert/strict')
const { test } = require('node:test')

const linux = require('../src/platform/linux')

test("on Linux the cat's window is a toolbar, which taskbars and docks leave out", () => {
  // skipTaskbar does nothing there; a dock window could never be let down from on top.
  assert.equal(linux.windowOptions.type, 'toolbar')
})

test("on Linux the cat's window has square corners, so none of the cat is cut off", () => {
  assert.equal(linux.windowOptions.roundedCorners, false)
})

test("on a screen that is scaled, Electron's own work area is used, not GNOME's", () => {
  const workArea = { x: 0, y: 27, width: 1280, height: 693 }
  const display = { scaleFactor: 2, bounds: { x: 0, y: 0, width: 1280, height: 720 }, workArea }
  assert.equal(linux.workAreaOf(display), workArea)
})
