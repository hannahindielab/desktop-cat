const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const {
  MIN_GAP_MS,
  QUIET_MS,
  clearOldPraise,
  createPraiseBox,
  pickTarget,
  writePraise,
} = require('../src/praise')

function box(t, accepted = true) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] })
  const rounds = []
  const praise = createPraiseBox({
    now: () => Date.now(),
    deliver: round => {
      rounds.push(round)

      return accepted
    },
  })

  return { praise, rounds, tick: ms => t.mock.timers.tick(ms) }
}

test('the conversation that spoke last is praised, resting or not', () => {
  const target = pickTarget([
    { id: 'busy', mood: 'working', updatedAt: 100 },
    { id: 'done', mood: 'resting', updatedAt: 200 },
  ])

  assert.equal(target.id, 'done')
  assert.equal(pickTarget([]), null)
})

test('touches gather into one round once the petting pauses', t => {
  const { praise, rounds, tick } = box(t)

  praise.touch('head')
  tick(QUIET_MS - 1)
  praise.touch('head')
  tick(QUIET_MS - 1)
  assert.deepEqual(rounds, [])

  tick(1)
  assert.deepEqual(rounds, [{ head: 2 }])
})

test('only the head counts', t => {
  const { praise, rounds, tick } = box(t)

  praise.touch('chin')
  praise.touch('rump')
  praise.touch('tail')
  tick(QUIET_MS * 2)
  assert.deepEqual(rounds, [])
})

test('a second round waits out the gap, and more touches join it', t => {
  const { praise, rounds, tick } = box(t)

  praise.touch('head')
  tick(QUIET_MS)
  assert.equal(rounds.length, 1)

  praise.touch('head')
  tick(QUIET_MS)
  praise.touch('head')
  tick(QUIET_MS)
  assert.equal(rounds.length, 1, 'still inside the gap')

  tick(MIN_GAP_MS)
  assert.deepEqual(rounds[1], { head: 2 })
})

test('a round nobody could receive does not use up the gap', t => {
  const { praise, rounds, tick } = box(t, false)

  praise.touch('head')
  tick(QUIET_MS)
  praise.touch('head')
  tick(QUIET_MS)
  assert.equal(rounds.length, 2)
})

test('a praise is written whole, and old ones are cleared', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-cat-praise-'))

  writePraise(dir, 'abc', { head: 2 }, 1234)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'abc.json'), 'utf8')), {
    at: 1234,
    head: 2,
  })
  assert.deepEqual(fs.readdirSync(dir), ['abc.json'])

  writePraise(dir, '../escape', { head: 1 }, 1)
  assert.deepEqual(fs.readdirSync(dir).sort(), ['abc.json', 'escape.json'])

  clearOldPraise(dir, Date.now())
  assert.equal(fs.readdirSync(dir).length, 2, 'recent ones stay')
  clearOldPraise(dir, Date.now() + 2 * 24 * 60 * 60 * 1000)
  assert.deepEqual(fs.readdirSync(dir), [])
  fs.rmSync(dir, { recursive: true })
})
