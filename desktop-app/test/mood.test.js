const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const {
  ACTIVE_FOR_MS,
  CALL_AGAIN_MS,
  FORGET_AFTER_MS,
  SAD_AT_MOST_MS,
  SAD_AT_ONCE_MS,
  hasNewCall,
  isTimeToCallAgain,
  pickMood,
  readSessions,
  wantsCallAgain,
} = require('../src/mood')

const NOW = 1_000_000_000

test('with no conversations the cat rests', () => {
  assert.equal(pickMood([], NOW), 'resting')
})

test('one busy conversation keeps the cat up while another rests', () => {
  const sessions = [
    { mood: 'working', updatedAt: NOW - 5000 },
    { mood: 'resting', updatedAt: NOW - 10 },
  ]

  assert.equal(pickMood(sessions, NOW), 'working')
})

test('among busy conversations the latest news wins', () => {
  const sessions = [
    { mood: 'working', updatedAt: NOW - 5000 },
    { mood: 'talking', updatedAt: NOW - 10 },
    { mood: 'thinking', updatedAt: NOW - 3000 },
  ]

  assert.equal(pickMood(sessions, NOW), 'talking')
})

test('a conversation waiting on the person wins over newer busy news', () => {
  const sessions = [
    { mood: 'calling', updatedAt: NOW - 60_000 },
    { mood: 'talking', updatedAt: NOW - 10 },
  ]

  assert.equal(pickMood(sessions, NOW), 'calling')
  assert.equal(
    pickMood([{ ...sessions[0], sadAt: NOW - 2000, movedOn: false }], NOW),
    'sad',
    'told off just now, it is sad first',
  )
})

test('still waiting on the person, the cat meows again every few minutes', () => {
  assert.equal(isTimeToCallAgain('calling', NOW - CALL_AGAIN_MS + 1, NOW), false, 'not yet')
  assert.equal(isTimeToCallAgain('calling', NOW - CALL_AGAIN_MS, NOW), true)
  assert.equal(isTimeToCallAgain('working', NOW - 10 * CALL_AGAIN_MS, NOW), false, 'answered')
  assert.equal(CALL_AGAIN_MS, 3 * 60 * 1000)
})

test('a question left in the next-step box meows once; a card holding the work up meows again', () => {
  const box = { mood: 'calling', updatedAt: NOW - 1000, callsAgain: false }
  const card = { mood: 'calling', updatedAt: NOW - 1000, callsAgain: true }

  assert.equal(wantsCallAgain([box], NOW), false, 'the box: once only')
  assert.equal(wantsCallAgain([card], NOW), true, 'a card: again every few minutes')
  assert.equal(wantsCallAgain([box, card], NOW), true, 'one card waiting is enough')
  assert.equal(wantsCallAgain([{ ...card, mood: 'working' }], NOW), false, 'answered')
  assert.equal(wantsCallAgain([{ ...card, updatedAt: NOW - ACTIVE_FOR_MS - 1 }], NOW), false, 'gone quiet')
})

test('a conversation that went quiet stops counting', () => {
  const sessions = [{ mood: 'working', updatedAt: NOW - ACTIVE_FOR_MS - 1 }]

  assert.equal(pickMood(sessions, NOW), 'resting')
})

test('told off, the cat is sad at once, even while another conversation works', () => {
  const sessions = [
    { mood: 'working', updatedAt: NOW - 10 },
    { mood: 'talking', updatedAt: NOW - 500, sadAt: NOW - 2000, movedOn: false },
  ]

  assert.equal(pickMood(sessions, NOW), 'sad')
})

test('after a moment work comes first, and once all rest the cat stays sad a while', () => {
  const later = NOW + SAD_AT_ONCE_MS
  const busy = { mood: 'working', updatedAt: later - 10, sadAt: NOW, movedOn: false }
  const resting = { ...busy, mood: 'resting' }

  assert.equal(pickMood([busy], later), 'working')
  assert.equal(pickMood([resting], later), 'sad', 'nothing to do but be sad')
  assert.equal(pickMood([{ ...resting, movedOn: true }], later), 'resting', 'it got to work')
  assert.equal(pickMood([resting], NOW + SAD_AT_MOST_MS), 'resting', 'it cheers up by itself')
})

test('a pat on the head comforts a sad cat, not one told off after it', () => {
  const told = { mood: 'resting', updatedAt: NOW, sadAt: NOW - 1000, movedOn: false }

  assert.equal(pickMood([told], NOW, NOW - 500), 'resting')
  assert.equal(pickMood([told], NOW, NOW - 2000), 'sad')
})

test('reading clears what is over and survives a half-written file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-cat-'))
  const write = (name, text) => fs.writeFileSync(path.join(dir, name), text)

  write('busy.json', JSON.stringify({ mood: 'working', updatedAt: NOW }))
  write('calling.json', JSON.stringify({ mood: 'calling', updatedAt: NOW, calledAt: NOW }))
  write('sad.json', JSON.stringify({ mood: 'talking', updatedAt: NOW, sadAt: NOW - 5, movedOn: true }))
  write('ended.json', JSON.stringify({ mood: 'resting', updatedAt: NOW, ended: true }))
  write('ancient.json', JSON.stringify({ mood: 'working', updatedAt: NOW - FORGET_AFTER_MS - 1 }))
  write('half.json', '{"mood":"wor')
  write('strange.json', JSON.stringify({ mood: 'flying', updatedAt: NOW }))
  write('note.txt', 'not a report')

  const sessions = readSessions(dir, NOW)

  // A report with no word on meowing again is an older Claude cat's: it wants it.
  const calm = { ended: false, callsAgain: true }
  assert.deepEqual(sessions.sort((a, b) => a.id.localeCompare(b.id)), [
    { mood: 'working', updatedAt: NOW, ...calm, calledAt: 0, sadAt: 0, movedOn: false, id: 'busy' },
    { mood: 'calling', updatedAt: NOW, ...calm, calledAt: NOW, sadAt: 0, movedOn: false, id: 'calling' },
    { mood: 'talking', updatedAt: NOW, ...calm, calledAt: 0, sadAt: NOW - 5, movedOn: true, id: 'sad' },
  ])
  assert.ok(!fs.existsSync(path.join(dir, 'ended.json')))
  assert.ok(!fs.existsSync(path.join(dir, 'ancient.json')))
  assert.ok(fs.existsSync(path.join(dir, 'half.json')))
  fs.rmSync(dir, { recursive: true })
})

test('a conversation calling out is noticed once, and a restart stays quiet', () => {
  const seen = new Map()

  assert.equal(hasNewCall([{ id: 'a', calledAt: 500 }], seen), false, 'first sight is quiet')
  assert.equal(hasNewCall([{ id: 'a', calledAt: 500 }], seen), false, 'nothing new')
  assert.equal(hasNewCall([{ id: 'a', calledAt: 900 }], seen), true, 'called out')
  assert.equal(hasNewCall([{ id: 'a', calledAt: 900 }], seen), false, 'only once')
  assert.equal(
    hasNewCall([{ id: 'a', calledAt: 900 }, { id: 'b', calledAt: 0 }], seen),
    false,
    'another joining is quiet',
  )
  assert.equal(
    hasNewCall([{ id: 'a', calledAt: 900 }, { id: 'b', calledAt: 950 }], seen),
    true,
    'another calling out is heard',
  )
})

test('a missing folder reads as no conversations', () => {
  assert.deepEqual(readSessions(path.join(os.tmpdir(), 'no-such-cat-folder'), NOW), [])
})
