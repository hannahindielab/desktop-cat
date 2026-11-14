// The cat keeps itself up to date: once a day it looks on GitHub for a newer
// version, and when there is one it asks the person first. Only after their
// yes does it download it; then the cat closes and comes back as the new
// version. Turned off in the menu, it never looks.

const DAY_MS = 24 * 60 * 60 * 1000
// Just after the computer starts, the network may not be up yet.
const FIRST_LOOK_AFTER_MS = 60 * 1000
// How often the cat asks itself whether a day has passed: it notices a day
// that went by while the computer slept, and tries a failed look again.
const ASK_EVERY_MS = 60 * 60 * 1000

/** Time to look again: a day since the last look, or no look yet. A clock
    set back counts as time to look. */
const isTimeToLook = (lookedAt, now) =>
  !(Number.isFinite(lookedAt) && lookedAt > 0 && lookedAt <= now && now - lookedAt < DAY_MS)

/** GitHub answered, though the look went wrong: the updater names what was
    missing (its codes begin ERR_UPDATER_), or the server answered with an
    error. No network at all leaves neither. */
const wasAnswered = error =>
  (typeof error?.code === 'string' && error.code.startsWith('ERR_UPDATER_')) || Number.isInteger(error?.statusCode)

/** Whether one version is newer than another, by their numbers: 1.10.0 is newer than 1.9.2. */
function isNewer(version, than) {
  const numbers = text => String(text).split('-')[0].split('.').map(Number)
  const [a, b] = [numbers(version), numbers(than)]

  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const [x, y] = [a[i] ?? 0, b[i] ?? 0]

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return false
    }

    if (x !== y) {
      return x > y
    }
  }

  return false
}

/**
 * Looks for a new version on its schedule, and asks before it updates.
 *
 * `updater` is electron-updater's autoUpdater. `store` keeps what must outlast
 * a restart: when the cat last looked, and the version the person chose to
 * skip. `isOn` says whether looking is allowed now. `ask` shows the person the
 * new version and answers with what they chose: 'install', 'later' or 'skip'.
 */
function keepUpToDate({
  updater,
  version,
  store,
  isOn,
  ask,
  now = Date.now,
  later = setTimeout,
  every = setInterval,
}) {
  let isLooking = false
  // One question at a time: a look the next day finds the window still open.
  let isAsking = false
  let isDownloading = false

  // Nothing comes down until the person says yes.
  updater.autoDownload = false
  // Downloaded after their yes, it goes in even if the cat is closed first.
  updater.autoInstallOnAppQuit = true

  // Without a listener an error would end the program; a look that fails is
  // simply tried again later.
  updater.on('error', () => {})
  updater.on('update-available', info => void offer(info.version))
  updater.on('update-downloaded', () => {
    // Only ever after the person's yes: the cat closes, quietly, and comes
    // back as the new version.
    if (isDownloading) {
      updater.quitAndInstall(true, true)
    }
  })

  /** Asks the person about a new version, and does as they choose. "Later"
      leaves it for the next day's look, which asks again. */
  async function offer(newVersion) {
    if (isAsking || isDownloading || !isNewer(newVersion, version) || newVersion === store.get().skippedVersion) {
      return
    }

    isAsking = true
    let answer

    try {
      answer = await ask(newVersion)
    } catch {
      answer = 'later'
    } finally {
      isAsking = false
    }

    if (answer === 'skip') {
      store.set({ skippedVersion: newVersion })
    }

    if (answer === 'install') {
      isDownloading = true

      try {
        await updater.downloadUpdate()
      } catch {
        // The download failed, with no network say: the next day's look asks again.
      } finally {
        isDownloading = false
      }
    }
  }

  async function look() {
    if (isLooking || !isOn()) {
      return
    }

    isLooking = true

    try {
      await updater.checkForUpdates()
      store.set({ lookedAt: now() })
    } catch (error) {
      // GitHub answered with nothing to use, such as a release with no
      // latest.yml: that was the day's look all the same. With no network,
      // the next hour tries again.
      if (wasAnswered(error)) {
        store.set({ lookedAt: now() })
      }
    } finally {
      isLooking = false
    }
  }

  function lookIfDue() {
    if (isTimeToLook(store.get().lookedAt, now())) {
      void look()
    }
  }

  // First after a minute, then each hour asks whether a day has passed.
  later(lookIfDue, FIRST_LOOK_AFTER_MS)
  every(lookIfDue, ASK_EVERY_MS)

  return {
    /** A new version is on its way down, after the person's yes. */
    isDownloading: () => isDownloading,
    /** Turned on again in the menu: a look, if a day has passed. */
    turnedOn: lookIfDue,
  }
}

module.exports = {
  ASK_EVERY_MS,
  DAY_MS,
  FIRST_LOOK_AFTER_MS,
  isNewer,
  isTimeToLook,
  keepUpToDate,
}
