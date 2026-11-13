const stage = document.getElementById('cat')
const canStand = document.getElementById('cans')
const canStack = canStand.querySelector('.stack')
const hint = document.getElementById('hint')

const query = new URLSearchParams(location.search)
// The window leaves room all round the cat, as a share of the cat's size.
const room = Number(query.get('room') ?? 0)
stage.style.inset = `${(room / (1 + 2 * room)) * 100}%`
canStand.style.inset = stage.style.inset
// The coat chosen in the menu, which the page starts in.
let coat = window.POSES[query.get('coat')] === undefined ? 'calico' : query.get('coat')
// Where the cat is, which it dresses for: none, or a place it has things for.
let place = query.get('place') ?? 'none'
// The little effects on the cat's things in a place, while effects are on.
PropEffects.show({ on: query.get('effects') !== 'false' })

/** Colours the cushion the cat lies on; its drawings take them from the page. */
function lieOn({ colour, seam }) {
  stage.style.setProperty('--cushion', colour)
  stage.style.setProperty('--cushion-seam', seam)
}

// The cushion chosen in the menu, which the page starts with.
if (query.has('cushion')) {
  lieOn({ colour: query.get('cushion'), seam: query.get('cushionSeam') })
}

// Where each kind of pose keeps its parts, and the spot it sits on, in the
// drawing's own coordinates; its viewBox says which of them shows.
const SITTING = {
  seat: { x: 977, y: 1863 },
  zones: {
    head: { left: 460, right: 1230, top: 90, bottom: 500 },
  },
}
const LYING = {
  seat: { x: 1254, y: 1980 },
  zones: {
    head: { left: 330, right: 1344, top: 660, bottom: 1170 },
  },
}

const isLying = pose => pose === 'resting' || pose.startsWith('rest-')

// Under the pointer this long, the cans show how much is left.
const HINT_AFTER_MS = 300
// Changing size: as long as the page's fade out takes, and the longest the
// cat waits for its window to change before fading back in anyway.
const FADE_OUT_MS = 100
const RESIZE_WAIT_MS = 500
// Frames drawn before the screen surely shows the last of them: measured on
// a recording, it can lag three or four behind.
const FRAMES_SHOWN = 6

// Rubbing back and forth counts as another touch every so far.
const STROKE_PIXELS = 160
const REACTION_MS = 2200
// Done with the work, the cat dozes sitting up, and lies down if nothing comes up.
const LIE_DOWN_AFTER_MS = 5000

// Carried around, the cat bends like jelly on a moving plate: its seat stays
// put while its top lags behind, slanting side to side and squashing or
// stretching up and down, and it wobbles back once it stops. Tuned by feel
// on a page made to try them. It bends about the spot it sits on.
const JELLY = {
  slantPerSpeed: 0.0018, // degrees for each pixel a second
  mostSlant: 12, // degrees
  stretchPerSpeed: 0.00003, // share of its height for each pixel a second
  mostStretch: 0.18,
  wobblesPerSecond: 1.6,
  damping: 0.19,
}

let isOverCat = false
let isDragging = false
let petting = null
let currentMood = 'resting'
let reactionTimer = null
let lieDownTimer = null
let hasLainDown = true
// What the cans show, as the main program last said: until it says, a full stack.
let cans = { count: 5, level: 'full', meal: null, week: null }
let cansShown = true
let hintTimer = null
// The window's words, once the main program has sent them (src/text.js).
let t = () => ''
let isFadingOut = false
let fadesOut = 0

/** What the mood looks like now: resting starts as a doze sitting up. */
const moodPose = () =>
  currentMood === 'resting' && !hasLainDown ? 'dozing' : currentMood

function doze() {
  hasLainDown = false
  clearTimeout(lieDownTimer)
  lieDownTimer = setTimeout(() => {
    hasLainDown = true

    if (reactionTimer === null) {
      draw(moodPose())
    }
  }, LIE_DOWN_AFTER_MS)
}

function draw(pose) {
  const source = window.POSES[coat][pose]
  const { dataset } = document.body

  if (source === undefined || (dataset.pose === pose && dataset.coat === coat && dataset.place === place)) {
    return
  }

  const drawing = new DOMParser().parseFromString(window.dressed(source, place), 'image/svg+xml')
  const root = document.adoptNode(drawing.documentElement)
  stage.replaceChildren(root, PropEffects.canvas)
  // Its moves play from their start, the way the pose begins, however long the page has been open.
  root.setCurrentTime(0)
  const view = root.viewBox.baseVal
  PropEffects.show({
    effects: window.PLACE_ART[place]?.effects ?? null,
    lying: isLying(pose),
    view: { x: view.x, y: view.y, width: view.width, height: view.height },
  })
  const { seat } = isLying(pose) ? LYING : SITTING
  stage.style.transformOrigin = `${((seat.x - view.x) / view.width) * 100}% ${((seat.y - view.y) / view.height) * 100}%`
  dataset.pose = pose
  dataset.coat = coat
  dataset.place = place
  document.body.classList.toggle('lying', isLying(pose))
  Sound.setLoop('typing', pose === 'working')
  Sound.setLoop('purr', pose === 'pet-head' || pose === 'rest-head')
  Sound.setChatter(pose === 'talking')
}

