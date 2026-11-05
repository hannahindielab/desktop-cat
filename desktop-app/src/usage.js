const fs = require('node:fs')

// What the cans beside the cat show, from the readings the Claude cat writes
// (its session.measure hook): this meal, the five-hour window, and the week's
// food, the weekly one. Each is how much of it is used and when it fills again.
const WINDOWS = { meal: 'fiveHour', week: 'sevenDay' }

function parseWindow(window) {
  if (typeof window !== 'object' || window === null || !Number.isFinite(window.percentUsed)) {
    return null
  }

  const resetsAt = typeof window.resetsAt === 'string' ? Date.parse(window.resetsAt) : NaN

  return { percentUsed: window.percentUsed, resetsAt: Number.isFinite(resetsAt) ? resetsAt : null }
}

/** The readings in the file's words, or null for one that is not whole. */
function parseUsage(text) {
  const usage = JSON.parse(text)

  if (typeof usage !== 'object' || usage === null) {
    return null
  }

  return Object.fromEntries(Object.entries(WINDOWS).map(([name, key]) => [name, parseWindow(usage[key])]))
}

/**
 * How much of a window is left, in whole percent, or null when nothing is
 * known of it. Once its fill time has passed it is full again, Claude used or
 * not. A last sliver left counts as 1, so only a window used up reads as eaten.
 */
function leftOf(window, now) {
  if (window === null) {
    return null
  }

  if (window.resetsAt !== null && now >= window.resetsAt) {
    return 100
  }

  return window.percentUsed >= 100 ? 0 : Math.min(100, Math.ceil(100 - window.percentUsed))
}

/** What is left of this meal and of the week's food, by now. */
const usageLeft = (usage, now) => ({
  meal: leftOf(usage?.meal ?? null, now),
  week: leftOf(usage?.week ?? null, now),
})

/** The latest readings, or the ones before them while the file is being written. */
function readUsage(file, last) {
  try {
    return parseUsage(fs.readFileSync(file, 'utf8')) ?? last
  } catch {
    return last
  }
}

// The stack the cans show: one can for every fifth of the week left, the
// highest open and as full as this meal; nothing known yet, a full stack.
const cansOf = left => (left.week === null ? 5 : Math.ceil(left.week / 20))
const levelOf = left => (left.meal === null ? 'full' : left.meal === 0 ? 'empty' : left.meal < 20 ? 'low' : 'full')

module.exports = { cansOf, leftOf, levelOf, parseUsage, readUsage, usageLeft }
