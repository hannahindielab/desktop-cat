// The cat on Linux with a real X pointer. The self-test's pointer is a pretend
// one, so it cannot catch Electron itself reading the pointer wrong (as 44
// did). On a new virtual screen of its own (Xvfb and openbox), a cat with its
// own folders and no D-Bus is driven with XTest, to check that
//   1. its window is a toolbar window (left out of taskbars and docks)
//   2. clicks go through away from the cat, and the cat takes them once the
//      pointer is on it
//   3. a left click on the head pats it; a right click opens the menu, and Esc
//      closes it
//   4. held and moved, the window follows the pointer, and put down below
//      the screen's work area it stops at its edge
// Needs Xvfb, openbox, xprop, xwininfo, python3 and libXtst. Not part of
// npm test; use: npm run test:x11
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const XTEST = join(root, 'test', 'xtest.py')
const prefer = (systemPath, name) => (existsSync(systemPath) ? systemPath : name)
// The system's own first, not another of the same name earlier on the PATH (conda's, say).
const PYTHON = prefer('/usr/bin/python3', 'python3')
const TOOLS = ['Xvfb', 'openbox', 'xprop', 'xwininfo', PYTHON]
// A D-Bus address that leads nowhere: the test cat's tray icon and notices stay
// off the real desktop, and no service is started for it.
const NO_DBUS = 'unix:path=/nonexistent/desktop-cat-test-bus'
const WHOLE_TEST_MS = 120000
const COMMAND_MS = 10000
const STOP_MS = 3000
const LOG_LINES = 30
const DRAG = { x: -200, y: -150 }
const AWAY = { x: 5, y: 5 }
// As if GNOME said the bottom 280 pixels of the screen were a dock; the cat is
// then dragged past it.
const WORK_AREA = { x: 0, y: 0, width: 1920, height: 800 }
const WORK_AREA_TEXT = [WORK_AREA.x, WORK_AREA.y, WORK_AREA.width, WORK_AREA.height].join(',')
const DROP_BELOW = 300

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/** Checks until it holds; a check that throws is tried again, and the last
    error is told if time runs out. */
async function waitFor(check, what, ms = 15000) {
  const until = Date.now() + ms
  let lastError = null

  for (;;) {
    try {
      const value = await check()

      if (value) {
        return value
      }
    } catch (error) {
      lastError = error
    }

    if (Date.now() > until) {
      throw new Error(`timed out waiting for ${what}${lastError ? ` (${lastError.message})` : ''}`)
    }

    await wait(100)
  }
}

const hasTool = name => {
  try {
    execFileSync('sh', ['-c', 'command -v "$1"', 'sh', name], { stdio: 'ignore', timeout: COMMAND_MS })
    return true
  } catch {
    return false
  }
}

// ---- Programs started: all noted, all stopped at the end ----

const children = []
const appLog = []

function track(child, { group = false } = {}) {
  child.on('error', error => appLog.push(`spawn error: ${error.message}`))
  children.push({ child, group })
  return child
}

const exited = (child, ms) =>
  child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve(true)
    : Promise.race([new Promise(resolve => child.once('exit', () => resolve(true))), wait(ms).then(() => false)])

function signal({ child, group }, name) {
  try {
    // The cat runs in a process group of its own, stopped as one, so none of
    // Electron's helpers is left behind.
    if (group) {
      process.kill(-child.pid, name)
    } else {
      child.kill(name)
    }
  } catch {
    // Over already.
  }
}

async function stopAll() {
  for (const entry of children.splice(0).reverse()) {
    signal(entry, 'SIGTERM')

    if (!(await exited(entry.child, STOP_MS))) {
      signal(entry, 'SIGKILL')
      await exited(entry.child, STOP_MS)
    }

    // Its leader gone, any helper left in the group goes too.
    if (entry.group) {
      signal(entry, 'SIGKILL')
    }
  }
}

// ---- The X screen ----

