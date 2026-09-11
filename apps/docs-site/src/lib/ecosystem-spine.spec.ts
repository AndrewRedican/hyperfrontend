import type { SpineBox } from './ecosystem-spine'
import { describe, expect, it } from 'vitest'
import { computeSpine } from './ecosystem-spine'

/** The map is 600 wide, so the axis runs at 300. */
const AXIS = 300

/**
 * Lay a row of equal cards across the map with a 15px gap, the way the grid does.
 *
 * @param top - The row's top edge
 * @param columns - How many columns the grid has
 * @param count - How many cards the row holds, from the left
 * @returns The row's cards
 */
function row(top: number, columns: number, count = columns): SpineBox[] {
  const gap = 15
  const width = (600 - gap * (columns - 1)) / columns
  return [...new Array<undefined>(count)].map((_, index) => ({
    top,
    bottom: top + 100,
    left: index * (width + gap),
    right: index * (width + gap) + width,
  }))
}

const APEX = row(0, 1)

describe('computeSpine', () => {
  it('runs from the flagship bottom edge to the top edge of the card the axis enters', () => {
    expect(computeSpine([...APEX, ...row(150, 3)], AXIS)).toEqual({ top: 100, height: 50 })
  })

  it('ends at the last card on its path when the final row does not reach the axis', () => {
    expect(computeSpine([...APEX, ...row(150, 3), ...row(300, 3), ...row(450, 3, 1)], AXIS)).toEqual({ top: 100, height: 200 })
  })

  it('threads a pair whole when the axis runs between two columns', () => {
    expect(computeSpine([...APEX, ...row(150, 2), ...row(300, 2)], AXIS)).toEqual({ top: 100, height: 300 })
  })

  it('stops above a lone card that sits beside the gap', () => {
    expect(computeSpine([...APEX, ...row(150, 2), ...row(300, 2, 1)], AXIS)).toEqual({ top: 100, height: 150 })
  })

  it('reaches the last card when every card is on the path', () => {
    expect(computeSpine([...APEX, ...row(150, 1), ...row(300, 1), ...row(450, 1)], AXIS)).toEqual({ top: 100, height: 350 })
  })

  it('starts at a row top when the first row straddles the axis', () => {
    expect(computeSpine([...row(0, 2), ...row(150, 2)], AXIS)).toEqual({ top: 0, height: 250 })
  })

  it('draws nothing when a single card is all that is left', () => {
    expect(computeSpine(APEX, AXIS)).toBeNull()
  })

  it('draws nothing when no row is on its path', () => {
    expect(computeSpine([...row(0, 2, 1), ...row(150, 2, 1)], AXIS)).toBeNull()
  })

  it('draws nothing for an empty map', () => {
    expect(computeSpine([], AXIS)).toBeNull()
  })
})
