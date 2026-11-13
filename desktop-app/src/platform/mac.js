// macOS: a panel, so the cat takes no place in the Dock or the app switcher.
// A panel never becomes the active window and hears no forwarded mouse moves,
// so the pointer is read instead, as on Linux (pointer.js).
const fs = require('node:fs')

const { popUpTrayMenu, setLoginItem } = require('./shared')

module.exports = {
  // A panel is never the active window: without acceptFirstMouse its first
  // click would only make it active, and the cat could be neither carried nor
  // petted.
  windowOptions: { type: 'panel', roundedCorners: false, acceptFirstMouse: true },
  forwardsPointer: false,
  menuIsAttached: false,
  // The tray picture, shown in the menu bar at half its size, so it stays sharp.
  trayImage: file => require('electron').nativeImage.createFromBuffer(fs.readFileSync(file), { scaleFactor: 2 }),

  onReady(app) {
    app.dock?.hide()
  },

  afterCreate(win) {
    // Without skipTransformProcessType, this brings the Dock icon back.
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  },

  setOpenAtLogin: setLoginItem,
  attachTray: popUpTrayMenu,
  workAreaOf: display => display.workArea,

  // An app with no Dock icon can open a window behind the others.
  beforeOpenLook(app) {
    app.focus({ steal: true })
  },
}
