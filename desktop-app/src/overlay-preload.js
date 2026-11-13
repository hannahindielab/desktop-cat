const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('screenEffects', {
  onScene: show => ipcRenderer.on('fx:scene', (_, scene) => show(scene)),
  ready: () => ipcRenderer.send('fx:ready'),
  // The words this window shows, in the language the cats speak.
  text: () => ipcRenderer.invoke('text:get'),
  // Another language was picked in the menu: time to ask for the words again.
  onTextChanged: refresh => ipcRenderer.on('text:changed', () => refresh()),
})
