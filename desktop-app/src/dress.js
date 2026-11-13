// Dresses a pose for where the cat is. Each pose keeps a mark where a place's
// things go, on its head and beside it, sitting or asleep
// (tools/build-poses.mjs); in a place they are filled in with what the cat
// wears and has beside it there, and in none they stay empty.
window.dressed = (source, place) => {
  const worn = window.PLACE_ART[place]

  return source.replace(/<!--dress:(head|beside):(sitting|lying)-->/g, (_, where, pose) => worn?.[where][pose] ?? '')
}
