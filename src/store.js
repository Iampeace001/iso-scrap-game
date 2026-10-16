import { create } from 'zustand'

const saved = Number(localStorage.getItem('iso-scrap-high-score') || 0)

export const useGameStore = create((set, get) => ({
  gameState: 'menu', score: 0, timeRemaining: 60, highScore: saved,
  startGame: () => set({ gameState: 'playing', score: 0, timeRemaining: 60 }),
  endGame: () => set((s) => ({ gameState: 'gameover', highScore: Math.max(s.highScore, s.score) })),
  incrementScore: () => set((s) => {
    const score = s.score + 100
    const highScore = Math.max(s.highScore, score)
    localStorage.setItem('iso-scrap-high-score', String(highScore))
    return { score, highScore, timeRemaining: Math.min(60, s.timeRemaining + 5) }
  }),
  tickTimer: () => {
    if (get().gameState !== 'playing') return
    set((s) => {
      const timeRemaining = Math.max(0, s.timeRemaining - 1)
      if (timeRemaining === 0) return { timeRemaining, gameState: 'gameover', highScore: Math.max(s.highScore, s.score) }
      return { timeRemaining }
    })
  },
}))
