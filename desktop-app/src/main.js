const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  nativeTheme,
  screen,
  shell,
} = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { hasNewCall, isTimeToCallAgain, pickMood, readSessions, wantsCallAgain } = require('./mood')
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
} = require('./prefs')
const { cansOf, levelOf, readUsage, usageLeft } = require('./usage')
// Every word the cat shows comes from the tables in src/locales.
const { chosenLanguage, currentLanguage, languagesOffered, startText, t, textForWindows, useLanguage } = require('./i18n')
// What differs between Windows, macOS and Linux.
const platform = require('./platform')
const { createPointerPoller } = require('./pointer')

const SESSIONS_DIR =
  process.env.DESKTOP_CAT_SESSIONS_DIR ??
  path.join(os.homedir(), '.desktop-cat', 'sessions')
const INBOX_DIR = path.join(path.dirname(SESSIONS_DIR), 'inbox')
const PREFS_FILE = path.join(path.dirname(SESSIONS_DIR), 'prefs.json')
// How much of Claude's use is left, written by the Claude cat for the cans.
const USAGE_FILE = path.join(path.dirname(SESSIONS_DIR), 'usage.json')

// Named in the tables as size.small and so on.
const SIZES = [
  { id: 'small', pixels: 140 },
  { id: 'medium', pixels: 200 },
  { id: 'large', pixels: 280 },
]
// See-through room around the cat in its window, as a share of its size, so
// it can bend like jelly while carried without being cut off.
const ROOM = 0.15

// Named in the tables as volume.low and so on.
const VOLUMES = [{ id: 'low' }, { id: 'medium' }, { id: 'high' }]

const DEFAULTS = {
  size: 'medium',
  alwaysOnTop: true,
  openAtLogin: false,
  soundOn: true,
  soundVolume: 'medium',
  // How loud the place the cat is in sounds, apart from the cat itself.
  placeVolume: 'medium',
  // The place's effects: on the things beside the cat, and over the windows.
  effectsOn: true,
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
// How "always on top" is asked for. Electron's own default, 'floating', puts a
// window right behind the taskbar on Windows every time it is clicked; if the
// taskbar is not on top just then (while something is full screen), the window
// drops out of the top layer and stays down behind the others. From
// 'pop-up-menu' up, Electron simply keeps the window on top.
const ON_TOP_LEVEL = 'pop-up-menu'
// Where the menu's tip item goes, as the two websites do: in Chinese the
// Taiwanese payment page (cards from Taiwan), in any other language Ko-fi
// (PayPal, from abroad).
const TIP_PAGES = {
  'zh-Hant': 'https://p.ecpay.com.tw/34D38BD',
  other: 'https://ko-fi.com/hannahindielab',
}

let win = null
let lookWin = null
// The see-through window over the cat's screen that the larger effects play in.
let overlay = null
let isOverlayReady = false
let tray = null
// Builds the tray's menu again where it is kept built up front (Linux), so its
// ticks follow what changed; elsewhere the menu is built as it opens.
let refreshTray = () => {}
// The pointer, read every so often where the window hears no mouse moves.
let pointerPoller = null
// The voice switch as the attached menu last showed it.
let shownVoice = null
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
  refreshTray()
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
  const { x, y, width, height } = platform.workAreaOf(screen.getDisplayMatching(cat))

  return {
    ...cat,
    x: Math.min(Math.max(cat.x, x), x + width - cat.width),
    y: Math.min(Math.max(cat.y, y), y + height - cat.height),
  }
}

const placeCat = cat => win.setBounds(windowAround(onScreen(cat)))

function initialBounds() {
  const side = sizeInPixels()
  const { x, y, width, height } = platform.workAreaOf(screen.getPrimaryDisplay())
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
    showScreenEffects()
  }

  win.webContents.send('cat:fade-in', windowSide())
}

function setAlwaysOnTop(isOn) {
  settings.alwaysOnTop = isOn
  win.setAlwaysOnTop(isOn, ON_TOP_LEVEL)
  saveSettings()
}

