const fs = require('node:fs')
const path = require('node:path')

const ZONES = ['head']

// One round of petting becomes one message, however many touches it holds.
const QUIET_MS = 2500
// Each message earns a reply from Claude, so a long cuddle cannot send many.
const MIN_GAP_MS = 30 * 1000
const FORGET_AFTER_MS = 24 * 60 * 60 * 1000

/** The conversation that spoke last is the one being praised. */
function pickTarget(sessions) {
  if (sessions.length === 0) {
    return null
  }

  return sessions.reduce((latest, session) =>
    session.updatedAt > latest.updatedAt ? session : latest,
  )
}

/** Gathers touches and hands over a round once the petting pauses. */
function createPraiseBox({ now, deliver }) {
  let counts = {}
  let timer = null
  let lastSentAt = -Infinity

  function flush() {
    timer = null
    const round = counts
    counts = {}

    if (deliver(round)) {
      lastSentAt = now()
    }
  }

  return {
    touch(zone) {
      if (!ZONES.includes(zone)) {
        return
      }

      counts[zone] = (counts[zone] ?? 0) + 1
      clearTimeout(timer)
      const untilAllowed = lastSentAt + MIN_GAP_MS - now()
      timer = setTimeout(flush, Math.max(QUIET_MS, untilAllowed))
    },
  }
}

function writePraise(inboxDir, sessionId, round, at) {
  fs.mkdirSync(inboxDir, { recursive: true })
  // Whole or not at all, so the conversation never reads half a message.
  const file = path.join(inboxDir, `${path.basename(sessionId)}.json`)
  const draft = `${file}.tmp`
  fs.writeFileSync(draft, JSON.stringify({ at, ...round }))
  fs.renameSync(draft, file)
}

function clearOldPraise(inboxDir, now) {
  let names

  try {
    names = fs.readdirSync(inboxDir)
  } catch {
    return
  }

  for (const name of names) {
    const file = path.join(inboxDir, name)

    try {
      if (now - fs.statSync(file).mtimeMs > FORGET_AFTER_MS) {
        fs.rmSync(file, { force: true })
      }
    } catch {
      // Gone already.
    }
  }
}

module.exports = {
  MIN_GAP_MS,
  QUIET_MS,
  ZONES,
  clearOldPraise,
  createPraiseBox,
  pickTarget,
  writePraise,
}
