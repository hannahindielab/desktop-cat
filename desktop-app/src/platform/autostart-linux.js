// Opening at login on Linux: Electron's setLoginItemSettings does nothing
// there, so a desktop entry goes in ~/.config/autostart, which the desktop
// starts as you log in.
const fs = require('node:fs')
// Always Linux paths, whichever system runs the tests.
const path = require('node:path').posix

const FILE_NAME = 'desktop-cat.desktop'
// Ubuntu lets a program make no sandbox of its own, and only under X11 can
// the cat stay on top: both have to be said on its command line.
const LAUNCH_FLAGS = ['--no-sandbox', '--ozone-platform=x11']
// Long enough for the desktop to set out its tray and its screens first.
const START_DELAY_SECONDS = 5
const RESERVED = /[\s"'\\><~|&;$*?#()`]/
// Its name in each language, from the same tables as the menus.
const NAMES = {
  en: require('../locales/en.json').app.name,
  zh: require('../locales/zh-Hant.json').app.name,
}

const autostartFile = configHome => path.join(configHome, 'autostart', FILE_NAME)

/** One word of Exec, as the desktop entry specification asks: % written
    twice; in double quotes if it holds a reserved character, with ", ` and $
    escaped inside, and a backslash written as four (one level for the string,
    one for the quotes). */
function quoteExecArg(arg) {
  const doubled = arg.replaceAll('%', '%%')

  if (!RESERVED.test(doubled)) {
    return doubled
  }

  return `"${doubled.replaceAll('\\', '\\\\\\\\').replace(/["`$]/g, '\\$&')}"`
}

/** The desktop entry: for opening at login, or, with autostart false, for
    the applications menu. */
function desktopEntry({ execPath, autostart = true }) {
  const exec = [quoteExecArg(execPath), ...LAUNCH_FLAGS].join(' ')
  const extra = autostart
    ? ['X-GNOME-Autostart-enabled=true', `X-GNOME-Autostart-Delay=${START_DELAY_SECONDS}`]
    : ['Categories=Utility;']

  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${NAMES.en}`,
    `Name[zh_TW]=${NAMES.zh}`,
    `Name[zh_HK]=${NAMES.zh}`,
    `Exec=${exec}`,
    'Icon=desktop-cat',
    'Terminal=false',
    // The class Electron gives the cat's windows, from package.json's name.
    'StartupWMClass=desktop-cat',
    ...extra,
    '',
  ].join('\n')
}

function writeAutostart(configHome, text) {
  const file = autostartFile(configHome)
  const draft = `${file}.${process.pid}.tmp`

  fs.mkdirSync(path.dirname(file), { recursive: true })
  // Written beside it first, so a login never reads half a file.
  fs.writeFileSync(draft, text)
  fs.renameSync(draft, file)
}

const removeAutostart = configHome => fs.rmSync(autostartFile(configHome), { force: true })

const hasAutostart = configHome => fs.existsSync(autostartFile(configHome))

module.exports = {
  LAUNCH_FLAGS,
  autostartFile,
  desktopEntry,
  hasAutostart,
  quoteExecArg,
  removeAutostart,
  writeAutostart,
}
