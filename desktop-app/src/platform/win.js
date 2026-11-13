// Windows: the cat as it has always been. Windows passes the mouse's moves on
// to a window that clicks go through, and the tray opens its menu when asked.
const { plainTrayImage, popUpTrayMenu, setLoginItem } = require('./shared')

module.exports = {
  // Added to the cat window's own options.
  windowOptions: {},
  // Whether a window that clicks go through still hears the mouse move.
  forwardsPointer: true,
  // Whether the tray keeps a menu built up front, to build again when it changes.
  menuIsAttached: false,
  trayImage: plainTrayImage,

  onReady() {},

  afterCreate() {},

  setOpenAtLogin: setLoginItem,
  attachTray: popUpTrayMenu,
  workAreaOf: display => display.workArea,

  beforeOpenLook() {},
}
