const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopCat', {
  onMood: show => ipcRenderer.on('cat:mood', (_, mood) => show(mood)),
  onSound: apply => ipcRenderer.on('cat:sound', (_, sound) => apply(sound)),
  onMeow: meow => ipcRenderer.on('cat:meow', () => meow()),
  onCoat: wear => ipcRenderer.on('cat:coat', (_, coat) => wear(coat)),
  onCushion: lieOn => ipcRenderer.on('cat:cushion', (_, colours) => lieOn(colours)),
  onPlace: goTo => ipcRenderer.on('cat:place', (_, place) => goTo(place)),
  onEffects: play => ipcRenderer.on('cat:effects', (_, isOn) => play(isOn)),
  onUsage: fill => ipcRenderer.on('cat:usage', (_, cans) => fill(cans)),
  onCans: dress => ipcRenderer.on('cat:cans', (_, look) => dress(look)),
  // Changing size: fade out and say so, then fade in at the window's new side.
  onFadeOut: fade => ipcRenderer.on('cat:fade-out', () => fade()),
  onFadeIn: appear => ipcRenderer.on('cat:fade-in', (_, side) => appear(side)),
  faded: () => ipcRenderer.send('cat:faded'),
  ready: () => ipcRenderer.send('cat:ready'),
  setInteractive: isOverCat => ipcRenderer.send('cat:set-interactive', isOverCat),
  dragStart: () => ipcRenderer.send('cat:drag-start'),
  dragMove: () => ipcRenderer.send('cat:drag-move'),
  dragEnd: () => ipcRenderer.send('cat:drag-end'),
  showMenu: () => ipcRenderer.send('cat:menu'),
  pet: zone => ipcRenderer.send('cat:pet', zone),
  // The words this window shows, in the language the cats speak.
  text: () => ipcRenderer.invoke('text:get'),
  // Another language was picked in the menu: time to ask for the words again.
  onTextChanged: refresh => ipcRenderer.on('text:changed', () => refresh()),
})
