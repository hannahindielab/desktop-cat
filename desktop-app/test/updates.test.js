const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { test } = require('node:test')

const { ASK_EVERY_MS, DAY_MS, FIRST_LOOK_AFTER_MS, isNewer, isTimeToLook, keepUpToDate } = require('../src/updates')

const NOW = 1_800_000_000_000
const HOUR_MS = 60 * 60 * 1000

/** A pretend GitHub, clock, settings file and person, and the cat's updater on them. */
function setUp({ version = '1.27.0', stored = {}, isOn = true, online = true, newer = null, answers = [] } = {}) {
  const clock = { now: NOW }
  const timers = []
  const saved = { lookedAt: 0, skippedVersion: null, ...stored }
  const calls = { looks: 0, asked: [], downloads: 0, installs: [] }
  const updater = new EventEmitter()
  const world = { online, newer, answers: [...answers], downloadFails: false, waitForAnswer: null }

  updater.checkForUpdates = async () => {
    calls.looks += 1

    if (!world.online) {
      throw new Error('net::ERR_INTERNET_DISCONNECTED')
    }

    // As electron-updater says it when the latest release has no latest.yml.
    if (world.missingFile) {
      throw Object.assign(new Error('Cannot find latest.yml in the latest release artifacts'), {
        code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND',
      })
    }

    // As electron-updater does with autoDownload off: a newer version is
    // announced, not downloaded, or there is none.
    if (world.newer === null) {
      updater.emit('update-not-available', { version })
    } else {
      updater.emit('update-available', { version: world.newer })
    }

    return null
  }
  // As electron-updater does: announced as downloaded, then done; or failed.
  updater.downloadUpdate = async () => {
    calls.downloads += 1

    if (!world.online || world.downloadFails) {
      throw new Error('net::ERR_INTERNET_DISCONNECTED')
    }

    updater.emit('update-downloaded', { version: world.newer })
    return []
  }
  updater.quitAndInstall = (...args) => calls.installs.push(args)

  const cat = keepUpToDate({
    updater,
    version,
    isOn: () => world.isOn ?? isOn,
    // The person answers in turn; with no answer left, they close the window.
    ask: async newVersion => {
      calls.asked.push(newVersion)
      return world.waitForAnswer ?? world.answers.shift() ?? 'later'
    },
    store: { get: () => ({ ...saved }), set: change => Object.assign(saved, change) },
    now: () => clock.now,
    later: (run, ms) => timers.push({ run, at: clock.now + ms }),
    every: (run, ms) => timers.push({ run, at: clock.now + ms, every: ms }),
  })

  /** Lets what has begun finish: a look, a question, a download. */
  const settle = async () => {
    for (let i = 0; i < 10; i += 1) {
      await new Promise(resolve => setImmediate(resolve))
    }
  }

  /** Moves the clock on, running every timer that comes due on the way. */
  async function pass(ms) {
    const until = clock.now + ms

    for (;;) {
      const due = timers.filter(timer => timer.at <= until).sort((a, b) => a.at - b.at)[0]

      if (due === undefined) {
        break
      }

      clock.now = Math.max(clock.now, due.at)

      if (due.every === undefined) {
        timers.splice(timers.indexOf(due), 1)
      } else {
        due.at += due.every
      }

      due.run()
      await settle()
    }

    clock.now = until
  }

  return { cat, calls, saved, world, pass, settle, updater }
}

test('it is time to look once a day has passed since the last look', () => {
  assert.equal(isTimeToLook(0, NOW), true, 'never looked')
  assert.equal(isTimeToLook(NOW - HOUR_MS, NOW), false, 'an hour ago')
  assert.equal(isTimeToLook(NOW - DAY_MS + 1, NOW), false, 'not quite a day')
  assert.equal(isTimeToLook(NOW - DAY_MS, NOW), true, 'a day')
  assert.equal(isTimeToLook(NOW + HOUR_MS, NOW), true, 'the clock was set back')
  assert.equal(isTimeToLook(undefined, NOW), true, 'nothing kept')
})

