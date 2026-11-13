const { contextBridge, ipcRenderer } = require('electron')

// The appearance window asks how the cat looks, asks for changes, and hears
// the result: the main program decides, and tells it what came of each ask.
contextBridge.exposeInMainWorld('look', {
  get: () => ipcRenderer.invoke('look:get'),
  set: change => ipcRenderer.send('look:set', change),
  onNow: show => ipcRenderer.on('look:now', (_, now) => show(now)),
  // How tall the page is once laid out, so the window fits it.
  fit: height => ipcRenderer.send('look:fit', height),
  // The words this window shows, in the language the cats speak.
  text: () => ipcRenderer.invoke('text:get'),
})