function setOpenAtLogin(isOn) {
  // Should the system say no, the tick goes back to how it was.
  try {
    platform.setOpenAtLogin(app, isOn)
    settings.openAtLogin = isOn
  } catch {
    settings.openAtLogin = !isOn
  }
  saveSettings()
}

// The place's sound goes with the cat's: 開啟音效 off quiets both.
function sendSound() {
  win.webContents.send('cat:sound', {
    enabled: settings.soundOn,
    volume: settings.soundVolume,
    place: placeOf(readPrefs(PREFS_FILE)).id,
    placeVolume: settings.placeVolume,
  })
}

function setSound(change) {
  Object.assign(settings, change)
  sendSound()
  saveSettings()
}

const sendPlace = prefs => win.webContents.send('cat:place', placeOf(prefs).id)

// The Claude cat goes to the same place when it next looks; the cat dresses
// for it, takes the place's cushion, starts hearing it and shows its effects.
function setPlace(id) {
  writePrefs(PREFS_FILE, { place: id })
  const prefs = readPrefs(PREFS_FILE)
  sendPlace(prefs)
  sendCushion(cushionNow(prefs))
  sendSound()
  showScreenEffects()
  refreshTray()
}

// Effects that reach beyond the cat, as chosen on a try-out page: over every
// window on the cat's screen but under the cat and the taskbar, in a
// see-through window that clicks go through and that never takes the focus.
// It is there only while a place with such effects is chosen and effects are
// on; which places have them is in scenes.js.
const SCREEN_EFFECTS = new Set(require('./scenes').SCREEN_EFFECTS)
// A copy without places (the public one, for now) shows none anywhere.
const HAS_PLACES = PLACES.length > 1

function screenScene() {
  const area = platform.workAreaOf(screen.getDisplayMatching(win.getBounds()))
  const cat = catPlace()

  return {
    area,
    scene: {
      place: placeOf(readPrefs(PREFS_FILE)).id,
      cat: { x: cat.x - area.x, y: cat.y - area.y, width: cat.width, height: cat.height },
    },
  }
}

function showScreenEffects() {
  const isWanted =
    win !== null && !win.isDestroyed() && win.isVisible() && settings.effectsOn && SCREEN_EFFECTS.has(placeOf(readPrefs(PREFS_FILE)).id)

  if (!isWanted) {
    if (overlay !== null && !overlay.isDestroyed()) {
      overlay.destroy()
    }
    overlay = null
    return
  }

  const { area, scene } = screenScene()

  if (overlay === null) {
    isOverlayReady = false
    overlay = new BrowserWindow({
      ...area,
      transparent: true,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences: { preload: path.join(__dirname, 'overlay-preload.js') },
    })
    const shown = overlay
    shown.setIgnoreMouseEvents(true)
    shown.setAlwaysOnTop(true, ON_TOP_LEVEL)
    shown.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    shown.webContents.on('will-navigate', event => event.preventDefault())
    shown.once('ready-to-show', () => {
      if (!shown.isDestroyed()) {
        shown.showInactive()
        // The cat stays in front of its effects.
        win.moveTop()
      }
    })
    shown.on('closed', () => {
      if (overlay === shown) {
        overlay = null
      }
    })
    shown.loadFile(path.join(__dirname, 'overlay.html'))
  } else {
    overlay.setBounds(area)
  }

  if (isOverlayReady) {
    overlay.webContents.send('fx:scene', scene)
  }
}

