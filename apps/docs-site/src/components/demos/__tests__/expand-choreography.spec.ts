import { describe, expect, it } from 'vitest'
import { CARD_SESSION, stageHandover, stageScene } from '../expand-choreography'

describe('staging a demo in a scene', () => {
  it('opens a fresh session for the overlay when the demo reopens', () => {
    expect(stageScene(CARD_SESSION, 'full', true)).toEqual({ scene: 'full', generation: 1 })
  })

  it('opens another fresh session for the card the overlay collapses back into', () => {
    expect(stageScene(stageScene(CARD_SESSION, 'full', true), 'card', true)).toEqual({ scene: 'card', generation: 2 })
  })

  it('keeps the running session when the demo carries one across the scenes', () => {
    expect(stageScene(CARD_SESSION, 'full', false)).toEqual({ scene: 'full', generation: 0 })
  })

  it('takes the scene it already holds as no change at all', () => {
    expect(stageScene(CARD_SESSION, 'card', true)).toBe(CARD_SESSION)
  })

  it('starts every surface on a card session', () => {
    expect(CARD_SESSION).toEqual({ scene: 'card', generation: 0 })
  })
})

describe('handing the stage to another demo', () => {
  it('drops the overlay without opening a replacement for the stage being lost', () => {
    expect(stageHandover({ scene: 'full', generation: 3 })).toEqual({ scene: 'card', generation: 3 })
  })

  it('leaves a demo that never expanded exactly as it stands', () => {
    expect(stageHandover(CARD_SESSION)).toBe(CARD_SESSION)
  })
})
