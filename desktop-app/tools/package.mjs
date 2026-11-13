// Builds the app for Linux or macOS, for the computer it runs on, into dist/.
// (Windows has its own `npm run package`.) On macOS the build is signed for
// this computer only (ad hoc), so a build of your own opens without a
// developer certificate.
// Use: npm run package:linux, or npm run package:mac
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { packager } from '@electron/packager'

const ICONS = { darwin: 'icon.icns', linux: 'icon.png' }

if (!Object.hasOwn(ICONS, process.platform)) {
  process.stderr.write('This builds for Linux and macOS; on Windows, use npm run package.\n')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const [appPath] = await packager({
  dir: root,
  name: 'DesktopCat',
  platform: process.platform,
  arch: process.arch,
  out: join(root, 'dist'),
  overwrite: true,
  icon: join(root, 'assets', ICONS[process.platform]),
  appBundleId: 'io.github.hannahindielab.desktop-cat',
  // In the menu bar only: no Dock icon, not even a flash of one as it starts.
  extendInfo: { LSUIElement: true },
  // As npm run package leaves out. node_modules stays: the pages load i18next.
  ignore: [/^\/test/, /^\/dist/, /^\/tools/],
})

if (process.platform === 'darwin') {
  const app = join(appPath, 'DesktopCat.app')
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
  process.stdout.write(`Built and signed ad hoc: ${app}\n`)
} else {
  process.stdout.write(`Built: ${appPath}\n`)
}