/** Puts on another coat, in whatever pose the cat is in. */
function wear(wanted) {
  if (window.POSES[wanted] !== undefined && wanted !== coat) {
    coat = wanted
    draw(document.body.dataset.pose)
  }
}

/** Goes to another place, or home, dressing for it in whatever pose the cat is in. */
function goTo(wanted) {
  if (wanted !== place) {
    place = wanted
    draw(document.body.dataset.pose)
  }
}

function show(mood) {
  if (window.POSES[coat][mood] !== undefined) {
    if (mood === 'resting' && currentMood !== 'resting') {
      doze()
    }

    currentMood = mood
    document.body.dataset.mood = mood

    if (reactionTimer === null) {
      draw(moodPose())
    }
  }
}

/** Whether the point is on what is painted of this drawing, not its gaps. */
function isOnDrawing(drawing, x, y) {
  const found = document.elementFromPoint(x, y)
  const root = drawing.firstElementChild

  return found !== null && root !== null && found !== root && root.contains(found)
}

const isCansAt = (x, y) => cansShown && isOnDrawing(canStack, x, y)
// The cans count as the cat's: they keep the window's clicks, and carry it.
const isCatAt = (x, y) => isOnDrawing(stage, x, y) || isCansAt(x, y)

// Stands in for the figure while a sentence is looked up, so that each
// language's table decides where in its sentence the figure goes.
const FIGURE = '\u{E000}'

/** The hint's words: what is left of this meal and of the week, red when nearly gone. */
function hintWords() {
  if (cans.meal === null && cans.week === null) {
    return [document.createTextNode(t('cans.unknown'))]
  }

  // `of` is 'meal' or 'week', each with whole sentences of its own in the tables.
  const part = (of, left) => {
    const words = document.createElement('span')
    words.className = left < 20 ? 'part low' : 'part'

    if (left === 0) {
      words.textContent = t(`cans.${of}Gone`)
    } else {
      const figure = document.createElement('b')
      figure.textContent = new Intl.NumberFormat(document.documentElement.lang, { style: 'percent' }).format(left / 100)
      const [before, after = ''] = t(`cans.${of}Left`, { percent: FIGURE }).split(FIGURE)
      words.append(before, figure, after)
    }

    return words
  }
  const parts = [
    ...(cans.meal === null ? [] : [part('meal', cans.meal)]),
    ...(cans.week === null ? [] : [part('week', cans.week)]),
  ]

  return parts.flatMap((words, i) => {
    if (i === 0) {
      return [words]
    }

    const between = document.createElement('span')
    between.className = 'between'
    between.textContent = t('cans.between')
    return [between, words]
  })
}

/** One line when the hint fits the window, else one part under the other:
    the line breaks only between the meal and the week, never inside one. */
function fitHint() {
  hint.classList.remove('stacked')
  const [first, ...rest] = hint.querySelectorAll('.part')

  if (rest.some(part => part.offsetTop > first.offsetTop)) {
    hint.classList.add('stacked')
  }
}

/** Draws the stack the cans show now, in their colours, or nothing when switched off. */
function fillCans() {
  canStand.hidden = !cansShown
  const key = `${cans.count} ${cans.level}`

  if (canStack.dataset.stack !== key && window.CANS[key] !== undefined) {
    const drawing = new DOMParser().parseFromString(window.CANS[key], 'image/svg+xml')
    canStack.replaceChildren(document.adoptNode(drawing.documentElement))
    canStack.dataset.stack = key
  }

  hint.replaceChildren(...hintWords())
  fitHint()

  if (!cansShown) {
    hideHint()
  }
}

function dressCans({ shown, label, food }) {
  cansShown = shown === true
  canStand.style.setProperty('--label', label)
  canStand.style.setProperty('--food', food.food)
  canStand.style.setProperty('--food-dark', food.dark)
  canStand.style.setProperty('--food-light', food.light)
  fillCans()
}

function showHint() {
  hintTimer = null
  // Above the cans, lined up with their right edge, and kept inside the window.
  const box = canStack.getBoundingClientRect()
  hint.style.bottom = `${innerHeight - box.top + 6}px`
  hint.style.right = `${Math.max(4, innerWidth - box.right)}px`
  // The window may have changed size with the cat since the words came.
  fitHint()
  hint.classList.add('shown')
}