function setEffects(isOn) {
  settings.effectsOn = isOn
  saveSettings()
  win.webContents.send('cat:effects', isOn)
  showScreenEffects()
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

// The Claude cat lies down on the same cushion when it next looks. In a
// place, the cat keeps that place's cushion until it leaves.
function setCushion(id) {
  writePrefs(PREFS_FILE, { cushion: id })
  sendCushion(cushionNow(readPrefs(PREFS_FILE)))
}

function buildMenu() {
  // Read afresh each time: /cat-voice may have switched the voice since.
  const prefs = readPrefs(PREFS_FILE)

  // The switches and the sound; how the cat and its cans look has its own
  // window, and where the cat is comes right under it.
  return Menu.buildFromTemplate([
    // A tick shows whether the cat is out, and the words stay the same, as
    // Windows asks of a menu item that is on or off.
    {
      label: t('menu.showCat'),
      type: 'checkbox',
      checked: win.isVisible(),
      click: item => (item.checked ? win.showInactive() : win.hide()),
    },
    { label: t('menu.look'), click: openLook },
    // Laid out like the sound: where, then how loud. Only where there are places.
    ...(HAS_PLACES
      ? [
          {
            label: t('menu.place'),
            submenu: [
              ...PLACES.map(place => ({
                label: t(`place.${place.id}`),
                type: 'radio',
                checked: placeOf(prefs).id === place.id,
                click: () => changeLook({ place: place.id }),
              })),
              { type: 'separator' },
              ...VOLUMES.map(volume => ({
                label: t(`volume.${volume.id}`),
                type: 'radio',
                checked: settings.placeVolume === volume.id,
                enabled: placeOf(prefs).id !== 'none',
                click: () => changeLook({ placeVolume: volume.id }),
              })),
            ],
          },
        ]
      : []),
    { type: 'separator' },
    {
      label: t('menu.sound'),
      submenu: [
        {
          label: t('menu.soundOn'),
          type: 'checkbox',
          checked: settings.soundOn,
          click: item => setSound({ soundOn: item.checked }),
        },
        { type: 'separator' },
        ...VOLUMES.map(volume => ({
          label: t(`volume.${volume.id}`),
          type: 'radio',
          checked: settings.soundVolume === volume.id,
          click: () => setSound({ soundVolume: volume.id }),
        })),
      ],
    },
    {
      label: t('menu.voice'),
      type: 'checkbox',
      checked: isVoiceOn(prefs),
      click: item => {
        writePrefs(PREFS_FILE, { voice: item.checked })
        refreshTray()
      },
    },
    { type: 'separator' },
    {
      label: t('menu.alwaysOnTop'),
      type: 'checkbox',
      checked: settings.alwaysOnTop,
      click: item => setAlwaysOnTop(item.checked),
    },
    {
      label: t('menu.openAtLogin'),
      type: 'checkbox',
      checked: settings.openAtLogin,
      enabled: app.isPackaged,
      click: item => setOpenAtLogin(item.checked),
    },
    // A globe beside it, and each language in its own words, so someone who
    // can't read the menu yet still finds their way.
    {
      label: t('menu.language'),
      icon: globeIcon(),
      submenu: [
        {
          label: t('language.system'),
          type: 'radio',
          checked: chosenLanguage(prefs.language) === undefined,
          click: () => setLanguage(undefined),
        },
        ...languagesOffered().map(language => ({
          label: language.name,
          type: 'radio',
          checked: chosenLanguage(prefs.language) === language.code,
          click: () => setLanguage(language.code),
        })),
      ],
    },
    { type: 'separator' },
    // For the people who keep the cat and like it: only here, never a pop-up.
    { label: t('menu.tip'), click: openTipPage },
    { label: t('menu.quit'), click: () => app.quit() },
  ])
}

/** The tip page in the browser, the one for the language the cat speaks. */
function openTipPage() {
  void shell.openExternal(TIP_PAGES[currentLanguage()] ?? TIP_PAGES.other)
}

/** The globe beside 語言, drawn for a light or a dark menu; none if the
    pictures are missing. assets/globe-light@2x.png and the like are picked up
    by themselves on screens set larger than 100%. */
function globeIcon() {
  const picture = nativeImage.createFromPath(
    path.join(__dirname, '..', 'assets', `globe-${nativeTheme.shouldUseDarkColors ? 'dark' : 'light'}.png`),
  )

  return picture.isEmpty() ? undefined : picture
}

/** Speaks another language at once, or the computer's again (undefined): the
    menu, the tray, every window, and the Claude cat, which reads the choice
    from prefs.json too. */
async function setLanguage(language) {
  writePrefs(PREFS_FILE, { language })
  await useLanguage({ asked: language, preferred: app.getPreferredSystemLanguages() })
  tray?.setToolTip(t('app.name'))
  refreshTray()

  for (const shown of [win, overlay]) {
    if (shown !== null && !shown.isDestroyed()) {
      shown.webContents.send('text:changed')
    }
  }

  // The appearance window draws its choices from the words, so it starts over.
  if (lookWin !== null && !lookWin.isDestroyed()) {
    lookWin.webContents.reload()
  }
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
    place: placeOf(prefs).id,
    placeVolume: settings.placeVolume,
    effectsOn: settings.effectsOn,
  }
}

