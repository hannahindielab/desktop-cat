// Where the pointer is, for a window that clicks go through: Linux passes no
// mouse moves on to such a window, and a macOS panel never hears them either,
// so the main process reads the pointer every so often and tells the page
// while it is over the window. The page then decides, as it does on Windows,
// whether the pointer is on the cat and the window should take the clicks.

const POLL_EVERY_MS = 50

const isInside = (point, box) =>
  point.x >= box.x && point.x < box.x + box.width && point.y >= box.y && point.y < box.y + box.height

/** getCursor and getBounds answer in screen points; send(channel, data) tells
    the page. cat:pointer, with the point within the window, is sent while the
    pointer is over the window and only when it has moved; cat:pointer-out
    once as it leaves. resend() has the next look send it again, moved or not. */
function createPointerPoller({ getCursor, getBounds, isVisible, send }) {
  let timer = null
  let wasInside = false
  let lastSent = null

  function leave() {
    if (wasInside) {
      wasInside = false
      lastSent = null
      send('cat:pointer-out')
    }
  }

  function tick() {
    if (!isVisible()) {
      leave()
      return
    }

    const cursor = getCursor()
    const bounds = getBounds()

    if (!isInside(cursor, bounds)) {
      leave()
      return
    }

    const point = { x: cursor.x - bounds.x, y: cursor.y - bounds.y }
    wasInside = true

    if (lastSent === null || lastSent.x !== point.x || lastSent.y !== point.y) {
      lastSent = point
      send('cat:pointer', point)
    }
  }

  return {
    tick,

    resend() {
      lastSent = null
    },

    start(everyMs = POLL_EVERY_MS) {
      if (timer === null) {
        timer = setInterval(tick, everyMs)
      }
    },

    stop() {
      clearInterval(timer)
      timer = null
    },
  }
}

module.exports = { POLL_EVERY_MS, createPointerPoller }