const x11 = (display, command, args) =>
  execFileSync(command, args, {
    env: { ...process.env, DISPLAY: display },
    timeout: COMMAND_MS,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString()
const xtest = (display, ...args) =>
  execFileSync(PYTHON, ['-I', XTEST, display, ...args.map(String)], { timeout: COMMAND_MS })

// Xvfb picks a display number no one uses (holding it with its lock file) and
// writes it to fd 3 once it takes connections: never another program's screen.
function startXvfb() {
  const xvfb = track(
    spawn('Xvfb', ['-displayfd', '3', '-nolisten', 'tcp', '-noreset', '-screen', '0', '1920x1080x24'], {
      stdio: ['ignore', 'ignore', 'ignore', 'pipe'],
    }),
  )

  return new Promise((resolve, reject) => {
    let text = ''
    xvfb.stdio[3].on('data', chunk => {
      text += chunk

      if (text.includes('\n')) {
        resolve(`:${text.trim()}`)
      }
    })
    xvfb.once('exit', code => reject(new Error(`Xvfb exited early (${code})`)))
    xvfb.once('error', reject)
  })
}

/** What the programs started see: the virtual screen, and neither the real
    desktop's session manager nor its D-Bus. */
function isolatedEnv(display, extra = {}) {
  const env = { ...process.env, DISPLAY: display, XDG_SESSION_TYPE: 'x11', DBUS_SESSION_BUS_ADDRESS: NO_DBUS, ...extra }
  delete env.SESSION_MANAGER
  delete env.WAYLAND_DISPLAY
  return env
}

async function startWindowManager(display) {
  track(spawn('openbox', ['--sm-disable'], { stdio: 'ignore', env: isolatedEnv(display) }))
  await waitFor(
    () => x11(display, 'xprop', ['-root', '_NET_SUPPORTING_WM_CHECK']).includes('window id'),
    'the window manager',
  )
}

function startCat(display, data) {
  const env = isolatedEnv(display, {
    DESKTOP_CAT_SESSIONS_DIR: join(data, 'sessions'),
  })
  const args = [join(root, 'tools', 'start.mjs'), '.', '--mute-audio', '--disable-gpu', `--user-data-dir=${join(data, 'user-data')}`]
  const cat = track(
    spawn(process.execPath, [...args, '--remote-debugging-port=0', '--force-device-scale-factor=1'], {
      cwd: root,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
    { group: true },
  )
  const keep = chunk => {
    appLog.push(...chunk.toString().split('\n').filter(Boolean))
    appLog.splice(0, Math.max(0, appLog.length - LOG_LINES))
  }
  cat.stdout.on('data', keep)
  cat.stderr.on('data', keep)
  return cat
}

function catWindow(display) {
  const tree = x11(display, 'xwininfo', ['-root', '-tree'])
  return tree.match(/^\s*(0x[0-9a-f]+) "[^"]*": \("desktop-cat" "desktop-cat"\)/m)?.[1] ?? null
}

function placeOf(display, id) {
  const info = x11(display, 'xwininfo', ['-id', id])
  return {
    x: Number(info.match(/Absolute upper-left X:\s+(-?\d+)/)[1]),
    y: Number(info.match(/Absolute upper-left Y:\s+(-?\d+)/)[1]),
    shown: info.includes('Map State: IsViewable'),
  }
}

/** The top-level windows shown on the screen (a menu is one too). */
function shownWindows(display) {
  const isShown = id => {
    try {
      return x11(display, 'xwininfo', ['-id', id]).includes('IsViewable')
    } catch {
      // A short-lived window, gone since it was listed.
      return false
    }
  }
  const ids = x11(display, 'xwininfo', ['-root', '-children']).match(/^\s+0x[0-9a-f]+/gm) ?? []
  return ids.map(id => id.trim()).filter(isShown)
}

// ---- The cat's page, through Chromium's debugging port, one connection throughout ----

async function connectPage(port) {
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) })
  ).json()
  const page = targets.find(target => target.type === 'page' && target.url.includes('index.html'))

  if (!page) {
    return null
  }

  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await Promise.race([
    new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve)
      socket.addEventListener('error', () => reject(new Error('cannot reach the page')))
    }),
    wait(3000).then(() => Promise.reject(new Error('the page did not open a connection'))),
  ])
  const pending = new Map()
  socket.addEventListener('message', event => {
    const reply = JSON.parse(event.data)
    pending.get(reply.id)?.(reply)
    pending.delete(reply.id)
  })
  let lastId = 0

  const evaluate = expression => {
    lastId += 1
    const id = lastId
    const reply = new Promise(resolve => pending.set(id, resolve))
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
    const late = wait(3000).then(() => Promise.reject(new Error('the page did not answer')))
    return Promise.race([reply, late]).then(({ result }) => {
      // An error in the page is told as it is, not as a puzzling "not found".
      if (result?.exceptionDetails) {
        throw new Error(
          `the page threw: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
        )
      }

      return result?.result?.value
    })
  }

  return { evaluate, close: () => socket.close() }
}

// ---- The checks ----

/** A point on the cat with cat all round it, on the part asked for (the body
    or the head) and off the cans, so a wobble does not slip off it. */
const SPOT = `(want) => {
  const fits = (x, y) => isCatAt(x, y) && !isCansAt(x, y) && (zoneAt(x, y) ?? 'body') === want
  for (let y = 230; y > 20; y -= 2) for (let x = 20; x < 240; x += 2) {
    let all = true
    for (let dy = -6; dy <= 6 && all; dy += 3) for (let dx = -6; dx <= 6 && all; dx += 3) all = fits(x + dx, y + dy)
    if (all) return { x, y }
  }
  return null
}`

async function spotOn(page, want) {
  const spot = await page.evaluate(`(${SPOT})(${JSON.stringify(want)})`)

  if (!spot) {
    throw new Error(`no ${want} spot on the cat`)
  }

  return spot
}

function checkWindowType(display, id) {
  const type = x11(display, 'xprop', ['-id', id, '_NET_WM_WINDOW_TYPE']).trim()

  if (!type.endsWith('_NET_WM_WINDOW_TYPE_TOOLBAR')) {
    throw new Error(`the window is not a toolbar, so docks list it: ${type}`)
  }

  if (!x11(display, 'xprop', ['-id', id, '_NET_WM_STATE']).includes('_NET_WM_STATE_ABOVE')) {
    throw new Error('the cat is not kept on top')
  }

  process.stdout.write('ok - a toolbar window kept on top, which docks and taskbars leave out\n')
}

async function checkHover(display, place, page) {
  await wait(500)

  if ((await page.evaluate(`document.body.dataset.over`)) === 'true') {
    throw new Error('the cat takes clicks with the pointer far away')
  }

  const chest = await spotOn(page, 'body')
  xtest(display, 'move', place.x + chest.x, place.y + chest.y)
  await waitFor(
    () => page.evaluate(`document.body.dataset.over === 'true'`),
    'the cat to notice the real pointer (is the cursor position read stale?)',
    3000,
  )
  process.stdout.write('ok - away it lets clicks through; with the real pointer on it, it takes them\n')
  return chest
}

async function checkPat(display, place, page) {
  const head = await spotOn(page, 'head')
  xtest(display, 'click', place.x + head.x, place.y + head.y, 1)
  await waitFor(() => page.evaluate(`/^(pet|rest)-head$/.test(document.body.dataset.pose)`), 'the pat', 3000)
  process.stdout.write('ok - a real click on the head pats it\n')
}

async function checkMenu(display, place, chest, page) {
  const before = new Set(shownWindows(display))
  xtest(display, 'click', place.x + chest.x, place.y + chest.y, 3)
  const menu = await waitFor(() => shownWindows(display).find(id => !before.has(id)), 'the menu', 3000)
  xtest(display, 'escape')
  await waitFor(() => !shownWindows(display).includes(menu), 'Esc to close the menu', 3000)
  // With the pointer still, the cat takes the clicks again.
  await waitFor(
    () => page.evaluate(`document.body.dataset.over === 'true'`),
    'the cat to take clicks again after the menu closed, with the pointer still',
    3000,
  )
  process.stdout.write('ok - a real right click opens the menu; after Esc the cat takes clicks again\n')
}

async function checkDrag(display, id, place, chest) {
  xtest(display, 'drag', place.x + chest.x, place.y + chest.y, DRAG.x, DRAG.y)
  const to = { x: place.x + DRAG.x, y: place.y + DRAG.y }
  const after = await waitFor(
    () => {
      const now = placeOf(display, id)
      return Math.abs(now.x - to.x) <= 2 && Math.abs(now.y - to.y) <= 2 && now
    },
    'the cat to follow the drag',
    3000,
  )
  process.stdout.write(`ok - dragged with the real pointer, from ${place.x},${place.y} to ${after.x},${after.y}\n`)
  return after
}

// Put down, the cat stays inside the screen's work area as GNOME gives it in
// _GTK_WORKAREAS_D<desktop>. (Electron reads only _NET_WORKAREA, one for all
// screens, which with screens of different heights cuts the tallest short.)
async function checkWorkArea(display, id, data, place, chest) {
  const bottom = WORK_AREA.y + WORK_AREA.height
  x11(display, 'xprop', ['-root', '-f', '_GTK_WORKAREAS_D0', '32c', '-set', '_GTK_WORKAREAS_D0', WORK_AREA_TEXT])
  xtest(display, 'drag', place.x + chest.x, place.y + chest.y, 0, DROP_BELOW)

  const settingsFile = join(data, 'user-data', 'settings.json')
  const height = Number(x11(display, 'xwininfo', ['-id', id]).match(/Height:\s+(\d+)/)[1])
  const catBottom = await waitFor(
    async () => {
      const window = placeOf(display, id)
      const { y } = JSON.parse(await readFile(settingsFile, 'utf8'))
      const room = y - window.y
      // The cat's bottom: its top plus its size (the window without its room
      // above and below).
      const edge = y + height - 2 * room
      return Math.abs(edge - bottom) <= 1 && edge
    },
    `the cat to stop at the bottom of the screen's own work area (${bottom})`,
    3000,
  )
  process.stdout.write(`ok - dropped below the work area, it stops at its bottom edge (${catBottom})\n`)
}

async function run(data) {
  const display = await startXvfb()
  await startWindowManager(display)
  xtest(display, 'move', AWAY.x, AWAY.y)

  const cat = startCat(display, data)
  cat.once('exit', code => appLog.push(`the cat exited (${code})`))
  const portFile = join(data, 'user-data', 'DevToolsActivePort')
  const port = await waitFor(
    async () => cat.exitCode === null && existsSync(portFile) && (await readFile(portFile, 'utf8')).split('\n')[0],
    'the debugging port',
  )
  const id = await waitFor(() => catWindow(display), 'the cat window')
  const place = await waitFor(() => placeOf(display, id).shown && placeOf(display, id), 'the cat to be shown')
  const page = await waitFor(() => connectPage(port), 'the page')

  try {
    await waitFor(() => page.evaluate(`document.readyState === 'complete' && typeof isCatAt === 'function'`), 'drawing')
    checkWindowType(display, id)
    const chest = await checkHover(display, place, page)
    await checkPat(display, place, page)
    await checkMenu(display, place, chest, page)
    const dragged = await checkDrag(display, id, place, chest)
    await checkWorkArea(display, id, data, dragged, chest)
  } finally {
    page.close()
  }
}

async function main() {
  if (process.platform !== 'linux') {
    process.stdout.write('skip - only for Linux\n')
    return
  }

  const missing = TOOLS.filter(name => !hasTool(name))

  if (missing.length > 0) {
    process.stdout.write(`skip - missing ${missing.join(', ')}\n`)
    return
  }

  const data = mkdtempSync(join(tmpdir(), 'desktop-cat-x11-'))
  // Interrupted, it still tidies up.
  for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(name, () => cleanUp(data).finally(() => process.exit(1)))
  }

  try {
    const tooLong = wait(WHOLE_TEST_MS).then(() => Promise.reject(new Error('the whole test took too long')))
    await Promise.race([run(data), tooLong])
    process.stdout.write('ALL PASSED\n')
  } catch (error) {
    process.stdout.write(`not ok - ${error.message}\n`)
    process.stdout.write(
      appLog
        .slice(-LOG_LINES)
        .map(line => `# ${line}\n`)
        .join(''),
    )
    process.exitCode = 1
  } finally {
    await cleanUp(data)
    process.exit()
  }
}

// The temporary folder goes only once the cat, the window manager and the
// screen have stopped, so Electron cannot write into it again as it closes.
async function cleanUp(data) {
  await stopAll()

  try {
    rmSync(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  } catch (error) {
    process.stdout.write(`# could not remove ${data}: ${error.message}\n`)
  }
}

await main()
