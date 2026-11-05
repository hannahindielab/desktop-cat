// Rebuilds src/poses.js and src/cushions.json from the cat drawings in the
// Claude plugin, so the desktop cat and the plugin's cat always look the same,
// in every coat and on every cushion.
//
// Run from the desktop app's folder: node tools/build-poses.mjs [plugin hooks folder]
// (the hooks folder defaults to ../plugin/hooks, beside this app).
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const hooks = resolve(process.argv[2] ?? join(app, '..', 'plugin', 'hooks'))
const ART = ['coat-art', 'fish-art']

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
  const { COATS, CUSHIONS, posesOn } = await import(pathToFileURL(join(work, 'cats.mts')).href)

  // The cushion takes its colours from the page, so one drawing serves them all.
  const [starting] = CUSHIONS
  const anyCushion = {
    colour: `var(--cushion, ${starting.colour})`,
    seam: `var(--cushion-seam, ${starting.seam})`,
  }
  const posesOf = coat => {
    const all = COATS[coat]
    const lying = posesOn(coat, anyCushion)

    return {
      resting: lying.RESTING,
      dozing: all.DOZING,
      waiting: all.WAITING,
      calling: all.CALLING,
      thinking: all.THINKING,
      working: all.WORKING,
      talking: all.TALKING,
      sad: all.SAD,
      'pet-head': all.PET_HEAD,
      'rest-head': lying.REST_HEAD,
    }
  }
  const poses = Object.fromEntries(Object.keys(COATS).map(coat => [coat, posesOf(coat)]))
  writeFileSync(
    join(app, 'src', 'poses.js'),
    `// The cat's poses in each coat, built from the same drawings as the Claude mod.\nwindow.POSES = ${JSON.stringify(poses)}\n`,
  )
  writeFileSync(join(app, 'src', 'cushions.json'), `${JSON.stringify(CUSHIONS, null, 2)}\n`)
  console.log(`src/poses.js rebuilt: ${Object.keys(poses).join(', ')}; src/cushions.json: ${CUSHIONS.length} cushions`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
