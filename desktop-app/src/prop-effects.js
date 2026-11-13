// The little effects on the cat's things in a place: no places in this copy yet.
window.PropEffects = (() => {
  const canvas = document.createElement('canvas')

  return { canvas, show() {}, state: () => ({ on: false }) }
})()