test('versions compare by their numbers', () => {
  assert.equal(isNewer('1.26.0', '1.25.9'), true)
  assert.equal(isNewer('1.10.0', '1.9.2'), true, 'ten after nine, not before it')
  assert.equal(isNewer('2.0.0', '1.99.99'), true)
  assert.equal(isNewer('1.26.0', '1.26.0'), false, 'the same')
  assert.equal(isNewer('1.25.0', '1.26.0'), false, 'older')
  assert.equal(isNewer('nonsense', '1.0.0'), false)
})

test('the first look comes a minute after the start, then once a day', async () => {
  const { calls, saved, pass } = setUp()

  await pass(FIRST_LOOK_AFTER_MS - 1)
  assert.equal(calls.looks, 0, 'not straight away: the network may not be up')
  await pass(1)
  assert.equal(calls.looks, 1)
  assert.equal(saved.lookedAt, NOW + FIRST_LOOK_AFTER_MS, 'the look is kept')

  await pass(DAY_MS - HOUR_MS)
  assert.equal(calls.looks, 1, 'not again the same day')
  await pass(2 * HOUR_MS)
  assert.equal(calls.looks, 2, 'the next day, at the hour after')
})

test('a look that fails is tried again the next hour, and not kept as a look', async () => {
  const { calls, saved, world, pass } = setUp({ online: false })

  await pass(FIRST_LOOK_AFTER_MS)
  assert.equal(calls.looks, 1)
  assert.equal(saved.lookedAt, 0, 'GitHub was not reached: no look kept')

  world.online = true
  await pass(ASK_EVERY_MS)
  assert.equal(calls.looks, 2, 'tried again within the hour')
  assert.ok(saved.lookedAt > 0)
})

test("GitHub reached but with nothing to use counts as the day's look: no asking every hour", async () => {
  const { calls, saved, world, pass } = setUp()
  world.missingFile = true

  await pass(FIRST_LOOK_AFTER_MS)
  assert.equal(calls.looks, 1)
  assert.ok(saved.lookedAt > 0, 'kept as a look')
  await pass(DAY_MS - HOUR_MS)
  assert.equal(calls.looks, 1, 'not again that day')
  await pass(2 * HOUR_MS)
  assert.equal(calls.looks, 2, 'the next day, at the hour after')
})

test('a day looked at before the cat started is not looked at again', async () => {
  const { calls, pass } = setUp({ stored: { lookedAt: NOW - HOUR_MS } })

  await pass(DAY_MS - 2 * HOUR_MS)
  assert.equal(calls.looks, 0)
  await pass(2 * HOUR_MS)
  assert.equal(calls.looks, 1)
})

test('turned off, it never looks; turned on again, it looks if a day has passed', async () => {
  const { cat, calls, world, pass } = setUp({ isOn: false })

  await pass(3 * DAY_MS)
  assert.equal(calls.looks, 0, 'off: never')

  world.isOn = true
  cat.turnedOn()
  await pass(0)
  assert.equal(calls.looks, 1, 'on again: at once, as no look was kept')
})

test('a new version is never downloaded by itself: the person is asked first', async () => {
  const { calls, pass, updater } = setUp({ newer: '1.28.0' })

  assert.equal(updater.autoDownload, false, 'electron-updater is told not to')
  await pass(FIRST_LOOK_AFTER_MS)
  assert.deepEqual(calls.asked, ['1.28.0'], 'asked, with the new version')
  assert.equal(calls.downloads, 0, 'the window closed: nothing comes down')
  assert.deepEqual(calls.installs, [])
})

test('"Install update" downloads it, then the cat closes and comes back as it, quietly', async () => {
  const { cat, calls, pass, updater } = setUp({ newer: '1.28.0', answers: ['install'] })
  let downloadingMeanwhile = null
  const download = updater.downloadUpdate
  updater.downloadUpdate = async () => {
    downloadingMeanwhile = cat.isDownloading()
    return download()
  }

  assert.equal(cat.isDownloading(), false)
  await pass(FIRST_LOOK_AFTER_MS)
  assert.equal(downloadingMeanwhile, true, 'the menu says so while it comes down')
  assert.equal(calls.downloads, 1)
  assert.deepEqual(calls.installs, [[true, true]], 'quietly, and the cat comes back')
  assert.equal(cat.isDownloading(), false)
})

