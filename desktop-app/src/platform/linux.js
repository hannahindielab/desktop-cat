// Linux (X11). A window that clicks go through hears nothing of the mouse
// there, so the cat asks where the pointer is instead (pointer.js). The tray
// keeps a menu built up front, opening at login is a desktop entry, and GNOME
// knows each screen's work area better than Electron does.
const os = require('node:os')
const path = require('node:path')

const { desktopEntry, removeAutostart, writeAutostart } = require('./autostart-linux')
const { plainTrayImage } = require('./shared')
const { readWorkArea } = require('./workarea-linux')

const configHome = () => process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')

module.exports = {
  // A frameless window has rounded corners on Linux since Electron 43, which
  // cut into the cat. skipTaskbar does nothing on Linux, so the dock would
  // list the cat as a program of its own: window managers leave toolbar
  // windows out of taskbars and docks, yet they stay on top and move. Not a
  // dock window: those always stay on top, and 永遠在最上層 could not be
  // turned off.
  windowOptions: { roundedCorners: false, type: 'toolbar' },
  forwardsPointer: false,
  menuIsAttached: true,
  trayImage: plainTrayImage,

  onReady() {
    // Under Wayland no window can read the pointer from outside itself, nor
    // keep itself on top.
    if (process.env.XDG_SESSION_TYPE === 'wayland') {
      console.warn('Desktop Cat needs an X11 session: under Wayland it cannot follow the pointer.')
    }
  },

  afterCreate(win) {
    win.setVisibleOnAllWorkspaces(true)
  },

  setOpenAtLogin(_app, isOn) {
    if (isOn) {
      writeAutostart(configHome(), desktopEntry({ execPath: process.execPath }))
    } else {
      removeAutostart(configHome())
    }
  },

  /** The menu is attached to the tray up front (popUpContextMenu does nothing
      on Linux); the refresh builds it again when what it shows changes. */
  attachTray(tray, buildMenu) {
    const refresh = () => tray.setContextMenu(buildMenu())
    refresh()

    return refresh
  },

  /** The screen's work area as GNOME keeps it, else as Electron works it out. */
  workAreaOf(display) {
    // GNOME's is in the X server's pixels and Electron's in scaled ones: the
    // same only at 100%.
    if (display.scaleFactor !== 1) {
      return display.workArea
    }

    return readWorkArea(display.bounds) ?? display.workArea
  },

  beforeOpenLook() {},
}
