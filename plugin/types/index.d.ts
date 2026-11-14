export type Mood = 'resting' | 'waiting' | 'calling' | 'thinking' | 'working' | 'talking'
export type Coat = 'calico' | 'tuxedo' | 'siamese'
export type Cushion = 'matcha' | 'milk-tea' | 'dusty-pink' | 'dusty-blue' | 'lavender' | 'night-sky' | 'berry' | 'cement'
// 'none' for home, or the name of a place in hooks/place-art.ts (none in a copy
// without them). Plain text: a contract holds no import, and so names no place.
export type Place = string
// A language tag there is a table for in hooks/text.ts, such as 'zh-Hant'.
export type Language = string

declare module 'claude-code' {
  interface PluginState {
    'desktop-cat': {
      mood: Mood
      lastPraise: number
      sad: boolean
      coat: Coat
      cushion: Cushion
      place: Place
      language: Language
    }
  }
}
