const assert = require('node:assert/strict')
const { test } = require('node:test')

const { createPointerPoller } = require('../src/pointer')

// A pretend pointer, window and page: each tick() shows what would be sent.
function setup({ visible = true } = {}) {
  const state = { cursor: { x: -500, y: -500 }, bounds: { x: 100, y: 200, width: 260, height: 260 }, visible }
  const sent = []
  const poller = createPointerPoller({
    getCursor: () => state.cursor,
    getBounds: () => state.bounds,
    isVisible: () => state.visible,
    send: (channel, data) => sent.push(data === undefined ? [channel] : [channel, data]),
  })

  return { state, sent, poller }
}

test('with the pointer outside the window, nothing is sent', () => {
  const { sent, poller } = setup()
  poller.tick()
  poller.tick()
  assert.deepEqual(sent, [])
})

test('as the pointer comes over the window, its point within it is sent', () => {
  const { state, sent, poller } = setup()
  state.cursor = { x: 150, y: 260 }
  poller.tick()
  assert.deepEqual(sent, [['cat:pointer', { x: 50, y: 60 }]])
})

test('a pointer that has not moved is not sent again', () => {
  const { state, sent, poller } = setup()
  state.cursor = { x: 150, y: 260 }
  poller.tick()
  poller.tick()
  poller.tick()
  assert.equal(sent.length, 1)
  state.cursor = { x: 151, y: 260 }
  poller.tick()
  assert.deepEqual(sent.at(-1), ['cat:pointer', { x: 51, y: 60 }])
})

test('leaving the window is told once', () => {
  const { state, sent, poller } = setup()
  state.cursor = { x: 150, y: 260 }
  poller.tick()
  state.cursor = { x: 900, y: 900 }
  poller.tick()
  poller.tick()
  assert.deepEqual(sent, [['cat:pointer', { x: 50, y: 60 }], ['cat:pointer-out']])
})

test('the window moving under a still pointer counts as coming over it', () => {
  const { state, sent, poller } = setup()
  state.cursor = { x: 50, y: 50 }
  poller.tick()
  state.bounds = { x: 0, y: 0, width: 260, height: 260 }
  poller.tick()
  assert.deepEqual(sent, [['cat:pointer', { x: 50, y: 50 }]])
})

test('the right and bottom edges are outside the window', () => {
  const { state, sent, poller } = setup()
  state.cursor = { x: 360, y: 460 }
  poller.tick()
  assert.deepEqual(sent, [])
})

test('with the cat hidden nothing is sent, but leaving is told if it was over it', () => {
  const { state, sent, poller } = setup()
  state.cursor = { x: 150, y: 260 }
  poller.tick()
  state.visible = false
  poller.tick()
  state.cursor = { x: 160, y: 270 }
  poller.tick()
  assert.deepEqual(sent, [['cat:pointer', { x: 50, y: 60 }], ['cat:pointer-out']])
})

test('after the page lets go (as the menu closes), a still pointer is sent again', () => {
  const { state, sent, poller } = setup()
  state.cursor = { x: 150, y: 260 }
  poller.tick()
  poller.tick()
  poller.resend()
  poller.tick()
  assert.deepEqual(sent, [
    ['cat:pointer', { x: 50, y: 60 }],
    ['cat:pointer', { x: 50, y: 60 }],
  ])
})

test('resend sends nothing while the pointer is outside the window', () => {
  const { sent, poller } = setup()
  poller.resend()
  poller.tick()
  assert.deepEqual(sent, [])
})

// Pretend timers: counts how often the pointer is read, however busy the computer is.
function countingPoller(t) {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let reads = 0
  const poller = createPointerPoller({
    getCursor: () => {
      reads += 1
      return { x: 150, y: 260 }
    },
    getBounds: () => ({ x: 100, y: 200, width: 260, height: 260 }),
    isVisible: () => true,
    send: () => {},
  })

  return { poller, reads: () => reads }
}

test('once started it reads the pointer every so often, and stops when stopped', t => {
  const { poller, reads } = countingPoller(t)
  poller.start(50)
  t.mock.timers.tick(200)
  assert.equal(reads(), 4)
  poller.stop()
  t.mock.timers.tick(200)
  assert.equal(reads(), 4, 'no more reads once stopped')
})

test('starting twice keeps one timer', t => {
  const { poller, reads } = countingPoller(t)
  poller.start(50)
  poller.start(50)
  t.mock.timers.tick(200)
  poller.stop()
  assert.equal(reads(), 4)
})
