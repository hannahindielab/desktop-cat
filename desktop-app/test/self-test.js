// Runs the real program with its own temporary folders, drives it, and quits.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app, BrowserWindow, Menu, screen, shell } = require('electron')

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-cat-test-'))

// Pages the program would open in the browser, noted here instead of opened.
const openedPages = []
shell.openExternal = async page => {
  openedPages.push(page)
}
const sessions = path.join(root, 'sessions')
const shots = process.env.DESKTOP_CAT_TEST_SHOTS ?? root

// The menu is read instead of shown: the last one built, its items clicked here.
// Its submenus are built the same way, inside it, and are not kept on their own.
let lastMenu = null
let building = 0
const realBuildMenu = Menu.buildFromTemplate.bind(Menu)
Menu.buildFromTemplate = template => {
  if (building === 0) {
    lastMenu = template
  }

  building += 1
  try {
    const menu = realBuildMenu(template)
    menu.popup = () => {}

    return menu
  } finally {
    building -= 1
  }
}

// Every "always on top" the program asks for, with its level, to check it never
// asks for one that Electron puts behind the taskbar on Windows: there the cat
// drops out of the top layer whenever the taskbar happens not to be on top.
const onTopAsked = []
const realSetAlwaysOnTop = BrowserWindow.prototype.setAlwaysOnTop
BrowserWindow.prototype.setAlwaysOnTop = function setAlwaysOnTop(flag, level, ...rest) {
  onTopAsked.push({ flag, level })
  return realSetAlwaysOnTop.call(this, flag, level, ...rest)
}
const BEHIND_TASKBAR = [undefined, 'floating', 'torn-off-menu', 'modal-panel', 'main-menu', 'status']

process.env.DESKTOP_CAT_SESSIONS_DIR = sessions
app.setPath('userData', path.join(root, 'user-data'))
// A computer set to Traditional Chinese, wherever the test runs: the cat speaks Chinese.
app.getPreferredSystemLanguages = () => ['zh-TW']
require('../src/main.js')
const { t } = require('../src/i18n')

// The places, in a copy that has them. The public copy leaves them out for
// now, and their checks with them (self-test-scenes.js).
const HAS_PLACES = require('../src/scenes').PLACES.length > 0
const scenes = HAS_PLACES ? require('./self-test-scenes') : null

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const report = (id, mood, updatedAt = Date.now(), ended = false, calledAt = 0, sadAt = 0) =>
  fs.writeFileSync(
    path.join(sessions, `${id}.json`),
    JSON.stringify({ mood, updatedAt, ended, calledAt, sadAt, movedOn: false }),
  )

async function waitFor(check, what, ms = 5000) {
  for (let i = 0; i < ms / 50; i += 1) {
    if (await check()) {
      return
    }
    await wait(50)
  }
  assert.fail(`timed out waiting for ${what}`)
}