function hideHint() {
  clearTimeout(hintTimer)
  hintTimer = null
  hint.classList.remove('shown')
}

function noteCans(x, y) {
  if (!isCansAt(x, y)) {
    hideHint()
  } else if (hintTimer === null && !hint.classList.contains('shown')) {
    hintTimer = setTimeout(showHint, HINT_AFTER_MS)
  }
}

function zoneAt(x, y) {
  if (!isCatAt(x, y)) {
    return null
  }

  const { zones } = isLying(document.body.dataset.pose) ? LYING : SITTING
  const view = stage.firstElementChild.viewBox.baseVal
  const scale = view.width / stage.clientWidth
  const viewX = (x - stage.offsetLeft) * scale + view.x
  const viewY = (y - stage.offsetTop) * scale + view.y

  for (const [zone, box] of Object.entries(zones)) {
    if (
      viewX >= box.left &&
      viewX <= box.right &&
      viewY >= box.top &&
      viewY <= box.bottom
    ) {
      return zone
    }
  }

  return null
}

function touch(zone) {
  const isLyingDown = isLying(document.body.dataset.pose)

  window.desktopCat.pet(zone)
  draw(isLyingDown ? `rest-${zone}` : `pet-${zone}`)

  // Petted while dozing off, it stays up a little longer before lying down.
  if (!isLyingDown && currentMood === 'resting') {
    doze()
  }

  clearTimeout(reactionTimer)
  reactionTimer = setTimeout(() => {
    reactionTimer = null
    draw(moodPose())
  }, REACTION_MS)
}

// Where the pointer is on the screen while it carries the cat.
let carriedTo = { x: 0, y: 0 }
let lastCarriedTo = carriedTo
let speedX = 0
let speedY = 0
let slant = 0
let slanting = 0
let stretch = 0
let stretching = 0
let lastFrame = 0
let jellyFrame = null

// Bends further the faster it goes, easing off as it nears the most it may.
const softLimit = (value, most) => most * Math.tanh(value / most)
const clamp = (value, most) => Math.min(Math.max(value, -most), most)

function wobble(now) {
  const seconds = Math.min((now - lastFrame) / 1000, 0.05)
  lastFrame = now

  if (seconds > 0) {
    const smoothing = 1 - Math.exp(-seconds / 0.035)
    speedX += ((carriedTo.x - lastCarriedTo.x) / seconds - speedX) * smoothing
    speedY += ((carriedTo.y - lastCarriedTo.y) / seconds - speedY) * smoothing
    lastCarriedTo = carriedTo

    // Carried left, its top slants right; lifted, it squashes; lowered, it stretches.
    const slantTo = softLimit(-speedX * JELLY.slantPerSpeed, JELLY.mostSlant)
    const stretchTo = softLimit(speedY * JELLY.stretchPerSpeed, JELLY.mostStretch)
    // Springs pull it toward that shape, overshooting a little each way.
    const stiffness = (2 * Math.PI * JELLY.wobblesPerSecond) ** 2
    const friction = 2 * JELLY.damping * Math.sqrt(stiffness)
    const steps = Math.ceil(seconds * 240)
    const step = seconds / steps

    for (let i = 0; i < steps; i += 1) {
      slanting += (stiffness * (slantTo - slant) - friction * slanting) * step
      slant += slanting * step
      stretching += (stiffness * (stretchTo - stretch) - friction * stretching) * step
      stretch += stretching * step
    }
  }

  const isStill =
    !isDragging &&
    Math.abs(speedX) + Math.abs(speedY) < 1 &&
    Math.abs(slant) + Math.abs(slanting) < 0.01 &&
    Math.abs(stretch) + Math.abs(stretching) < 0.0005

  if (isStill) {
    speedX = speedY = slant = slanting = stretch = stretching = 0
    stage.style.transform = ''
    jellyFrame = null
    return
  }

  // Its room only fits so much, however far a wobble overshoots. A negative
  // shear moves the top right; squashed shorter, it grows as much wider.
  const tall = 1 + clamp(stretch, JELLY.mostStretch)
  stage.style.transform = `skewX(${-clamp(slant, JELLY.mostSlant)}deg) scale(${1 / tall}, ${tall})`
  jellyFrame = requestAnimationFrame(wobble)
}

function startCarrying(x, y) {
  carriedTo = { x, y }
  lastCarriedTo = carriedTo

  if (jellyFrame === null) {
    lastFrame = performance.now()
    jellyFrame = requestAnimationFrame(wobble)
  }
}

function setOverCat(isOver) {
  if (isOver !== isOverCat) {
    isOverCat = isOver
    document.body.dataset.over = String(isOver)
    window.desktopCat.setInteractive(isOver)
  }
}

