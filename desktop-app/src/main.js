const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  nativeTheme,
  screen,
} = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { hasNewCall, isTimeToCallAgain, pickMood, readSessions } = require('./mood')
const {
  clearOldPraise,
  createPraiseBox,
  pickTarget,
  writePraise,
} = require('./praise')
const {
  CAN_FOODS,
  CAN_LABELS,
  COATS,
  CUSHIONS,
  canFoodOf,
  canLabelOf,
  coatOf,
  cushionOf,
  isVoiceOn,
  readPrefs,
  writePrefs,
} = require('./prefs')
const { cansOf, levelOf, readUsage, usageLeft } = require('./usage')

const SESSIONS_DIR =
  process.env.DESKTOP_CAT_SESSIONS_DIR ??
  path.join(os.homedir(), '.desktop-cat', 'sessions')
const INBOX_DIR = path.join(path.dirname(SESSIONS_DIR), 'inbox')
const PREFS_FILE = path.join(path.dirname(SESSIONS_DIR), 'prefs.json')
// How much of Claude's use is left, written by the Claude cat for the cans.
const USAGE_FILE = path.join(path.dirname(SESSIONS_DIR), 'usage.json')

const SIZES = [
  { id: 'small', label: '小', pixels: 140 },
  { id: 'medium', label: '中', pixels: 200 },
  { id: 'large', label: '大', pixels: 280 },
]
// See-through room around the cat in its window, as a share of its size, so
// it can bend like jelly while carried without being cut off.
const ROOM = 0.15

const VOLUMES = [
  { id: 'low', label: '小聲' },
  { id: 'medium', label: '中等' },
  { id: 'high', label: '大聲' },
]

const DEFAULTS = {
  size: 'medium',
  alwaysOnTop: true,
  openAtLogin: false,
  soundOn: true,
  soundVolume: 'medium',
  cansShown: true,
  canLabel: CAN_LABELS[0].id,
  canFood: CAN_FOODS[0].id,
}
const REFRESH_EVERY_MS = 5000
const AFTER_CHANGE_MS = 60
// The appearance window's width; its height follows its page.
const LOOK_WIDTH = 400
const LOOK_FIT_WAIT_MS = 1000
// Longer than the cat takes to fade out before it changes size.
const FADE_WAIT_MS = 400

let win = null
let lookWin = null
let tray = null
let settings = { ...DEFAULTS }
let dragOffset = null
let shownMood = null
// When the cat last meowed, or began waiting on the person.
let meowedAt = 0
// A pat on the head cheers up a cat that was sad before it.
let comfortedAt = 0
const seenCalls = new Map()
// The last whole reading of the usage, and what the cans were last told.
let usage = null
let shownCans = null
// The size the window is laid out for. While the cat fades out to change
// size, settings.size already holds the one it is changing to.
let shownSize = DEFAULTS.size
let resizeTimer = null

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')

function loadSettings() {
  try {
    settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }
  } catch {
    settings = { ...DEFAULTS }
  }

  shownSize = settings.size
}

function saveSettings() {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true })
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2))
}

const sizeInPixels = () =>
  (SIZES.find(size => size.id === shownSize) ?? SIZES[1]).pixels
const roomInPixels = () => Math.round(sizeInPixels() * ROOM)
const windowSide = () => sizeInPixels() + 2 * roomInPixels()

/** The window around a cat drawn at this place, with room all round. */
function windowAround({ x, y }) {
  const room = roomInPixels()

  return { x: x - room, y: y - room, width: windowSide(), height: windowSide() }
}

/** Where the cat itself is: the window without its room. */
function catPlace() {
  const { x, y } = win.getBounds()
  const room = roomInPixels()

  return { x: x + room, y: y + room, width: sizeInPixels(), height: sizeInPixels() }
}

/** Keeps the whole cat on a screen, whichever screens are plugged in now. */
function onScreen(cat) {
  const { x, y, width, height } = screen.getDisplayMatching(cat).workArea

  return {
    ...cat,
    x: Math.min(Math.max(cat.x, x), x + width - cat.width),
    y: Math.min(Math.max(cat.y, y), y + height - cat.height),
  }
}

const placeCat = cat => win.setBounds(windowAround(onScreen(cat)))

function initialBounds() {
  const side = sizeInPixels()
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea
  const cat = {
    x: settings.x ?? x + width - side - 24,
    y: settings.y ?? y + height - side - 24,
    width: side,
    height: side,
  }

  return windowAround(onScreen(cat))
}

// Remembers where the cat is, not its window, so the room can change.
function rememberPlace() {
  const { x, y } = catPlace()
  settings.x = x
  settings.y = y
  saveSettings()
}

