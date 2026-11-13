const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const {
  CAN_FOODS,
  CAN_LABELS,
  COATS,
  CUSHIONS,
  PLACES,
  canFoodOf,
  canLabelOf,
  coatOf,
  cushionNow,
  cushionOf,
  isVoiceOn,
  placeOf,
  readPrefs,
  writePrefs,
} = require('../src/prefs')

function prefsFile(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-cat-prefs-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  return path.join(root, '.desktop-cat', 'prefs.json')
}

test('nothing chosen yet: a calico cat that talks like a cat', t => {
  const prefs = readPrefs(prefsFile(t))

  assert.deepEqual(prefs, {})
  assert.equal(coatOf(prefs), 'calico')
  assert.equal(isVoiceOn(prefs), true)
})

test('a coat chosen here keeps the voice /cat-voice chose', t => {
  const file = prefsFile(t)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ voice: false }))

  writePrefs(file, { coat: 'tuxedo' })

  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { voice: false, coat: 'tuxedo' })
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['prefs.json'], 'no draft left behind')
})

test('the voice switched here keeps the coat', t => {
  const file = prefsFile(t)

  writePrefs(file, { coat: 'tuxedo' })
  writePrefs(file, { voice: false })

  const prefs = readPrefs(file)
  assert.equal(coatOf(prefs), 'tuxedo')
  assert.equal(isVoiceOn(prefs), false)
})

test('three coats to choose from, the Siamese among them, each with a poses set', t => {
  const file = prefsFile(t)

  assert.deepEqual(COATS.map(coat => coat.id), ['calico', 'tuxedo', 'siamese'])
  writePrefs(file, { coat: 'siamese' })
  assert.equal(coatOf(readPrefs(file)), 'siamese')

  // The poses built from the Claude cat's drawings hold every coat offered here.
  const window = {}
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'poses.js'), 'utf8'))(window)
  assert.deepEqual(Object.keys(window.POSES), COATS.map(coat => coat.id))
})

test('a coat it does not know, or a broken file, falls back to calico', t => {
  const file = prefsFile(t)
  fs.mkdirSync(path.dirname(file), { recursive: true })

  fs.writeFileSync(file, JSON.stringify({ coat: 'tabby' }))
  assert.equal(coatOf(readPrefs(file)), 'calico')

  fs.writeFileSync(file, '{"coat": "tux')
  assert.deepEqual(readPrefs(file), {})

  fs.writeFileSync(file, '["tuxedo"]')
  assert.deepEqual(readPrefs(file), {})
})

test('the cushion: its colours by name, the first one when unknown, kept beside the coat', t => {
  const file = prefsFile(t)

  assert.equal(cushionOf(readPrefs(file)).id, 'matcha', 'nothing chosen yet')
  writePrefs(file, { coat: 'tuxedo' })
  writePrefs(file, { cushion: 'berry' })

  const prefs = readPrefs(file)
  assert.equal(coatOf(prefs), 'tuxedo')
  assert.deepEqual(cushionOf(prefs), { id: 'berry', colour: '#B84C67', seam: '#903B4D' })
  assert.equal(cushionOf({ cushion: 'plaid' }).id, 'matcha')
  assert.equal(CUSHIONS.length, 8)
})

// The places' own checks are in scenes-unit.js, in a copy that has places; the
// public copy leaves both out for now, and has home alone.
if (require('../src/scenes').PLACES.length > 0) {
  require('./scenes-unit')
} else {
  test('with no places in this copy there is home alone, on the cushion chosen', t => {
    const file = prefsFile(t)

    assert.deepEqual(PLACES, [{ id: 'none' }])
    writePrefs(file, { cushion: 'berry', place: 'anywhere' })
    assert.equal(placeOf(readPrefs(file)).id, 'none', 'a place there is not: home')
    assert.equal(cushionNow(readPrefs(file)).colour, '#B84C67', 'the cushion chosen')
  })
}

test('the cans start coral with tuna in them, and keep to the colours and meats there are', () => {
  assert.deepEqual([canLabelOf(undefined).id, canFoodOf(undefined).id], ['coral', 'tuna'])
  assert.deepEqual([canLabelOf('berry').colour, canFoodOf('beef').food], ['#B84C67', '#B07D63'])
  assert.deepEqual([canLabelOf('plaid').id, canFoodOf('cake').id], ['coral', 'tuna'])
  assert.deepEqual(CAN_LABELS.map(label => label.id), ['coral', ...CUSHIONS.map(cushion => cushion.id)])
  assert.deepEqual(CAN_FOODS.map(food => food.id), ['tuna', 'salmon', 'chicken', 'beef'])
})
