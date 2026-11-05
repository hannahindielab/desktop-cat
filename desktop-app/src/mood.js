const fs = require('node:fs')
const path = require('node:path')

const MOODS = new Set(['resting', 'waiting', 'calling', 'thinking', 'working', 'talking'])

// A conversation that stopped reporting (closed by force, say) stops counting.
const ACTIVE_FOR_MS = 30 * 60 * 1000
const FORGET_AFTER_MS = 24 * 60 * 60 * 1000
// Told off, the cat is sad at once for this long, whatever else is going on...
const SAD_AT_ONCE_MS = 10 * 1000
// ...then while nothing needs doing, until it gets to work or this long has passed.
const SAD_AT_MOST_MS = 3 * 60 * 1000
// While a conversation waits on the person, the cat meows again this often.
const CALL_AGAIN_MS = 3 * 60 * 1000

/**
 * Sad first, unless its head was petted since; then a conversation waiting on
 * the person; then busy beats resting, and among busy conversations the
 * latest news wins.
 */
function pickMood(sessions, now, comfortedAt = 0) {
  const sad = sessions.filter(session => session.sadAt > comfortedAt)

  if (sad.some(session => now - session.sadAt < SAD_AT_ONCE_MS)) {
    return 'sad'
  }

  const active = sessions.filter(
    session =>
      session.mood !== 'resting' && now - session.updatedAt < ACTIVE_FOR_MS,
  )

  if (active.length === 0) {
    const isSulking = sad.some(
      session => !session.movedOn && now - session.sadAt < SAD_AT_MOST_MS,
    )

    return isSulking ? 'sad' : 'resting'
  }

  if (active.some(session => session.mood === 'calling')) {
    return 'calling'
  }

  return active.reduce((latest, session) =>
    session.updatedAt > latest.updatedAt ? session : latest,
  ).mood
}

function parseSession(text) {
  const { mood, updatedAt, ended, calledAt, sadAt, movedOn } = JSON.parse(text)

  return MOODS.has(mood) && Number.isFinite(updatedAt)
    ? {
        mood,
        updatedAt,
        ended: ended === true,
        calledAt: Number.isFinite(calledAt) ? calledAt : 0,
        sadAt: Number.isFinite(sadAt) ? sadAt : 0,
        movedOn: movedOn === true,
      }
    : null
}

/** True when a conversation called out since the last look. `seen` remembers. */
function hasNewCall(sessions, seen) {
  let isNew = false

  for (const { id, calledAt } of sessions) {
    // The first sight of one only notes where it stands, so a restart stays quiet.
    if (seen.has(id) && calledAt > seen.get(id)) {
      isNew = true
    }

    seen.set(id, calledAt)
  }

  return isNew
}

/** True when the cat, still waiting on the person, last meowed long enough ago. */
const isTimeToCallAgain = (mood, meowedAt, now) =>
  mood === 'calling' && now - meowedAt >= CALL_AGAIN_MS

/** Reads every conversation's report and clears the ones that are over. */
function readSessions(dir, now) {
  let names

  try {
    names = fs.readdirSync(dir)
  } catch {
    return []
  }

  const sessions = []

  for (const name of names) {
    if (!name.endsWith('.json')) {
      continue
    }

    const file = path.join(dir, name)

    try {
      const session = parseSession(fs.readFileSync(file, 'utf8'))

      if (session === null) {
        continue
      }

      if (session.ended || now - session.updatedAt > FORGET_AFTER_MS) {
        fs.rmSync(file, { force: true })
      } else {
        sessions.push({ ...session, id: name.slice(0, -'.json'.length) })
      }
    } catch {
      // Caught mid-write: the next change to the file reads it whole.
    }
  }

  return sessions
}

module.exports = {
  ACTIVE_FOR_MS,
  CALL_AGAIN_MS,
  FORGET_AFTER_MS,
  SAD_AT_MOST_MS,
  SAD_AT_ONCE_MS,
  hasNewCall,
  isTimeToCallAgain,
  pickMood,
  readSessions,
}