// What the appearance window offers, and each change it may ask for, refused
// unless it is one of these. The right-click menu's 環境 asks the same way,
// so the window, if open, shows what it chose.
const LOOK_CHOICES = {
  coats: COATS,
  sizes: SIZES.map(({ id }) => ({ id })),
  cushions: CUSHIONS,
  labels: CAN_LABELS,
  foods: CAN_FOODS,
  places: PLACES,
  placeVolumes: VOLUMES,
}
const LOOKS = {
  coat: id => COATS.some(coat => coat.id === id) && setCoat(id),
  size: id => SIZES.some(size => size.id === id) && setSize(id),
  cushion: id => CUSHIONS.some(cushion => cushion.id === id) && setCushion(id),
  cansShown: isOn => typeof isOn === 'boolean' && setCans({ cansShown: isOn }),
  canLabel: id => CAN_LABELS.some(label => label.id === id) && setCans({ canLabel: id }),
  canFood: id => CAN_FOODS.some(food => food.id === id) && setCans({ canFood: id }),
  place: id => PLACES.some(place => place.id === id) && setPlace(id),
  placeVolume: id => VOLUMES.some(volume => volume.id === id) && setSound({ placeVolume: id }),
  effectsOn: isOn => typeof isOn === 'boolean' && setEffects(isOn),
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
  platform.beforeOpenLook(app)

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
    title: t('look.title'),
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
    cannot be resized opens a little taller than asked, so it is measured.
    On a short screen it stops short of the screen's height, and its page
    scrolls. */
function fitLook(height) {
  if (typeof height === 'number' && Number.isFinite(height)) {
    const { height: screenHeight } = platform.workAreaOf(screen.getDisplayMatching(lookWin.getBounds()))
    const most = Math.min(900, screenHeight - 60)
    lookWin.setContentSize(LOOK_WIDTH, Math.min(Math.max(Math.ceil(height), 200), most))
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

  if (hasNewCall(sessions, seenCalls) || (isTimeToCallAgain(mood, meowedAt, now) && wantsCallAgain(sessions, now))) {
    meowedAt = now
    win.webContents.send('cat:meow')
  }

  // /cat-voice switches the voice from Claude's side: a menu attached up front
  // shows it only once built again.
  if (platform.menuIsAttached) {
    const isVoiceShown = isVoiceOn(readPrefs(PREFS_FILE))

    if (isVoiceShown !== shownVoice) {
      shownVoice = isVoiceShown
      refreshTray()
    }
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
    ...platform.windowOptions,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The cat meows on its own, not only after a click.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })

  win.setAlwaysOnTop(settings.alwaysOnTop, ON_TOP_LEVEL)
  platform.afterCreate(win)
  // Clicks pass through to whatever is behind, until the pointer is on the cat.
  win.setIgnoreMouseEvents(true, { forward: platform.forwardsPointer })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', event => event.preventDefault())
  win.once('ready-to-show', () => {
    win.showInactive()
    watchPointer()
  })
  // The coat, cushion and place come with the page, so the cat never shows in the wrong ones first.
  const prefs = readPrefs(PREFS_FILE)
  const cushion = cushionNow(prefs)
  win.loadFile(path.join(__dirname, 'index.html'), {
    query: {
      room: String(ROOM),
      coat: coatOf(prefs),
      cushion: cushion.colour,
      cushionSeam: cushion.seam,
      place: placeOf(prefs).id,
      effects: String(settings.effectsOn),
    },
  })
  // Hidden, the cat takes its effects with it.
  win.on('hide', showScreenEffects)
  win.on('show', showScreenEffects)
  // The menu's 顯示貓咪 tick follows the window, however it was hidden or shown.
  win.on('hide', () => refreshTray())
  win.on('show', () => refreshTray())
}

// Where the window hears no mouse moves, the pointer is read every so often
// and the page told, so the cat still takes the clicks once the pointer is on it.
function watchPointer() {
  if (platform.forwardsPointer) {
    return
  }

  const poller = createPointerPoller({
    getCursor: () => screen.getCursorScreenPoint(),
    getBounds: () => win.getBounds(),
    isVisible: () => !win.isDestroyed() && win.isVisible(),
    send: (channel, point) => {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send(channel, point)
      }
    },
  })
  poller.start()
  pointerPoller = poller
  win.on('closed', () => {
    poller.stop()
    pointerPoller = null
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
      sendPlace(prefs)
      win.webContents.send('cat:effects', settings.effectsOn)
      showScreenEffects()
      sendCushion(cushionNow(prefs))
      sendCans()
      refreshMood()
    }),
  )
  ipcMain.handle(
    'look:get',
    fromLook(() => ({ now: lookNow(), choices: LOOK_CHOICES })),
  )
  // Each of the cat's windows asks for its words the same way.
  ipcMain.handle('text:get', event =>
    [win, lookWin, overlay].some(shown => shown !== null && !shown.isDestroyed() && event.sender === shown.webContents)
      ? textForWindows()
      : undefined,
  )
  ipcMain.on('look:set', fromLook(changeLook))
  ipcMain.on('look:fit', fromLook(fitLook))
  // The effects window, once it can hear: what to show, and where the cat is.
  ipcMain.on('fx:ready', event => {
    if (overlay !== null && !overlay.isDestroyed() && event.sender === overlay.webContents) {
      isOverlayReady = true
      showScreenEffects()
    }
  })
  ipcMain.on('cat:faded', fromCat(resizeNow))
  ipcMain.on(
    'cat:set-interactive',
    fromCat(isOverCat => {
      win.setIgnoreMouseEvents(isOverCat !== true, { forward: platform.forwardsPointer })

      // The page may let go while the pointer still rests on the cat (as the
      // menu closes with Esc): told again where it is, the cat takes the
      // clicks without waiting for the mouse to move.
      if (isOverCat !== true) {
        pointerPoller?.resend()
      }
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
      // Perhaps onto another screen, or to the other side of this one.
      showScreenEffects()
    }),
  )
  ipcMain.on(
    'cat:menu',
    fromCat(() => buildMenu().popup({ window: win })),
  )
}

