import ts from 'typescript'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Collects every identifier text appearing anywhere in a chunk.
 *
 * Deliberately over-approximates (property names and nested locals included) so
 * a name picked against this set can never collide with, or capture, anything
 * the chunk mentions.
 *
 * @param sourceFile - The parsed chunk.
 * @returns Every identifier text in the file.
 *
 * @example Guarding synthesized locals against a chunk's names
 * ```typescript
 * const taken = collectIdentifierTexts(parseChunk(source))
 * ```
 */
export const collectIdentifierTexts = (sourceFile: ts.SourceFile): Set<string> => {
  const names = createSet<string>([])
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) names.add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return names
}

/**
 * Picks a local name not present in `taken`, suffixing `$1`, `$2`, … past any
 * collisions.
 *
 * @param name - The preferred local name.
 * @param taken - Names already in use.
 * @returns The first free name in the `name`, `name$1`, `name$2`, … sequence.
 *
 * @example Aliasing around an existing local
 * ```typescript
 * uniqueLocal('inject', taken) // => 'inject$1' when the chunk already says `inject`
 * ```
 */
export const uniqueLocal = (name: string, taken: Set<string>): string => {
  if (!taken.has(name)) return name
  let suffix = 1
  while (taken.has(`${name}$${suffix}`)) suffix += 1
  return `${name}$${suffix}`
}
