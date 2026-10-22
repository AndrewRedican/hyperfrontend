/**
 * Emphasis, strong emphasis and strikethrough from delimiter runs, by the specification's
 * algorithm: each closer looks back for an opener of the same character, and what lies between
 * becomes the children of the wrapper.
 *
 * @module markdown/emphasis
 */

import type { Item } from './items.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { item } from './items.ts'

/**
 * Whether an opener and a closer of the same character may pair.
 *
 * @param opener - The run before
 * @param closer - The run after
 * @returns True when the runs match
 */
function pairs(opener: Item, closer: Item): boolean {
  if (opener.kind !== 'delimiter' || opener.char !== closer.char || !opener.canOpen) return false
  if (opener.char === '~') return opener.count === closer.count
  const odd =
    (closer.canOpen || opener.canClose) && closer.originalCount % 3 !== 0 && (opener.originalCount + closer.originalCount) % 3 === 0
  return !odd
}

/**
 * Resolves the delimiter runs of a list of pieces into emphasis wrappers, in place. Runs left
 * over become text.
 *
 * @param items - The pieces of one block or bracket, in order
 */
export function resolveEmphasis(items: Item[]): void {
  const bottoms = createMap<string, number>()
  let closerAt = 0
  while (closerAt < items.length) {
    const closer = items[closerAt]
    if (closer.kind !== 'delimiter' || !closer.canClose) {
      closerAt += 1
      continue
    }
    const key = `${closer.char}${closer.canOpen ? 1 : 0}${closer.originalCount % 3}`
    const bottom = bottoms.get(key) ?? -1
    let openerAt = closerAt - 1
    while (openerAt > bottom && !pairs(items[openerAt], closer)) openerAt -= 1
    if (openerAt <= bottom) {
      bottoms.set(key, closerAt - 1)
      if (!closer.canOpen) {
        closer.kind = 'text'
        closer.value = closer.char.repeat(closer.count)
      }
      closerAt += 1
      continue
    }
    const opener = items[openerAt]
    const used = closer.char === '~' ? closer.count : opener.count >= 2 && closer.count >= 2 ? 2 : 1
    const wrapper = item(closer.char === '~' ? 'delete' : used === 2 ? 'strong' : 'emphasis', opener.end - used, closer.start + used)
    wrapper.children = items.slice(openerAt + 1, closerAt)
    opener.count -= used
    opener.end -= used
    closer.count -= used
    closer.start += used
    items.splice(openerAt + 1, closerAt - openerAt - 1, wrapper)
    closerAt = openerAt + 2
    if (opener.count === 0) {
      items.splice(openerAt, 1)
      closerAt -= 1
    }
    if (closer.count === 0) items.splice(closerAt, 1)
  }
  textify(items)
}

/**
 * Turns the delimiter runs and bracket openers left over into text, wrappers included.
 *
 * @param items - The pieces
 */
function textify(items: readonly Item[]): void {
  for (const piece of items) {
    if (piece.kind === 'delimiter' || piece.kind === 'bracket') {
      piece.value = piece.kind === 'delimiter' ? piece.char.repeat(piece.count) : piece.image ? '![' : '['
      piece.kind = 'text'
    } else if (piece.kind === 'emphasis' || piece.kind === 'strong' || piece.kind === 'delete') textify(piece.children)
  }
}