async function run() {
  await app.whenReady()
  await waitFor(() => BrowserWindow.getAllWindows().length === 1, 'the window')
  const win = BrowserWindow.getAllWindows()[0]
  const page = win.webContents
  const inPage = code => page.executeJavaScript(code)
  await waitFor(() => win.isVisible(), 'the window to show')

  // The tests run silently: playing is checked, but nothing reaches the speakers.
  page.setAudioMuted(true)
  const sound = () => inPage('Sound.state()')
  await waitFor(async () => Number.isFinite((await sound()).purrSeconds), 'the purr to load')
  await waitFor(async () => Number.isFinite((await sound()).typingSeconds), 'the typing to load')

  const mood = () => inPage('document.body.dataset.mood')
  const expectMood = (expected, why) =>
    waitFor(async () => (await mood()) === expected, `${expected}: ${why}`)

  await expectMood('resting', 'nothing is reporting yet')
  assert.equal(win.isAlwaysOnTop(), true, 'floats above other windows')

  const { width: windowSide } = win.getBounds()
  const { room, catSide } = await inPage('({ room: stage.offsetLeft, catSide: stage.clientWidth })')
  assert.equal(catSide, 200, 'the cat keeps its own size')
  assert.equal(windowSide, catSide + 2 * room, 'the window is the cat with room all round')
  assert.ok(room >= catSide * 0.14, 'room enough for the cat to bend into')
  // A point at this share across and down the cat, in the window.
  const inCat = (across, down) => ({
    x: Math.round(room + across * catSide),
    y: Math.round(room + down * catSide),
  })
  console.log(`ok - the cat is ${catSide} pixels with ${room} to spare all round`)

  for (const pose of ['waiting', 'calling', 'thinking', 'working', 'talking', 'resting']) {
    report('one', pose)
    await expectMood(pose, 'one conversation reports it')
    await wait(300)
    const image = await page.capturePage()
    fs.writeFileSync(path.join(shots, `pet-${pose}.png`), image.toPNG())

    const { width, height } = image.getSize()
    const pixels = image.toBitmap()
    const alpha = (x, y) => pixels[(y * width + x) * 4 + 3]
    const middle = inCat(0.41, 0.7)
    assert.equal(alpha(1, 1), 0, `${pose}: the corner is see-through`)
    assert.ok(
      alpha(Math.round((middle.x / windowSide) * width), Math.round((middle.y / windowSide) * height)) > 200,
      `${pose}: the cat's middle is solid`,
    )
  }
  console.log('ok - every pose shows, with a see-through background')

  const meowsBefore = (await sound()).meow
  report('one', 'working')
  await expectMood('working', 'typing sounds')
  await waitFor(async () => (await sound()).typing, 'the typing to start')
  assert.equal((await sound()).purr, false, 'no purring at the keyboard')
  assert.equal((await sound()).meow, meowsBefore, 'no meow for starting work')
  report('one', 'working', Date.now(), false, Date.now())
  await waitFor(async () => (await sound()).meow === meowsBefore + 1, 'a meow for a permission')
  assert.equal(await mood(), 'working', 'asking does not stop the work')
  await wait(50)
  report('one', 'resting', Date.now(), false, Date.now())
  await expectMood('resting', 'the work finishing')
  await waitFor(async () => !(await sound()).typing, 'the typing to stop')
  await waitFor(async () => (await sound()).meow === meowsBefore + 2, 'a meow when the work is done')
  console.log('ok - typing while working, a meow when asking and a meow when done')

  await waitFor(async () => (await sound()).chatterReady, 'the meow to load for the chatter')
  const chatterBefore = (await sound()).chatter
  report('one', 'talking')
  await expectMood('talking', 'a reply coming in')
  await waitFor(async () => (await sound()).chatter >= chatterBefore + 3, 'little mews while talking')
  await inPage(`Sound.configure({ enabled: false, volume: 'medium' })`)
  await waitFor(async () => !(await sound()).chattering, 'sound off to quiet the chatter')
  await inPage(`Sound.configure({ enabled: true, volume: 'medium' })`)
  await waitFor(async () => (await sound()).chattering, 'sound on to bring the chatter back')
  report('one', 'working')
  await expectMood('working', 'back to work')
  await waitFor(async () => !(await sound()).chattering, 'the chatter to stop with the talking')
  const chatterAfter = (await sound()).chatter
  await wait(500)
  assert.equal((await sound()).chatter, chatterAfter, 'no more mews once it stops talking')
  console.log('ok - talking, the cat chatters in little mews, and stops with the talking')

  // Its voice falling silent as it did after a day's running: put to sleep
  // under it, and refusing to wake.
  report('one', 'talking')
  await expectMood('talking', 'a reply coming in again')
  await waitFor(async () => (await sound()).chattering, 'the chatter to start again')
  await inPage(`{
    const realSource = AudioContext.prototype.createBufferSource
    const realResume = AudioContext.prototype.resume
    window.restoreVoice = () => {
      AudioContext.prototype.createBufferSource = realSource
      AudioContext.prototype.resume = realResume
    }
    AudioContext.prototype.resume = () => Promise.resolve()
    AudioContext.prototype.createBufferSource = function () {
      AudioContext.prototype.createBufferSource = realSource
      this.suspend()
      return realSource.call(this)
    }
    null
  }`)
  await waitFor(async () => (await sound()).renewedVoice === 1, 'a new voice for the stuck one')
  const mewsOnNewVoice = (await sound()).chatter
  await waitFor(async () => (await sound()).chatter >= mewsOnNewVoice + 3, 'the chatter to go on in the new voice')
  await inPage('window.restoreVoice()')
  assert.equal((await sound()).renewedVoice, 1, 'one new voice is enough')
  console.log('ok - the chatter starts over in a new voice when its old one stalls')

  // A question waiting on the person: one meow, and the cat looks at them and
  // taps the table, its reach played from the start.
  const meowsBeforeCalling = (await sound()).meow
  report('one', 'calling', Date.now(), false, Date.now())
  await expectMood('calling', 'a question waiting on the person')
  await waitFor(async () => (await sound()).meow === meowsBeforeCalling + 1, 'one meow for the question')
  await waitFor(async () => !(await sound()).chattering, 'quiet while it waits')
  assert.ok(
    (await inPage('stage.firstElementChild.getCurrentTime()')) < 2,
    'its reach plays from the start, however long the page has been open',
  )
  report('other', 'talking')
  await wait(300)
  assert.equal(await mood(), 'calling', 'waiting on the person wins over another conversation talking')
  report('other', 'resting', Date.now(), true)
  report('one', 'working')
  await expectMood('working', 'answered, back to work')
  console.log('ok - waiting on the person, the cat meows once and taps the table')

  report('one', 'working', Date.now() - 2000)
  report('two', 'resting')
  await expectMood('working', 'one busy, the newer one resting')
  console.log('ok - a busy conversation keeps the cat up while another rests')

  report('two', 'talking')
  await expectMood('talking', 'the latest of two busy conversations')
  console.log('ok - the latest busy conversation wins')

  report('one', 'resting', Date.now(), true)
  report('two', 'resting', Date.now(), true)
  await expectMood('resting', 'both conversations ended')
  await waitFor(() => fs.readdirSync(sessions).length === 0, 'ended reports to clear')
  console.log('ok - ended conversations are cleared and the cat rests')

  // Points on the drawings, from their own coordinates to the window's.
  const asleep = (x, y) => inCat((x + 33) / 2574, (y + 428) / 2574)
  const toPixels = (x, y) => inCat((x - 45) / 1940, (y - 30) / 1940)
  const pose = () => inPage('document.body.dataset.pose')
  const zone = ({ x, y }) => inPage(`zoneAt(${x}, ${y})`)
  const tap = ({ x, y }) => {
    win.setIgnoreMouseEvents(false)
    page.sendInputEvent({ type: 'mouseMove', x, y })
    page.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
    page.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
  }

  await waitFor(async () => (await pose()) === 'dozing', 'dozing off sitting up first')
  await wait(3000)
  assert.equal(await pose(), 'dozing', 'still sitting up a few seconds on')
  tap(toPixels(840, 300))
  await waitFor(async () => (await pose()) === 'pet-head', 'a pat while dozing, sitting up')
  await waitFor(async () => (await pose()) === 'dozing', 'dozing again after the pat, not lying straight down')
  await waitFor(async () => (await pose()) === 'resting', 'lying down once nothing came up')
  console.log('ok - done, the cat dozes sitting up, then lies down on its cushion')
  assert.equal(await zone(asleep(800, 900)), 'head', 'asleep, the head is lower down')
  assert.equal(await zone(asleep(810, 1300)), null, 'the chin is for carrying')
  assert.equal(await zone(asleep(1700, 1000)), null, 'the rump is for carrying')
  assert.equal(await zone(asleep(1250, 1850)), null, 'the cushion is for carrying')
  assert.equal(await inPage(`isCatAt(${asleep(1250, 1850).x}, ${asleep(1250, 1850).y})`), true, 'the cushion can be held')
  assert.equal(await zone({ x: 1, y: 1 }), null)

  tap(asleep(1700, 1000))
  tap(asleep(810, 1300))
  await wait(300)
  assert.equal(await pose(), 'resting', 'the rump and chin do not react')
  tap(asleep(800, 900))
  await waitFor(async () => (await pose()) === 'rest-head', 'the head reaction asleep')
  await waitFor(async () => (await sound()).purr, 'purring on the cushion')
  await waitFor(async () => (await pose()) === 'resting', 'lying back down')
  // With nobody to tell, the round is dropped before the next test begins.
  await wait(2800)
  assert.equal(fs.existsSync(path.join(root, 'inbox')), false, 'no conversation, no message')
  console.log('ok - on the cushion it stays lying down when petted')

  report('awake', 'working')
  await expectMood('working', 'sitting up for the tests of sitting poses')
  const chest = inCat(0.41, 0.7)
  assert.equal(await inPage(`isCatAt(${chest.x}, ${chest.y})`), true, 'the chest counts as the cat')
  assert.equal(await inPage('isCatAt(1, 1)'), false, 'the corner does not')

  const SPOTS = {
    head: toPixels(840, 300),
    chin: toPixels(838, 720),
    rump: toPixels(1250, 1400),
    chest: toPixels(800, 1100),
    tail: toPixels(1620, 1250),
  }
  assert.equal(await zone(SPOTS.head), 'head')
  assert.equal(await zone(SPOTS.chin), null, 'the chin is for carrying')
  assert.equal(await zone(SPOTS.rump), null, 'the rump is for carrying')
  assert.equal(await zone(SPOTS.chest), null, 'the chest is for carrying')
  assert.equal(await zone(SPOTS.tail), null, 'the tail is for carrying')
  assert.equal(await zone({ x: 1, y: 1 }), null, 'empty space is no zone')
  console.log('ok - only the head is for petting, and the rest carries the cat')

  const press = ({ x, y }) => {
    win.setIgnoreMouseEvents(false)
    page.sendInputEvent({ type: 'mouseMove', x, y })
    page.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
  }
  const release = ({ x, y }) =>
    page.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
  const isDragged = () => inPage(`document.body.classList.contains('dragging')`)
  const before = win.getBounds()

  report('quiet', 'resting', Date.now() - 5000)
  report('latest', 'working')
  await expectMood('working', 'the conversation about to be praised')

  const mewsBeforePetting = (await sound()).mew
  press(SPOTS.head)
  await waitFor(async () => (await pose()) === 'pet-head', 'the head reaction')
  await waitFor(async () => (await sound()).purr, 'the purring to start')
  assert.equal(await isDragged(), false, 'petting does not pick the cat up')
  assert.equal((await sound()).mew, mewsBeforePetting, 'petting is not picking up: no mew')
  // Rubbing back and forth: 9 trips of 40 pixels, so two strokes' worth.
  for (let move = 0; move < 10; move += 1) {
    page.sendInputEvent({ type: 'mouseMove', x: SPOTS.head.x + (move % 2) * 40, y: SPOTS.head.y })
    await wait(20)
  }
  release(SPOTS.head)
  assert.deepEqual(win.getBounds(), before, 'petting does not move the cat')
  console.log('ok - petting the head purrs and does not move the cat')

  for (const spot of [SPOTS.rump, SPOTS.chin]) {
    press(spot)
    await waitFor(isDragged, 'the chin or rump to pick the cat up')
    release(spot)
    await waitFor(async () => !(await isDragged()), 'the cat to be put down')
  }
  console.log('ok - pressing the chin or rump carries the cat instead of petting it')

  const inbox = path.join(root, 'inbox', 'latest.json')
  await waitFor(() => fs.existsSync(inbox), 'the praise to be sent')
  const praise = JSON.parse(fs.readFileSync(inbox, 'utf8'))
  assert.equal(praise.head, 3, 'the press and two strokes')
  assert.deepEqual(Object.keys(praise).sort(), ['at', 'head'], 'nothing but the head is counted')
  assert.equal(fs.existsSync(path.join(root, 'inbox', 'quiet.json')), false, 'only the latest hears it')
  console.log(`ok - one round of praise goes to the conversation that spoke last: ${JSON.stringify(praise)}`)

  await waitFor(async () => (await pose()) === 'working', 'the cat to go back to work')
  await waitFor(async () => !(await sound()).purr, 'the purring to stop')
  console.log('ok - after the fuss the cat goes back to what it was doing')

  await waitFor(async () => (await sound()).typing, 'the typing to pick up again')
  await inPage(`Sound.configure({ enabled: false, volume: 'medium' })`)
  await waitFor(async () => !(await sound()).typing, 'sound off to stop the typing')
  const meowsOff = (await sound()).meow
  await inPage(`Sound.shot('meow')`)
  assert.equal((await sound()).meow, meowsOff, 'sound off, no meow')
  await inPage(`Sound.configure({ enabled: true, volume: 'low' })`)
  await waitFor(async () => (await sound()).typing, 'sound on to bring it back')
  console.log('ok - turning the sound off silences the cat, and on brings it back')

  win.setIgnoreMouseEvents(false)
  page.sendInputEvent({ type: 'mouseMove', x: 1, y: 1 })
  await waitFor(async () => (await inPage('document.body.dataset.over')) === 'false', 'hover off the cat')
  page.sendInputEvent({ type: 'mouseMove', x: SPOTS.chest.x, y: SPOTS.chest.y })
  await waitFor(async () => (await inPage('document.body.dataset.over')) === 'true', 'hover on the cat')
  const mewsBefore = (await sound()).mew
  page.sendInputEvent({ type: 'mouseDown', x: SPOTS.chest.x, y: SPOTS.chest.y, button: 'left', clickCount: 1 })
  await waitFor(() => inPage(`document.body.classList.contains('dragging')`), 'the drag to start')
  assert.equal((await sound()).mew, mewsBefore + 1, 'a faint mew when picked up')
  page.sendInputEvent({ type: 'mouseUp', x: SPOTS.chest.x, y: SPOTS.chest.y, button: 'left', clickCount: 1 })
  await waitFor(async () => !(await inPage(`document.body.classList.contains('dragging')`)), 'the drag to end')
  page.sendInputEvent({ type: 'mouseMove', x: 1, y: 1 })
  await waitFor(async () => (await inPage('document.body.dataset.over')) === 'false', 'hover to leave')
  console.log('ok - the cat is grabbed on its body and not on the gaps')

  const saved = JSON.parse(fs.readFileSync(path.join(root, 'user-data', 'settings.json'), 'utf8'))
  assert.deepEqual(
    [saved.x, saved.y],
    [win.getBounds().x + room, win.getBounds().y + room],
    'the place kept is the cat itself, not its window',
  )
  console.log('ok - put down, it remembers where the cat is, as before the room was added')

  // Carried quickly right and up, its top slants left and it squashes, then
  // it wobbles back into shape once let go.
  const shape = async () => {
    const transform = await inPage('stage.style.transform')
    const slant = transform.match(/skewX\((-?[\d.e-]+)deg\)/)
    const tall = transform.match(/scale\([^,]+, (-?[\d.e-]+)\)/)

    return { transform, slant: slant ? Number(slant[1]) : 0, tall: tall ? Number(tall[1]) : 1 }
  }
  // The cat follows the pointer across the screen, so these say where on it.
  // Measured once: carried, the window follows the real mouse, wherever that is.
  const pickedUpAt = win.getBounds()
  const onScreenAt = ({ x, y }) => ({ x, y, globalX: pickedUpAt.x + x, globalY: pickedUpAt.y + y })
  win.setIgnoreMouseEvents(false)
  page.sendInputEvent({ type: 'mouseMove', ...onScreenAt(SPOTS.chest) })
  page.sendInputEvent({ type: 'mouseDown', ...onScreenAt(SPOTS.chest), button: 'left', clickCount: 1 })
  await waitFor(isDragged, 'picking the cat up')
  let most = { slant: 0, tall: 1 }
  for (let step = 1; step <= 12; step += 1) {
    const to = onScreenAt({ x: SPOTS.chest.x + step * 12, y: SPOTS.chest.y - step * 10 })
    page.sendInputEvent({ type: 'mouseMove', ...to, button: 'left', modifiers: ['leftButtonDown'] })
    await wait(16)
    const now = await shape()
    most = { slant: Math.max(most.slant, now.slant), tall: Math.min(most.tall, now.tall) }
  }
  fs.writeFileSync(path.join(shots, 'pet-carried.png'), (await page.capturePage()).toPNG())
  release(SPOTS.chest)
  assert.ok(most.slant > 0.3, `carried right, its top slants left: ${most.slant}°`)
  assert.ok(most.tall < 0.995, `lifted, it squashes: ${most.tall}`)
  await waitFor(async () => (await shape()).transform === '', 'the cat to wobble back into shape')
  console.log(`ok - carried, it bends like jelly (${most.slant.toFixed(2)}°, ${most.tall.toFixed(3)} tall) and wobbles back`)

  report('latest', 'talking', Date.now(), false, 0, Date.now())
  await expectMood('sad', 'told off a moment ago, though another conversation works')
  await waitFor(async () => (await pose()) === 'sad', 'the sad face')
  await waitFor(async () => !(await sound()).typing, 'the typing to stop while sad')
  await wait(300)
  fs.writeFileSync(path.join(shots, 'pet-sad.png'), (await page.capturePage()).toPNG())
  console.log('ok - told off, the cat hangs its head and stops typing')

  // The hung head sits lower: pat its brow, not the gap between its ears.
  const brow = toPixels(840, 430)
  assert.equal(await zone(brow), 'head')
  press(brow)
  await waitFor(async () => (await pose()) === 'pet-head', 'the comforting pat')
  release(brow)
  await expectMood('talking', 'comforted, back to the latest conversation')
  console.log('ok - a pat on the head cheers it up')

  // The menu keeps the switches and the sound; how the cat looks has its own window.
  const prefsFile = path.join(root, 'prefs.json')
  const prefs = () => JSON.parse(fs.readFileSync(prefsFile, 'utf8'))
  const openMenu = async () => {
    lastMenu = null
    await inPage('window.desktopCat.showMenu()')
    await waitFor(() => lastMenu !== null, 'the menu')

    return label => lastMenu.find(item => item.label === label)
  }
  const coat = () => inPage('document.body.dataset.coat')
  const drawing = () => inPage('stage.innerHTML')

  await waitFor(async () => (await pose()) === 'talking', 'the pat to pass')
  assert.equal(await coat(), 'calico', 'nothing chosen yet: calico')
  const calicoTalking = await drawing()
  let item = await openMenu()
  assert.deepEqual(
    lastMenu.map(entry => entry.label ?? '—'),
    [
      '顯示貓咪',
      '外觀設定',
      // Where the cat is, in a copy that has places.
      ...(HAS_PLACES ? [t('menu.place')] : []),
      '—',
      '音效與音量',
      'Claude 貓語氣',
      '—',
      '永遠在最上層',
      '開機自動啟動',
      '語言',
      '—',
      '請貓貓吃罐罐',
      '離開',
    ],
    'the items in four groups',
  )
  item('請貓貓吃罐罐').click()
  assert.equal(openedPages.at(-1), 'https://p.ecpay.com.tw/34D38BD', 'in Chinese, the Taiwanese tip page in the browser')
  assert.equal(item('顯示貓咪').type, 'checkbox', 'showing the cat is ticked, not a word that changes')
  assert.equal(item('顯示貓咪').checked, true, 'the cat is out')
  assert.deepEqual(
    item('音效與音量').submenu.map(entry => entry.label ?? '—'),
    ['開啟音效', '—', '小聲', '中等', '大聲'],
  )
  if (HAS_PLACES) {
    scenes.menu({ assert, item })
  }
  console.log('ok - the menu holds the switches, the sound and the place, and opens the appearance window')

  // The language: the computer's at first, then each language in its own words.
  assert.deepEqual(
    item('語言').submenu.map(entry => entry.label),
    ['使用系統設定', 'English', '繁體中文'],
    "the computer's language, then each one named in its own words",
  )
  assert.equal(item('語言').submenu[0].checked, true, "the computer's language at first")
  assert.ok(item('語言').icon, 'a globe beside it')
  item('語言').submenu.find(entry => entry.label === 'English').click()
  await waitFor(() => prefs().language === 'en', 'English kept, for the Claude cat too')
  await waitFor(async () => (await inPage('document.documentElement.lang')) === 'en', 'the cat window in English')
  item = await openMenu()
  assert.ok(item('Exit'), 'the menu in English at once')
  assert.equal(item('Language').submenu.find(entry => entry.label === 'English').checked, true, 'English ticked')
  item('Buy the cat a can').click()
  assert.equal(openedPages.at(-1), 'https://ko-fi.com/hannahindielab', 'in English, Ko-fi')
  item('Language').submenu.find(entry => entry.label === 'Use system setting').click()
  await waitFor(() => !('language' in prefs()), "the choice given back to the computer")
  await waitFor(async () => (await inPage('document.documentElement.lang')) === 'zh-Hant', 'the cat window in Chinese again')
  item = await openMenu()
  assert.ok(item('離開'), 'this computer is set to Chinese: Chinese again')
  console.log('ok - the language menu changes the words at once, and gives the choice back to the computer')

  item('外觀設定').click()
  await waitFor(() => BrowserWindow.getAllWindows().length === 2, 'the appearance window')
  const look = BrowserWindow.getAllWindows().find(other => other !== win)
  const inLook = code => look.webContents.executeJavaScript(code)
  // The coat and size on the first page; the place and its volume on the second.
  await waitFor(async () => (await inLook('document.querySelectorAll(".segment.on").length')) === 4, 'the window to show the choices')
  assert.equal(look.getTitle(), '外觀設定')
  assert.equal(await inLook('document.querySelector("[data-page=place]").hidden'), true, 'it opens on the first page')
  assert.equal(await inLook('document.querySelector("[data-look=coat] .on").textContent'), '三花')
  assert.equal(await inLook('[...document.querySelectorAll("[data-look=coat] .segment")].map(choice => choice.textContent).join()'), '三花,賓士,暹羅')
  assert.equal(await inLook('document.querySelector("[data-look=size] .on").textContent'), '中')
  assert.equal(await inLook('document.querySelectorAll("[data-look=cushion] .swatch").length'), 8)
  assert.equal(await inLook('document.querySelectorAll("[data-look=canLabel] .swatch").length'), 9)
  assert.equal(await inLook('document.querySelectorAll("[data-look=canFood] .swatch").length'), 4)
  item('外觀設定').click()
  await wait(200)
  assert.equal(BrowserWindow.getAllWindows().length, 2, 'asked again, the one window comes forward')
  await waitFor(
    () => inLook('innerHeight === Math.ceil(document.body.getBoundingClientRect().height)'),
    'the window to fit its page',
  )
  console.log('ok - the appearance window opens once, showing what is chosen, and just fits its page')

  await inLook('document.querySelector("[data-look=coat] [data-value=tuxedo]").click()')
  await waitFor(async () => (await coat()) === 'tuxedo', 'the tuxedo coat')
  assert.equal(await pose(), 'talking', 'the same pose in the new coat')
  assert.notEqual(await drawing(), calicoTalking, 'drawn again in the new coat')
  assert.equal(prefs().coat, 'tuxedo', 'kept for the Claude cat to follow')
  await waitFor(async () => (await inLook('document.querySelector("[data-look=coat] .on").dataset.value')) === 'tuxedo', 'the window to mark it')
  await wait(300)
  fs.writeFileSync(path.join(shots, 'pet-tuxedo.png'), (await page.capturePage()).toPNG())
  console.log('ok - the window changes the coat at once, in the pose the cat is in')

  // The window may only ask for the choices there are.
  await inLook('window.look.set({ coat: "lion", size: "huge", canLabel: "gold", nothing: 1 })')
  await wait(200)
  assert.equal(prefs().coat, 'tuxedo', 'a coat there is not is refused')
  console.log('ok - what the window asks for is checked against the choices')

  // Changing size, the cat fades out, its window changes around its feet,
  // and it fades back in, so the window's old picture never shows.
  const isFaded = () => inPage("document.body.classList.contains('resizing')")
  const chooseSize = id => inLook(`document.querySelector("[data-look=size] [data-value=${id}]").click()`)
  const feetOf = ({ x, y, width, height }, side) => ({ x: x + width / 2, y: y + height - Math.round(side * 0.15) })
  win.setPosition(400, 300)
  const mediumAt = win.getBounds()
  await chooseSize('large')
  await waitFor(isFaded, 'the cat to fade out')
  assert.deepEqual(win.getBounds(), mediumAt, 'its window waits while it fades')
  await waitFor(() => win.getBounds().width === 364, 'the large window')
  assert.equal(await isFaded(), true, 'still faded as the window changes')
  await waitFor(async () => !(await isFaded()), 'the cat to fade back in')
  assert.deepEqual(feetOf(win.getBounds(), 280), feetOf(mediumAt, 200), 'grown around its feet')
  await waitFor(async () => (await inLook('document.querySelector("[data-look=size] .on").dataset.value')) === 'large', 'the window to mark large')

  // Asked again before it is back, it ends at the last size asked for.
  await chooseSize('small')
  await chooseSize('medium')
  await waitFor(async () => !(await isFaded()) && win.getBounds().width === 260, 'back to medium, shown')
  assert.deepEqual(win.getBounds(), mediumAt, 'back where it was')
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'user-data', 'settings.json'), 'utf8')).size, 'medium')

  // The size it is already does not make it fade.
  await chooseSize('medium')
  await wait(200)
  assert.equal(await isFaded(), false, 'the same size: no fade')
  console.log('ok - changing size, the cat fades out and back in around its feet')

  item = await openMenu()
  assert.equal(item('Claude 貓語氣').checked, true, 'the voice is on until switched off')
  item('Claude 貓語氣').click({ checked: false })
  assert.deepEqual(prefs(), { coat: 'tuxedo', voice: false }, 'voice off, coat kept')
  fs.writeFileSync(prefsFile, JSON.stringify({ coat: 'tuxedo', voice: true }))
  item = await openMenu()
  assert.equal(item('Claude 貓語氣').checked, true, '/cat-voice switching it back on shows here')
  console.log('ok - the voice switch is kept beside the coat, and follows /cat-voice')

  // The Siamese: cream, with soft points and blue eyes.
  await inLook('document.querySelector("[data-look=coat] [data-value=siamese]").click()')
  await waitFor(async () => (await coat()) === 'siamese', 'the Siamese coat')
  assert.equal(prefs().coat, 'siamese', 'kept for the Claude cat to follow')
  assert.ok((await drawing()).includes('points-siamese'), 'drawn with its points')
  await wait(300)
  fs.writeFileSync(path.join(shots, 'pet-siamese.png'), (await page.capturePage()).toPNG())
  console.log('ok - the window puts on the Siamese coat')

  await inLook('document.querySelector("[data-look=coat] [data-value=calico]").click()')
  await waitFor(async () => (await coat()) === 'calico', 'back to calico')
  await waitFor(async () => (await inLook('document.querySelector("[data-look=coat] .on").dataset.value')) === 'calico', 'the window to mark calico')
  assert.equal(await drawing(), calicoTalking, 'the calico drawing as it was')
  assert.deepEqual(prefs(), { coat: 'calico', voice: true })
  console.log('ok - and back to calico')

  await inLook('document.querySelector("[data-look=cushion] [data-value=berry]").click()')
  await waitFor(
    async () => (await inPage("stage.style.getPropertyValue('--cushion')")) === '#B84C67',
    'the berry cushion',
  )
  assert.deepEqual(prefs(), { coat: 'calico', voice: true, cushion: 'berry' }, 'kept beside the coat')
  await waitFor(async () => (await inLook('document.querySelector("[data-named=cushion]").textContent')) === '莓果紅', 'its name shown')
  assert.deepEqual(
    await inLook('[...document.querySelectorAll("[data-look] .on")].map(chosen => chosen.dataset.value)'),
    ['calico', 'medium', 'berry', 'coral', 'tuna', 'none', 'medium'],
    'each row marks what is chosen',
  )
  assert.equal(await inLook('document.getElementById("stand").classList.contains("lying")'), true, 'the picture shows the cat on its cushion')
  fs.writeFileSync(path.join(shots, 'look-window.png'), (await look.webContents.capturePage()).toPNG())
  console.log('ok - the window changes the cushion colour, its name beside it')

  if (HAS_PLACES) {
    await scenes.places({ assert, fs, path, root, shots, win, look, screen, BrowserWindow, inPage, inLook, waitFor, wait, prefs, openMenu })
  } else {
    // No places in this copy: no tabs on the appearance window, only its one page.
    assert.equal(await inLook('getComputedStyle(document.querySelector(".tabs")).display'), 'none', 'no tabs')
    console.log('ok - with no places in this copy, the appearance window has one page and no tabs')
  }

  // The cans: how much of Claude's use is left, from the file the Claude cat writes.
  const usageFile = path.join(root, 'usage.json')
  const stack = () => inPage('canStack.dataset.stack')
  assert.equal(await stack(), '5 full', 'nothing heard yet: a full stack')
  const later = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  fs.writeFileSync(usageFile, JSON.stringify({ fiveHour: { percentUsed: 88, resetsAt: later }, sevenDay: { percentUsed: 45, resetsAt: later }, seenAt: Date.now() }))
  await waitFor(async () => (await stack()) === '3 low', 'three cans, the open one nearly eaten')
  assert.equal(await inPage('hint.textContent'), '這一餐剩 12%・這週剩 55%')
  assert.equal(await inPage('hint.querySelector(".low").textContent'), '這一餐剩 12%', 'nearly gone in red')
  // Too narrow for one line, the meal goes over the week and the mark between
  // them goes; wide enough again, they share the line.
  assert.deepEqual(
    await inPage(`(() => {
      hint.style.maxWidth = '100px'
      fitHint()
      const narrow = [hint.classList.contains('stacked'), getComputedStyle(hint.querySelector('.between')).display]
      hint.style.maxWidth = ''
      fitHint()
      return [...narrow, hint.classList.contains('stacked')]
    })()`),
    [true, 'none', false],
    'the hint breaks only between the meal and the week',
  )

  // Under the pointer for a moment, the cans show the hint; the cat's gaps do not.
  // Sitting, the cat's box overlaps the cans; only what it paints may cover them.
  win.setIgnoreMouseEvents(false)
  assert.equal(await pose(), 'talking', 'the cat sits beside its cans')
  const bottomRow = JSON.parse(await inPage(`(() => {
    const box = canStack.firstElementChild.getBoundingClientRect()
    return JSON.stringify([0.2, 0.5, 0.8].map(across => ({ x: Math.round(box.left + box.width * across), y: Math.round(box.top + box.height * 0.8) })))
  })()`))
  for (const can of bottomRow) {
    assert.equal(await inPage(`isCansAt(${can.x}, ${can.y})`), true, `a can at ${can.x}, ${can.y}: ${await inPage(`document.elementFromPoint(${can.x}, ${can.y})?.outerHTML.slice(0, 80)`)}`)
  }
  // The left can, the one inside the sitting cat's box.
  const onCans = bottomRow[0]
  page.sendInputEvent({ type: 'mouseMove', x: 1, y: 1 })
  await wait(100)
  page.sendInputEvent({ type: 'mouseMove', ...onCans })
  await waitFor(() => inPage("hint.classList.contains('shown')"), 'the hint over the cans')
  assert.equal(await inPage('document.body.dataset.over'), 'true', 'the cans take the pointer')
  fs.writeFileSync(path.join(shots, 'cans-hint.png'), (await page.capturePage()).toPNG())
  page.sendInputEvent({ type: 'mouseMove', x: 1, y: 1 })
  await waitFor(async () => !(await inPage("hint.classList.contains('shown')")), 'the hint to go')
  console.log('ok - the cans show what is left, and a hint under the pointer')

  // A fill time passing fills the can again, with nothing more written.
  const soon = new Date(Date.now() + 1500).toISOString()
  fs.writeFileSync(usageFile, JSON.stringify({ fiveHour: { percentUsed: 100, resetsAt: soon }, sevenDay: { percentUsed: 100, resetsAt: later }, seenAt: Date.now() }))
  await waitFor(async () => (await stack()) === '0 empty', 'the week eaten: one empty can')
  assert.equal(await inPage('hint.textContent'), '這一餐吃光了・這週吃光了')
  fs.writeFileSync(usageFile, JSON.stringify({ fiveHour: { percentUsed: 100, resetsAt: soon }, sevenDay: { percentUsed: 30, resetsAt: later }, seenAt: Date.now() }))
  await waitFor(async () => (await stack()) === '4 empty', 'this meal eaten')
  await waitFor(async () => (await stack()) === '4 full', 'filled again once its time comes', 8000)
  console.log('ok - a meal used up fills again by the clock')

  await inLook('document.querySelector("[data-look=canLabel] [data-value=berry]").click()')
  await inLook('document.querySelector("[data-look=canFood] [data-value=beef]").click()')
  await waitFor(async () => (await inPage("canStand.style.getPropertyValue('--food')")) === '#B07D63', 'beef in the cans')
  assert.equal(await inPage("canStand.style.getPropertyValue('--label')"), '#B84C67', 'berry labels')
  await inLook('document.querySelector("[data-switch=cansShown]").click()')
  await waitFor(() => inPage('canStand.hidden'), 'the cans put away')
  assert.equal(await inLook('document.querySelector("[data-needs-cans]").classList.contains("is-off")'), true, 'their colours wait, greyed')
  const kept = JSON.parse(fs.readFileSync(path.join(root, 'user-data', 'settings.json'), 'utf8'))
  assert.deepEqual([kept.cansShown, kept.canLabel, kept.canFood], [false, 'berry', 'beef'], 'kept for next time')
  await inLook('document.querySelector("[data-switch=cansShown]").click()')
  await waitFor(async () => !(await inPage('canStand.hidden')), 'the cans back')
  console.log('ok - the window dresses the cans and puts them away')
  look.close()

  report('awake', 'resting', Date.now(), true)
  report('quiet', 'resting', Date.now(), true)
  report('latest', 'resting', Date.now(), true)
  await expectMood('resting', 'all conversations ended')
  await wait(5500)
  assert.equal(await pose(), 'resting', 'lying down on its cushion')
  assert.equal(await inPage('getComputedStyle(canStand).zIndex'), '1', 'the cans in front of the cushion')
  assert.equal(
    await inPage("getComputedStyle(stage.querySelector('path')).fill"),
    'rgb(184, 76, 103)',
    'the cushion it lies on is berry red',
  )
  fs.writeFileSync(path.join(shots, 'pet-berry-cushion.png'), (await page.capturePage()).toPNG())
  console.log('ok - asleep, the cat lies on the cushion colour chosen')

  // The cat and its effects were put on top, and never in the layer behind the taskbar.
  assert.ok(onTopAsked.filter(asked => asked.flag === true).length >= (HAS_PLACES ? 2 : 1), 'the cat, and its effects where there are places, on top')
  assert.deepEqual(
    onTopAsked.filter(asked => asked.flag === true && BEHIND_TASKBAR.includes(asked.level)),
    [],
    "no level that Electron puts behind Windows' taskbar",
  )
  console.log('ok - the cat stays on top in a layer of its own, never behind the taskbar')

  console.log('ALL PASSED')
}

run()
  .catch(error => {
    console.error('FAILED:', error.message)
    process.exitCode = 1
  })
  .finally(() => {
    fs.rmSync(sessions, { recursive: true, force: true })
    app.exit(process.exitCode ?? 0)
  })
