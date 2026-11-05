export type Mood = 'resting' | 'waiting' | 'calling' | 'thinking' | 'working' | 'talking'
export type Coat = 'calico' | 'tuxedo' | 'siamese'
export type Cushion = 'matcha' | 'milk-tea' | 'dusty-pink' | 'dusty-blue' | 'lavender' | 'night-sky' | 'berry' | 'cement'

declare module 'claude-code' {
  interface PluginState {
    'desktop-cat': { mood: Mood; lastPraise: number; sad: boolean; coat: Coat; cushion: Cushion }
  }
}
