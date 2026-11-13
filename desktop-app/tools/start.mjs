// Starts Electron with what each platform needs: on Linux, no sandbox of its
// own and X11 (both work only on the command line, not from inside the app).
// Elsewhere it is plain `electron`.
// Use: node tools/start.mjs [entry point, the app itself if left out] [more arguments…]
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const electron = require('electron')
const { LAUNCH_FLAGS } = require('../src/platform/autostart-linux.js')

// With this set, Electron runs as plain Node and opens no window.
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const flags = process.platform === 'linux' ? LAUNCH_FLAGS : []
const args = process.argv.slice(2)
const child = spawn(electron, [...flags, ...(args.length > 0 ? args : ['.'])], { cwd: root, env, stdio: 'inherit' })

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', error => {
  process.stderr.write(`Could not start Electron: ${error.message}\n`)
  process.exit(1)
})
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