// A window shows its old picture for a frame or two after it changes size, so
// the cat fades out first, and fades back in once drawn at its new size.
function setSize(id) {
  if (id === settings.size && resizeTimer === null) {
    return
  }

  settings.size = id
  saveSettings()
  win.webContents.send('cat:fade-out')
  // Should the page not say it has faded, the window changes all the same.
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(resizeNow, FADE_WAIT_MS)
}

function resizeNow() {
  clearTimeout(resizeTimer)
  resizeTimer = null

  if (settings.size !== shownSize) {
    const old = catPlace()
    shownSize = settings.size
    const side = sizeInPixels()
    // Grows and shrinks around the cat's feet, where it sits.
    placeCat({
      x: Math.round(old.x + (old.width - side) / 2),
      y: old.y + old.height - side,
      width: side,
      height: side,
    })
    rememberPlace()
  }

  win.webContents.send('cat:fade-in', windowSide())
}

function setAlwaysOnTop(isOn) {
  settings.alwaysOnTop = isOn
  win.setAlwaysOnTop(isOn, 'floating')
  saveSettings()
}

function setOpenAtLogin(isOn) {
  settings.openAtLogin = isOn
  app.setLoginItemSettings({ openAtLogin: isOn })
  saveSettings()
}

function sendSound() {
  win.webContents.send('cat:sound', {
    enabled: settings.soundOn,
    volume: settings.soundVolume,
  })
}

function setSound(change) {
  Object.assign(settings, change)
  sendSound()
  saveSettings()
}

// The Claude cat puts on the same coat when it next looks.
function setCoat(id) {
  writePrefs(PREFS_FILE, { coat: id })
  win.webContents.send('cat:coat', id)
}

// The cans' look, the desktop cat's alone: shown or not, label and meat.
function sendCans() {
  const food = canFoodOf(settings.canFood)

  win.webContents.send('cat:cans', {
    shown: settings.cansShown,
    label: canLabelOf(settings.canLabel).colour,
    food: { food: food.food, dark: food.dark, light: food.light },
  })
}

function setCans(change) {
  Object.assign(settings, change)
  sendCans()
  saveSettings()
}

const sendCushion = cushion =>
  win.webContents.send('cat:cushion', { colour: cushion.colour, seam: cushion.seam })

// The Claude cat lies down on the same cushion when it next looks.
function setCushion(id) {
  writePrefs(PREFS_FILE, { cushion: id })
  sendCushion(cushionOf({ cushion: id }))
}

function buildMenu() {
  // Read afresh each time: /cat-voice may have switched the voice since.
  const prefs = readPrefs(PREFS_FILE)

  // The switches and the sound; how the cat and its cans look has its own window.
  return Menu.buildFromTemplate([
    {
      label: win.isVisible() ? '隱藏貓咪' : '顯示貓咪',
      click: () => (win.isVisible() ? win.hide() : win.showInactive()),
    },
    { label: '外觀設定…', click: openLook },
    { type: 'separator' },
    {
      label: '音效與音量',
      submenu: [
        {
          label: '開啟音效',
          type: 'checkbox',
          checked: settings.soundOn,
          click: item => setSound({ soundOn: item.checked }),
        },
        { type: 'separator' },
        ...VOLUMES.map(volume => ({
          label: volume.label,
          type: 'radio',
          checked: settings.soundVolume === volume.id,
          click: () => setSound({ soundVolume: volume.id }),
        })),
      ],
    },
    {
      label: 'Claude 貓語氣',
      type: 'checkbox',
      checked: isVoiceOn(prefs),
      click: item => writePrefs(PREFS_FILE, { voice: item.checked }),
    },
    { type: 'separator' },
    {
      label: '永遠在最上層',
      type: 'checkbox',
      checked: settings.alwaysOnTop,
      click: item => setAlwaysOnTop(item.checked),
    },
    {
      label: '開機自動啟動',
      type: 'checkbox',
      checked: settings.openAtLogin,
      enabled: app.isPackaged,
      click: item => setOpenAtLogin(item.checked),
    },
    { type: 'separator' },
    { label: '離開', click: () => app.quit() },
  ])
}

/** How the cat and its cans look now, for the appearance window. */
function lookNow() {
  const prefs = readPrefs(PREFS_FILE)

  return {
    coat: coatOf(prefs),
    size: settings.size,
    cushion: cushionOf(prefs).id,
    cansShown: settings.cansShown,
    canLabel: canLabelOf(settings.canLabel).id,
    canFood: canFoodOf(settings.canFood).id,
  }
}

