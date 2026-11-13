// The appearance window: how the cat and its cans look, and where the cat is,
// on two pages under a live picture of them. Each choice is asked of the main
// program, which keeps it and tells the cat; the window shows what it says
// came of the ask.
const stand = document.getElementById('stand')
const cat = document.getElementById('cat')
const canSpot = document.getElementById('cans')

// The picture's cat at the sizes it may be, against the medium one.
const SIZES = { small: 0.82, medium: 1, large: 1.12 }

let now = null
let choices = null
// The window's words, once the main program has sent them (src/text.js).
let t = () => ''
// Where each choice's names are in the tables: the cushions and the cans'
// labels share the colour names.
const NAMES = {
  coat: 'coat',
  size: 'size',
  cushion: 'colour',
  canLabel: 'colour',
  canFood: 'food',
  place: 'place',
  placeVolume: 'volume',
}
const nameOf = (name, id) => t(`${NAMES[name]}.${id}`)
// Sitting beside the cans; asleep on the cushion while its colour, or the
// place that brings one, is chosen.
let picturePose = 'working'
let drawn = ''

const drawingOf = source =>
  document.adoptNode(new DOMParser().parseFromString(source, 'image/svg+xml').documentElement)
const find = (list, id) => list.find(choice => choice.id === id) ?? list[0]
const placeNow = () => find(choices.places, now.place)
// In a place, the cat lies on the place's cushion, not the one chosen.
const cushionNow = () => placeNow().cushion ?? find(choices.cushions, now.cushion)

function paintPicture() {
  const wanted = `${now.coat} ${picturePose} ${now.place}`

  // Drawn again only when it changes, so its moves keep going; dressed for its place.
  if (wanted !== drawn) {
    cat.replaceChildren(drawingOf(window.dressed(window.POSES[now.coat][picturePose], now.place)))
    drawn = wanted
  }

  const cushion = cushionNow()
  const food = find(choices.foods, now.canFood)
  stand.classList.toggle('lying', picturePose === 'resting')
  stand.style.setProperty('--cushion', cushion.colour)
  stand.style.setProperty('--cushion-seam', cushion.seam)
  stand.style.setProperty('--label', find(choices.labels, now.canLabel).colour)
  stand.style.setProperty('--food', food.food)
  stand.style.setProperty('--food-dark', food.dark)
  stand.style.setProperty('--food-light', food.light)
  stand.style.transform = `scale(${SIZES[now.size] ?? 1})`
  canSpot.style.opacity = now.cansShown ? '1' : '0'
}

function ask(name, value) {
  if (name !== 'placeVolume') {
    picturePose = name === 'cushion' || name === 'place' ? 'resting' : 'working'
  }

  window.look.set({ [name]: value })
}

/** Shows one page, and fits the window to it. */
function showPage(name) {
  for (const tab of document.querySelectorAll('[data-tab]')) {
    const isThis = tab.dataset.tab === name
    tab.classList.toggle('on', isThis)
    tab.setAttribute('aria-selected', String(isThis))
  }

  for (const page of document.querySelectorAll('[data-page]')) {
    page.hidden = page.dataset.page !== name
  }

  window.look.fit(document.body.getBoundingClientRect().height)
}

/** Buttons side by side, one chosen. */
function segments(name, options) {
  return options.map(option => {
    const button = document.createElement('button')
    button.className = 'segment'
    button.dataset.value = option.id
    button.textContent = nameOf(name, option.id)
    button.addEventListener('click', () => ask(name, option.id))

    return button
  })
}

/** Round colours in a row, one ringed; each says its name. */
function swatches(name, options, colourOf) {
  return options.map(option => {
    const button = document.createElement('button')
    button.className = 'swatch'
    button.dataset.value = option.id
    button.title = nameOf(name, option.id)
    button.setAttribute('aria-label', nameOf(name, option.id))
    button.style.setProperty('--swatch', colourOf(option))
    button.addEventListener('click', () => ask(name, option.id))

    return button
  })
}

function showNow(next) {
  now = next

  for (const group of document.querySelectorAll('[data-look]')) {
    for (const button of group.children) {
      button.classList.toggle('on', button.dataset.value === now[group.dataset.look])
    }
  }

  const names = { cushion: choices.cushions, canLabel: choices.labels, canFood: choices.foods }
  for (const [name, list] of Object.entries(names)) {
    document.querySelector(`[data-named="${name}"]`).textContent = nameOf(name, find(list, now[name]).id)
  }

  for (const toggle of document.querySelectorAll('[data-switch]')) {
    const isOn = now[toggle.dataset.switch] === true
    toggle.classList.toggle('on', isOn)
    toggle.setAttribute('aria-checked', String(isOn))
  }
  document.querySelectorAll('[data-needs-cans]').forEach(row => row.classList.toggle('is-off', !now.cansShown))

  // In a place, its cushion is the place's, and its volume can be set.
  const isInPlace = now.place !== 'none'
  if (isInPlace) {
    document.querySelector('[data-named="cushion"]').textContent = t('look.cushionFollowsPlace', {
      place: nameOf('place', placeNow().id),
    })
  }
  document.querySelectorAll('[data-follows-place]').forEach(row => row.classList.toggle('is-off', isInPlace))
  document.querySelectorAll('[data-needs-place]').forEach(row => row.classList.toggle('is-off', !isInPlace))
  paintPicture()
}

async function start() {
  t = await window.startText(window.look.text)
  const answer = await window.look.get()
  choices = answer.choices
  // With no places in this copy there is only the one page: no tabs at all.
  if (choices.places.length <= 1) {
    document.querySelector('.tabs').style.display = 'none'
  }

  const fill = (name, buttons) => document.querySelector(`[data-look="${name}"]`).replaceChildren(...buttons)
  fill('coat', segments('coat', choices.coats))
  fill('size', segments('size', choices.sizes))
  fill('cushion', swatches('cushion', choices.cushions, cushion => cushion.colour))
  fill('canLabel', swatches('canLabel', choices.labels, label => label.colour))
  fill('canFood', swatches('canFood', choices.foods, food => food.food))
  fill('place', segments('place', choices.places))
  fill('placeVolume', segments('placeVolume', choices.placeVolumes))
  document.querySelector('[data-switch="cansShown"]').addEventListener('click', () => {
    picturePose = 'working'
    window.look.set({ cansShown: !now.cansShown })
  })
  document.querySelector('[data-switch="effectsOn"]').addEventListener('click', () => window.look.set({ effectsOn: !now.effectsOn }))
  for (const tab of document.querySelectorAll('[data-tab]')) {
    tab.addEventListener('click', () => showPage(tab.dataset.tab))
  }
  canSpot.replaceChildren(drawingOf(window.CANS['5 full']))

  window.look.onNow(showNow)
  showNow(answer.now)
  window.look.fit(document.body.getBoundingClientRect().height)
}

start()