function createTray() {
  tray = new Tray(platform.trayImage(path.join(__dirname, '..', 'assets', 'tray.png')))
  tray.setToolTip(t('app.name'))
  refreshTray = platform.attachTray(tray, buildMenu)
}

function start() {
  // The language first, before the menu, the tray or any window shows a word.
  startText({ asked: readPrefs(PREFS_FILE).language, preferred: app.getPreferredSystemLanguages() })
  platform.onReady(app)
  clearOldPraise(INBOX_DIR, Date.now())
  loadSettings()
  connectCat()
  createWindow()
  createTray()
  watchSessions()

  // The folder may have moved since this was turned on.
  if (settings.openAtLogin && app.isPackaged) {
    try {
      platform.setOpenAtLogin(app, true)
    } catch {
      // Left as it was: the menu still shows it on, to turn off and on again.
    }
  }

  const keepOnScreen = () => {
    if (!win.isDestroyed()) {
      placeCat(catPlace())
      showScreenEffects()
    }
  }
  screen.on('display-removed', keepOnScreen)
  screen.on('display-metrics-changed', keepOnScreen)
}

/** Brings back a cat that was hidden. */
function showCatAgain() {
  if (win !== null && !win.isDestroyed() && !win.isVisible()) {
    win.showInactive()
  }
}

if (app.requestSingleInstanceLock()) {
  app.whenReady().then(start)
  // Only 離開 ends the cat; hiding its window does not.
  app.on('window-all-closed', () => {})
  // Opened again while it runs, the program brings a hidden cat back: on a
  // desktop that shows no tray icon, that is the way back to it.
  app.on('second-instance', showCatAgain)
} else {
  app.quit()
}