// What the appearance window offers, and each change it may ask for, refused
// unless it is one of these.
const LOOK_CHOICES = {
  coats: COATS,
  sizes: SIZES.map(({ id, label }) => ({ id, label })),
  cushions: CUSHIONS,
  labels: CAN_LABELS,
  foods: CAN_FOODS,
}
const LOOKS = {
  coat: id => COATS.some(coat => coat.id === id) && setCoat(id),
  size: id => SIZES.some(size => size.id === id) && setSize(id),
  cushion: id => CUSHIONS.some(cushion => cushion.id === id) && setCushion(id),
  cansShown: isOn => typeof isOn === 'boolean' && setCans({ cansShown: isOn }),
  canLabel: id => CAN_LABELS.some(label => label.id === id) && setCans({ canLabel: id }),
  canFood: id => CAN_FOODS.some(food => food.id === id) && setCans({ canFood: id }),
}

function changeLook(change) {
  for (const [name, value] of Object.entries(change ?? {})) {
    if (Object.hasOwn(LOOKS, name)) {
      LOOKS[name](value)
    }
  }

  if (lookWin !== null && !lookWin.isDestroyed()) {
    lookWin.webContents.send('look:now', lookNow())
  }
}

/** The appearance window: one at a time, brought forward if it is open already. */
function openLook() {
  if (lookWin !== null && !lookWin.isDestroyed()) {
    lookWin.show()
    lookWin.focus()
    return
  }

  lookWin = new BrowserWindow({
    // Fitted to its page once that is laid out: this only starts it.
    width: LOOK_WIDTH,
    height: 600,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: '外觀設定',
    show: false,
    // The page's own paper, so the window never flashes white at night.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#34302E' : '#FFFDF8',
    webPreferences: {
      preload: path.join(__dirname, 'look-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  lookWin.setMenu(null)
  lookWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  lookWin.webContents.on('will-navigate', event => event.preventDefault())
  // Shown once the page says how tall it is, or a moment after it paints if it never does.
  const opened = lookWin
  opened.once('ready-to-show', () =>
    setTimeout(() => {
      if (!opened.isDestroyed() && !opened.isVisible()) {
        opened.show()
      }
    }, LOOK_FIT_WAIT_MS),
  )
  lookWin.on('closed', () => {
    lookWin = null
  })
  lookWin.loadFile(path.join(__dirname, 'look.html'))
}

/** Fits the appearance window to its page, then shows it. A window that
    cannot be resized opens a little taller than asked, so it is measured. */
function fitLook(height) {
  if (typeof height === 'number' && Number.isFinite(height)) {
    lookWin.setContentSize(LOOK_WIDTH, Math.min(Math.max(Math.ceil(height), 200), 900))
  }

  lookWin.show()
}

/** Tells the cans when what they show has changed. */
function refreshCans(now) {
  usage = readUsage(USAGE_FILE, usage)
  const left = usageLeft(usage, now)
  const cans = { count: cansOf(left), level: levelOf(left), meal: left.meal, week: left.week }

  if (JSON.stringify(cans) !== JSON.stringify(shownCans)) {
    shownCans = cans
    win.webContents.send('cat:usage', cans)
  }
}

function refreshMood() {
  const now = Date.now()
  const sessions = readSessions(SESSIONS_DIR, now)
  const mood = pickMood(sessions, now, comfortedAt)

  if (win === null || win.isDestroyed()) {
    return
  }

  // A fill time passing changes the cans with no file written: look each time.
  refreshCans(now)

  if (mood !== shownMood) {
    shownMood = mood

    // Waiting starts with the meow its conversation calls out: count from there.
    if (mood === 'calling') {
      meowedAt = now
    }

    win.webContents.send('cat:mood', mood)
  }

  if (hasNewCall(sessions, seenCalls) || isTimeToCallAgain(mood, meowedAt, now)) {
    meowedAt = now
    win.webContents.send('cat:meow')
  }
}

function watchSessions() {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })

  let pending = null
  const watcher = fs.watch(SESSIONS_DIR, () => {
    clearTimeout(pending)
    pending = setTimeout(refreshMood, AFTER_CHANGE_MS)
  })
  watcher.on('error', () => watcher.close())

  // The usage file sits one folder up, beside the prefs.
  const usageWatcher = fs.watch(path.dirname(USAGE_FILE), (_, name) => {
    if (name === path.basename(USAGE_FILE)) {
      clearTimeout(pending)
      pending = setTimeout(refreshMood, AFTER_CHANGE_MS)
    }
  })
  usageWatcher.on('error', () => usageWatcher.close())

  // Also notices a conversation that went quiet, which no file change announces.
  setInterval(refreshMood, REFRESH_EVERY_MS)
}

function createWindow() {
  win = new BrowserWindow({
    ...initialBounds(),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The cat meows on its own, not only after a click.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  win.setAlwaysOnTop(settings.alwaysOnTop, 'floating')
  // Clicks pass through to whatever is behind, until the pointer is on the cat.
  win.setIgnoreMouseEvents(true, { forward: true })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', event => event.preventDefault())
  win.once('ready-to-show', () => win.showInactive())
  // The coat and cushion come with the page, so the cat never shows in the wrong ones first.
  const prefs = readPrefs(PREFS_FILE)
  const cushion = cushionOf(prefs)
  win.loadFile(path.join(__dirname, 'index.html'), {
    query: {
      room: String(ROOM),
      coat: coatOf(prefs),
      cushion: cushion.colour,
      cushionSeam: cushion.seam,
    },
  })
}

function fromCat(handler) {
  return (event, ...args) => {
    // A last message can still arrive while the program is closing the window.
    if (win !== null && !win.isDestroyed() && event.sender === win.webContents) {
      handler(...args)
    }
  }
}

// From the appearance window, and only while it is open.
function fromLook(handler) {
  return (event, ...args) =>
    lookWin !== null && !lookWin.isDestroyed() && event.sender === lookWin.webContents ? handler(...args) : undefined
}

function deliverPraise(round) {
  const now = Date.now()
  const target = pickTarget(readSessions(SESSIONS_DIR, now))

  if (target === null) {
    return false
  }

  writePraise(INBOX_DIR, target.id, round, now)

  return true
}

function connectCat() {
  const praise = createPraiseBox({ now: () => Date.now(), deliver: deliverPraise })

  ipcMain.on(
    'cat:pet',
    fromCat(zone => {
      comfortedAt = Date.now()
      praise.touch(zone)
      refreshMood()
    }),
  )
  ipcMain.on(
    'cat:ready',
    fromCat(() => {
      shownMood = null
      shownCans = null
      sendSound()
      const prefs = readPrefs(PREFS_FILE)
      win.webContents.send('cat:coat', coatOf(prefs))
      sendCushion(cushionOf(prefs))
      sendCans()
      refreshMood()
    }),
  )
  ipcMain.handle(
    'look:get',
    fromLook(() => ({ now: lookNow(), choices: LOOK_CHOICES })),
  )
  ipcMain.on('look:set', fromLook(changeLook))
  ipcMain.on('look:fit', fromLook(fitLook))
  ipcMain.on('cat:faded', fromCat(resizeNow))
  ipcMain.on(
    'cat:set-interactive',
    fromCat(isOverCat => {
      win.setIgnoreMouseEvents(isOverCat !== true, { forward: true })
    }),
  )
  ipcMain.on(
    'cat:drag-start',
    fromCat(() => {
      const cursor = screen.getCursorScreenPoint()
      const { x, y } = win.getBounds()
      dragOffset = { x: cursor.x - x, y: cursor.y - y }
    }),
  )
  ipcMain.on(
    'cat:drag-move',
    fromCat(() => {
      if (dragOffset !== null) {
        const cursor = screen.getCursorScreenPoint()
        // Width and height too: a screen with another scale would resize it.
        win.setBounds({
          x: cursor.x - dragOffset.x,
          y: cursor.y - dragOffset.y,
          width: windowSide(),
          height: windowSide(),
        })
      }
    }),
  )
  ipcMain.on(
    'cat:drag-end',
    fromCat(() => {
      dragOffset = null
      placeCat(catPlace())
      rememberPlace()
    }),
  )
  ipcMain.on(
    'cat:menu',
    fromCat(() => buildMenu().popup({ window: win })),
  )
}

function createTray() {
  tray = new Tray(
    nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray.png')),
  )
  tray.setToolTip('桌面貓')
  const openMenu = () => tray.popUpContextMenu(buildMenu())
  tray.on('click', openMenu)
  tray.on('right-click', openMenu)
}

function start() {
  clearOldPraise(INBOX_DIR, Date.now())
  loadSettings()
  connectCat()
  createWindow()
  createTray()
  watchSessions()

  // The folder may have moved since this was turned on.
  if (settings.openAtLogin && app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true })
  }

  const keepOnScreen = () => {
    if (!win.isDestroyed()) {
      placeCat(catPlace())
    }
  }
  screen.on('display-removed', keepOnScreen)
  screen.on('display-metrics-changed', keepOnScreen)
}

if (app.requestSingleInstanceLock()) {
  app.whenReady().then(start)
  // Only 離開 ends the cat; hiding its window does not.
  app.on('window-all-closed', () => {})
} else {
  app.quit()
}
