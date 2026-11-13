const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const {
  autostartFile,
  desktopEntry,
  hasAutostart,
  quoteExecArg,
  removeAutostart,
  writeAutostart,
} = require('../src/platform/autostart-linux')

// A config folder of its own for each test, cleared away after it.
function tempConfig(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-cat-autostart-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  return dir
}

test('the entry goes in autostart under the config folder', () => {
  assert.equal(autostartFile('/home/a/.config'), '/home/a/.config/autostart/desktop-cat.desktop')
})

test('a plain path needs no quotes; spaces and reserved characters do', () => {
  assert.equal(quoteExecArg('/opt/desktop-cat/DesktopCat'), '/opt/desktop-cat/DesktopCat')
  assert.equal(quoteExecArg('/home/a/My Apps/DesktopCat'), '"/home/a/My Apps/DesktopCat"')
  assert.equal(quoteExecArg('/home/a/$x"y'), '"/home/a/\\$x\\"y"')
  assert.equal(quoteExecArg('/home/a/100%'), '/home/a/100%%')
})

test('a backslash in quotes is written four times, as the specification asks', () => {
  assert.equal(quoteExecArg('/home/a\\b/DesktopCat'), '"/home/a\\\\\\\\b/DesktopCat"')
})

test('the login entry starts the cat with the flags Linux needs, a little late', () => {
  const lines = desktopEntry({ execPath: '/home/a/.local/opt/desktop-cat/DesktopCat' }).trim().split('\n')
  assert.equal(lines[0], '[Desktop Entry]')
  assert.ok(lines.includes('Type=Application'))
  assert.ok(lines.includes('Exec=/home/a/.local/opt/desktop-cat/DesktopCat --no-sandbox --ozone-platform=x11'))
  assert.ok(lines.includes('X-GNOME-Autostart-Delay=5'))
  assert.ok(lines.includes('StartupWMClass=desktop-cat'))
  assert.ok(lines.includes('Terminal=false'))
})

test('its name comes from the language tables, in English and in Chinese', () => {
  const lines = desktopEntry({ execPath: '/x/DesktopCat' }).trim().split('\n')
  assert.ok(lines.includes(`Name=${require('../src/locales/en.json').app.name}`))
  assert.ok(lines.includes(`Name[zh_TW]=${require('../src/locales/zh-Hant.json').app.name}`))
})

test('the applications menu entry has a category and nothing for login', () => {
  const lines = desktopEntry({ execPath: '/x/DesktopCat', autostart: false }).trim().split('\n')
  assert.ok(lines.includes('Exec=/x/DesktopCat --no-sandbox --ozone-platform=x11'))
  assert.ok(lines.includes('Categories=Utility;'))
  assert.equal(
    lines.some(line => line.startsWith('X-GNOME-Autostart')),
    false,
  )
})

test('written, it is there and right; removed, it is gone', t => {
  const config = tempConfig(t)
  assert.equal(hasAutostart(config), false)
  writeAutostart(config, desktopEntry({ execPath: '/x/DesktopCat' }))
  assert.equal(hasAutostart(config), true)
  assert.match(fs.readFileSync(autostartFile(config), 'utf8'), /^Exec=\/x\/DesktopCat --no-sandbox/m)
  assert.deepEqual(fs.readdirSync(path.join(config, 'autostart')), ['desktop-cat.desktop'], 'no draft left behind')
  removeAutostart(config)
  assert.equal(hasAutostart(config), false)
})

test('removing an entry that is not there is fine', t => {
  assert.doesNotThrow(() => removeAutostart(tempConfig(t)))
})
