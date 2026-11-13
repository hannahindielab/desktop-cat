// Rebuilds src/poses.js and src/cushions.json from the cat drawings in the
// Claude plugin, so the desktop cat and the plugin's cat always look the same,
// in every coat and on every cushion; and src/place-art.js and
// src/place-cushions.json, what the cat wears and lies on in each place.
//
// Run from the desktop app's folder: node tools/build-poses.mjs [plugin hooks folder]
// (the hooks folder defaults to ../plugin/hooks, beside this app).
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const hooks = resolve(process.argv[2] ?? join(app, '..', 'plugin', 'hooks'))
const ART = ['coat-art', 'fish-art', 'place-art']

// Node runs TypeScript as modules only under .mts names, so copy them aside.
const work = mkdtempSync(join(tmpdir(), 'desktop-cat-poses-'))
try {
  for (const art of ART) {
    copyFileSync(join(hooks, `${art}.ts`), join(work, `${art}.mts`))
  }
  let cats = readFileSync(join(hooks, 'cats.ts'), 'utf8')
  for (const art of ART) {
    cats = cats.replace(`'./${art}'`, `'./${art}.mts'`)
  }
  writeFileSync(join(work, 'cats.mts'), cats)
  const { COATS, CUSHIONS, posesWearing } = await import(pathToFileURL(join(work, 'cats.mts')).href)
  const { PLACE_ART } = await import(pathToFileURL(join(work, 'place-art.mts')).href)

  // The cushion takes its colours from the page, so one drawing serves them all.
  const [starting] = CUSHIONS
  const anyCushion = {
    colour: `var(--cushion, ${starting.colour})`,
    seam: `var(--cushion-seam, ${starting.seam})`,
  }
  // Each pose keeps a mark where a place's things go, and the page fills it
  // in for where the cat is (src/dress.js), so one drawing serves every place.
  const mark = (where, pose) => `<!--dress:${where}:${pose}-->`
  const MARKS = {
    head: { sitting: mark('head', 'sitting'), lying: mark('head', 'lying') },
    beside: { sitting: mark('beside', 'sitting'), lying: mark('beside', 'lying') },
  }
  const posesOf = coat => {
    const all = posesWearing(coat, anyCushion, MARKS)

    return {
      resting: all.RESTING,
      dozing: all.DOZING,
      waiting: all.WAITING,
      calling: all.CALLING,
      thinking: all.THINKING,
      working: all.WORKING,
      talking: all.TALKING,
      sad: all.SAD,
      'pet-head': all.PET_HEAD,
      'rest-head': all.REST_HEAD,
    }
  }
  const poses = Object.fromEntries(Object.keys(COATS).map(coat => [coat, posesOf(coat)]))
  writeFileSync(
    join(app, 'src', 'poses.js'),
    `// The cat's poses in each coat, built from the same drawings as the Claude mod.\nwindow.POSES = ${JSON.stringify(poses)}\n`,
  )
  // The app knows each cushion by its id; its names are in src/locales (colour.matcha).
  const unnamed = CUSHIONS.map(({ label, ...cushion }) => cushion)
  writeFileSync(join(app, 'src', 'cushions.json'), `${JSON.stringify(unnamed, null, 2)}\n`)

  const places = Object.keys(PLACE_ART)
  const worn = Object.fromEntries(
    places.map(place => [place, { head: PLACE_ART[place].head, beside: PLACE_ART[place].beside, effects: PLACE_ART[place].effects }]),
  )
  writeFileSync(
    join(app, 'src', 'place-art.js'),
    `// What the cat wears and has beside it in each place, and where the effects on its things play, from the same drawings as the Claude mod.\nwindow.PLACE_ART = ${JSON.stringify(worn)}\n`,
  )
  const cushions = Object.fromEntries(places.map(place => [place, PLACE_ART[place].cushion]))
  writeFileSync(join(app, 'src', 'place-cushions.json'), `${JSON.stringify(cushions, null, 2)}\n`)
  console.log(
    `src/poses.js rebuilt: ${Object.keys(poses).join(', ')}; src/cushions.json: ${CUSHIONS.length} cushions; src/place-art.js: ${places.join(', ')}`,
  )
} finally {
  rmSync(work, { recursive: true, force: true })
}
