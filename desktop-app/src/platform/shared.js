// What more than one platform does the same way.

/** The tray's picture, as it is drawn. */
const plainTrayImage = file => require('electron').nativeImage.createFromPath(file)

/** A click or a right-click on the tray opens the menu, built afresh each
    time. Nothing is kept to refresh later, so the refresh does nothing. */
function popUpTrayMenu(tray, buildMenu) {
  const openMenu = () => tray.popUpContextMenu(buildMenu())
  tray.on('click', openMenu)
  tray.on('right-click', openMenu)

  return () => {}
}

const setLoginItem = (app, isOn) => app.setLoginItemSettings({ openAtLogin: isOn })

module.exports = { plainTrayImage, popUpTrayMenu, setLoginItem }