function notePointer(x, y) {
  setOverCat(isCatAt(x, y))
  noteCans(x, y)
  const zone = zoneAt(x, y)

  if (zone === null) {
    delete document.body.dataset.zone
  } else {
    document.body.dataset.zone = zone
  }
}

window.addEventListener('pointermove', event => {
  if (isDragging) {
    carriedTo = { x: event.screenX, y: event.screenY }
    window.desktopCat.dragMove()
  } else if (petting !== null) {
    petting.travelled +=
      Math.abs(event.clientX - petting.x) + Math.abs(event.clientY - petting.y)
    petting.x = event.clientX
    petting.y = event.clientY

    if (petting.travelled >= STROKE_PIXELS) {
      petting.travelled = 0
      touch(petting.zone)
    }
  } else {
    notePointer(event.clientX, event.clientY)
  }
})

window.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !isOverCat) {
    return
  }

  document.documentElement.setPointerCapture(event.pointerId)
  hideHint()
  const zone = zoneAt(event.clientX, event.clientY)

  if (zone !== null) {
    petting = { zone, x: event.clientX, y: event.clientY, travelled: 0 }
    touch(zone)
  } else {
    isDragging = true
    document.body.classList.add('dragging')
    startCarrying(event.screenX, event.screenY)
    Sound.shot('mew')
    window.desktopCat.dragStart()
  }
})

function endPress(event) {
  petting = null

  if (isDragging) {
    isDragging = false
    document.body.classList.remove('dragging')
    window.desktopCat.dragEnd()
  }

  notePointer(event.clientX, event.clientY)
}

window.addEventListener('pointerup', endPress)
window.addEventListener('pointercancel', endPress)

function leavePointer() {
  if (!isDragging && petting === null) {
    setOverCat(false)
    delete document.body.dataset.zone
  }

  hideHint()
}

document.documentElement.addEventListener('mouseleave', leavePointer)

// Told where the pointer is while clicks go through (Linux, macOS). Held down
// to carry or pet, the window hears the mouse itself, and these are left alone:
// else the pointer slipping off the cat would let the clicks through again and
// the release would never arrive.
window.desktopCat.onPointer(({ x, y }) => {
  if (!isDragging && petting === null) {
    notePointer(x, y)
  }
})
window.desktopCat.onPointerOut(leavePointer)

// Once this many more frames are drawn. The screen shows a frame a little
// after the page draws it, so waiting a few makes sure it has.
const afterFrames = (count, then) =>
  requestAnimationFrame(() => (count > 1 ? afterFrames(count - 1, then) : then()))

/** Fades the cat out before its window changes size, and says when it has. */
function fadeOut() {
  hideHint()

  fadesOut += 1

  if (isFadingOut) {
    return
  }

  isFadingOut = true
  document.body.classList.add('resizing')
  setTimeout(
    () =>
      afterFrames(FRAMES_SHOWN, () => {
        isFadingOut = false
        window.desktopCat.faded()
      }),
    FADE_OUT_MS,
  )
}

/** Fades the cat back in once the window is its new size and drawn so,
    unless it has been asked to change size again meanwhile. */
function fadeIn(side) {
  const askedAt = performance.now()
  const fade = fadesOut
  const appear = () => {
    if (innerWidth !== side && performance.now() - askedAt < RESIZE_WAIT_MS) {
      requestAnimationFrame(appear)
    } else {
      afterFrames(FRAMES_SHOWN, () => {
        if (fade === fadesOut) {
          document.body.classList.remove('resizing')
        }
      })
    }
  }

  appear()
}

window.addEventListener('contextmenu', event => {
  event.preventDefault()

  if (isOverCat) {
    window.desktopCat.showMenu()
  }
})

window.desktopCat.onMood(show)
// The cat's own sounds, and the sound of the place it is in.
window.desktopCat.onSound(sound => {
  Sound.configure(sound)
  Ambience.configure(sound)
})
window.desktopCat.onMeow(() => Sound.shot('meow'))
window.desktopCat.onCoat(wear)
window.desktopCat.onCushion(lieOn)
window.desktopCat.onPlace(goTo)
window.desktopCat.onEffects(isOn => PropEffects.show({ on: isOn }))
window.desktopCat.onUsage(shown => {
  cans = shown
  fillCans()
})
window.desktopCat.onCans(dressCans)
window.desktopCat.onFadeOut(fadeOut)
window.desktopCat.onFadeIn(fadeIn)
show('resting')
fillCans()
window.desktopCat.ready()
// The words come a moment later; the hint is filled again with them, and again
// whenever another language is picked in the menu.
const askForText = () =>
  window.startText(window.desktopCat.text).then(found => {
    t = found
    fillCans()
  })
askForText()
window.desktopCat.onTextChanged(askForText)