test('"Remind me later" asks again the next day', async () => {
  const { calls, pass } = setUp({ newer: '1.28.0', answers: ['later'] })

  await pass(FIRST_LOOK_AFTER_MS)
  assert.deepEqual(calls.asked, ['1.28.0'])
  await pass(DAY_MS - HOUR_MS)
  assert.equal(calls.asked.length, 1, 'not again the same day')
  await pass(2 * HOUR_MS)
  assert.deepEqual(calls.asked, ['1.28.0', '1.28.0'], 'the next day')
  assert.equal(calls.downloads, 0)
})

test('"Skip this version" is kept: never asked about that one again, but about a newer one', async () => {
  const { calls, saved, world, pass } = setUp({ newer: '1.28.0', answers: ['skip'] })

  await pass(FIRST_LOOK_AFTER_MS)
  assert.equal(saved.skippedVersion, '1.28.0', 'kept past a restart')
  await pass(3 * DAY_MS)
  assert.deepEqual(calls.asked, ['1.28.0'], 'not again')
  assert.equal(calls.looks, 3, 'though it still looks each day')

  world.newer = '1.29.0'
  await pass(DAY_MS)
  assert.deepEqual(calls.asked, ['1.28.0', '1.29.0'], 'a newer one is asked about')
  assert.equal(calls.downloads, 0)
})

test('a skipped version kept from before is not asked about', async () => {
  const { calls, pass } = setUp({ stored: { skippedVersion: '1.28.0' }, newer: '1.28.0' })

  await pass(FIRST_LOOK_AFTER_MS)
  assert.equal(calls.looks, 1)
  assert.deepEqual(calls.asked, [])
})

test('one question at a time: while the window is open, it is not opened again', async () => {
  const { calls, world, settle, updater } = setUp()
  let answer
  world.waitForAnswer = new Promise(resolve => {
    answer = resolve
  })

  updater.emit('update-available', { version: '1.28.0' })
  updater.emit('update-available', { version: '1.28.0' })
  await settle()
  assert.deepEqual(calls.asked, ['1.28.0'], 'once')

  answer('later')
  await settle()
  updater.emit('update-available', { version: '1.28.0' })
  await settle()
  assert.equal(calls.asked.length, 2, 'answered: a later look may ask again')
})

test('a download that fails puts nothing in, and the next day asks again', async () => {
  const { cat, calls, world, pass } = setUp({ newer: '1.28.0', answers: ['install'] })
  world.downloadFails = true

  await pass(FIRST_LOOK_AFTER_MS)
  assert.equal(calls.downloads, 1)
  assert.deepEqual(calls.installs, [], 'nothing to put in')
  assert.equal(cat.isDownloading(), false, 'the menu no longer says it is downloading')

  await pass(DAY_MS + HOUR_MS)
  assert.deepEqual(calls.asked, ['1.28.0', '1.28.0'], 'asked again the next day')
})

test("nothing is put in without the person's yes", () => {
  const { calls, updater } = setUp()

  updater.emit('update-downloaded', { version: '1.28.0' })
  assert.deepEqual(calls.installs, [])
})

test('an older or equal version is never offered', async () => {
  const older = setUp({ version: '1.28.0', newer: '1.27.0' })
  await older.pass(FIRST_LOOK_AFTER_MS)
  assert.deepEqual(older.calls.asked, [])

  const same = setUp({ version: '1.28.0', newer: '1.28.0' })
  await same.pass(FIRST_LOOK_AFTER_MS)
  assert.deepEqual(same.calls.asked, [])
})

test('an error from the updater never ends the program', () => {
  const { updater } = setUp()

  assert.doesNotThrow(() => updater.emit('error', new Error('bad sha512')))
})
