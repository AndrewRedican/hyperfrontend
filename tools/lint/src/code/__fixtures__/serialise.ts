/**
 * The canonical lines of a code tree, in the form the tree-shape oracle writes the staged
 * parser's trees: one line per node with its kind, range and the fields rules read.
 *
 * @module code/__fixtures__/serialise
 */

import type { Node } from '../model.ts'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { childrenOf } from '../children.ts'

const FLAGS = ['computed', 'optional', 'static', 'async', 'generator', 'shorthand', 'method', 'prefix', 'delegate', 'selfClosing', 'readonly', 'abstract', 'declare', 'override', 'definite', 'const', 'in', 'out', 'global', 'asserts', 'await', 'tail', 'expression']
const WORDS = ['name', 'operator', 'raw', 'accessibility', 'importKind', 'exportKind', 'sourceType', 'directive']

/**
 * The lines of a tree.
 *
 * @param node - The root
 * @param depth - The indentation depth
 * @param lines - Where the lines go
 * @returns The same lines
 */
export function serialise(node: Node, depth = 0, lines: string[] = []): string[] {
  const record = node as unknown as Record<string, unknown>
  const parts: string[] = []
  const kind = node.variableKind ?? node.methodKind ?? node.propertyKind ?? node.moduleKind
  if (kind !== undefined) parts.push(`kind=${kind}`)
  for (const word of WORDS) if (typeof record[word] === 'string') parts.push(`${word}=${stringify(record[word])}`)
  for (const flag of FLAGS) if (record[flag] === true || typeof record[flag] === 'string') parts.push(`${flag}=${String(record[flag])}`)
  if (node.kind === 'TemplateElement') parts.push(`raw=${stringify((node.value as { raw: string }).raw)}`)
  if (node.kind === 'JSXText') parts.push(`value=${stringify(node.value)}`)
  lines.push(`${'  '.repeat(depth)}${node.kind} ${node.start}-${node.end}${parts.length === 0 ? '' : ` ${parts.join(' ')}`}`)
  for (const child of childrenOf(node)) serialise(child, depth + 1, lines)
  return lines
}
