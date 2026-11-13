// What the cat wears and has beside it in each place, and the cushion the
// place brings: no places in this copy yet.
type Matrix = [number, number, number, number, number, number]
type Point = [number, number]
export type PlaceArt = {
  head: { sitting: string; lying: string }
  beside: { sitting: string; lying: string }
  cushion: { colour: string; seam: string }
  effects: {
    // Where the steam rises in the thing's units, and how many make a pixel of the try-out it was tuned on.
    steam?: { sitting: Matrix; lying: Matrix; from: Point; perPixel: number }
    page?: { sitting: Matrix; lying: Matrix; front: string; back: string } & Record<
      'spineTop' | 'spineFoot' | 'outerTop' | 'outerFoot' | 'leftTop' | 'leftFoot',
      Point
    >
  }
}
export type PlaceName = string
export const PLACE_ART: Record<PlaceName, PlaceArt> = {}
