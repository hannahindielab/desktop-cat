// The appearance window: how the cat and its cans look, with a live picture
// of them on top. Each choice is asked of the main program, which keeps it and
// tells the cat; the window shows what it says came of the ask.
const stand = document.getElementById('stand')
const cat = document.getElementById('cat')
const canSpot = document.getElementById('cans')

// The picture's cat at the sizes it may be, against the medium one.
const SIZES = { small: 0.82, medium: 1, large: 1.12 }

let now = null
let choices = null
// Sitting beside the cans; asleep on the cushion while its colour is chosen.
let picturePose = 'working'
let drawn = ''

const drawingOf = source =>
  document.adoptNode(new DOMParser().parseFromString(source, 'image/svg+xml').documentElement)
const find = (list, id) => list.find(choice => choice.id === id) ?? list[0]

function paintPicture() {
  const wanted = `${now.coat} ${picturePose}`

  // Drawn again only when it changes, so its moves keep going.
  if (wanted !== drawn) {
    cat.replaceChildren(drawingOf(window.POSES[now.coat][picturePose]))
    drawn = wanted
  }

  const cushion = find(choices.cushions, now.cushion)
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
  picturePose = name === 'cushion' ? 'resting' : 'working'
  window.look.set({ [name]: value })
}

/** Buttons side by side, one chosen. */
function segments(name, options) {
  return options.map(option => {
    const button = document.createElement('button')
    button.className = 'segment'
    button.dataset.value = option.id
    button.textContent = option.label
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
    button.title = option.label
    button.setAttribute('aria-label', option.label)
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
    document.querySelector(`[data-named="${name}"]`).textContent = find(list, now[name]).label
  }

  const cansSwitch = document.querySelector('[data-switch="cansShown"]')
  cansSwitch.classList.toggle('on', now.cansShown)
  cansSwitch.setAttribute('aria-checked', String(now.cansShown))
  document.querySelectorAll('[data-needs-cans]').forEach(row => row.classList.toggle('is-off', !now.cansShown))
  paintPicture()
}

async function start() {
  const answer = await window.look.get()
  choices = answer.choices

  const fill = (name, buttons) => document.querySelector(`[data-look="${name}"]`).replaceChildren(...buttons)
  fill('coat', segments('coat', choices.coats))
  fill('size', segments('size', choices.sizes))
  fill('cushion', swatches('cushion', choices.cushions, cushion => cushion.colour))
  fill('canLabel', swatches('canLabel', choices.labels, label => label.colour))
  fill('canFood', swatches('canFood', choices.foods, food => food.food))
  document.querySelector('[data-switch="cansShown"]').addEventListener('click', () => {
    picturePose = 'working'
    window.look.set({ cansShown: !now.cansShown })
  })
  canSpot.replaceChildren(drawingOf(window.CANS['5 full']))

  window.look.onNow(showNow)
  showNow(answer.now)
  window.look.fit(document.body.getBoundingClientRect().height)
}

start()
