const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const { cansOf, levelOf, parseUsage, readUsage, usageLeft } = require('../src/usage')

const NOW = Date.parse('2026-11-04T06:00:00Z')
const reading = (fiveHour, sevenDay) => JSON.stringify({ fiveHour, sevenDay, seenAt: NOW })

test('what is left of this meal and of the week, in whole percent', () => {
  const usage = parseUsage(
    reading(
      { percentUsed: 34, resetsAt: '2026-11-04T09:00:00Z' },
      { percentUsed: 6.5, resetsAt: '2026-11-11T19:00:00Z' },
    ),
  )

  assert.deepEqual(usageLeft(usage, NOW), { meal: 66, week: 94 })
})

test('a window whose fill time has passed is full again, Claude used or not', () => {
  const usage = parseUsage(reading({ percentUsed: 100, resetsAt: '2026-11-04T05:00:00Z' }, { percentUsed: 40 }))

  assert.deepEqual(usageLeft(usage, NOW), { meal: 100, week: 60 })
})

test('only a window used up reads as eaten; a last sliver still counts', () => {
  const usage = parseUsage(reading({ percentUsed: 99.6 }, { percentUsed: 100 }))

  assert.deepEqual(usageLeft(usage, NOW), { meal: 1, week: 0 })
})

test('nothing known of a window: null, and the cans show a full stack', () => {
  const usage = parseUsage(JSON.stringify({ fiveHour: { percentUsed: 12 } }))
  const left = usageLeft(usage, NOW)

  assert.deepEqual(left, { meal: 88, week: null })
  assert.equal(cansOf(left), 5)
  assert.deepEqual(usageLeft(null, NOW), { meal: null, week: null })
})

test('one can for every fifth of the week begun; the open one full, low or eaten', () => {
  assert.deepEqual([100, 81, 80, 61, 41, 21, 20, 1, 0].map(week => cansOf({ week })), [5, 5, 4, 4, 3, 2, 1, 1, 0])
  assert.deepEqual([100, 20, 19, 1, 0, null].map(meal => levelOf({ meal })), ['full', 'full', 'low', 'low', 'empty', 'full'])
})

test('a reading caught half written keeps the one before it', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-cat-usage-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const file = path.join(root, 'usage.json')
  const before = { meal: { percentUsed: 10, resetsAt: null }, week: null }

  assert.equal(readUsage(file, null), null)
  fs.writeFileSync(file, '{"fiveHour": {"percentUs')
  assert.equal(readUsage(file, before), before)
  fs.writeFileSync(file, reading({ percentUsed: 50 }, null))
  assert.deepEqual(readUsage(file, before), { meal: { percentUsed: 50, resetsAt: null }, week: null })
})
