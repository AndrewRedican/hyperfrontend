/**
 * A description says more than the name of what it documents: a block or tag description whose
 * words, filler words and the documented names aside, leave nothing is reported.
 *
 * @module rules/jsdoc/informative-docs
 */

import type { Node } from '../../code/model.ts'
import { hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { fileBlocks } from './shared/blocks.ts'
import { reportBlock, reportTag } from './shared/report.ts'

/** Words read as others: each maps to the words it stands for. */
const ALIASES: Readonly<Record<string, readonly string[]>> = { a: ['an', 'our'] }

/** Words that add no meaning. */
const USELESS = ['a', 'an', 'i', 'in', 'of', 's', 'the']

/** The class members named by their class and key. */
const MEMBERS = createSet<string>([
  'AccessorProperty',
  'MethodDefinition',
  'PropertyDefinition',
  'TSAbstractAccessorProperty',
  'TSAbstractMethodDefinition',
  'TSAbstractPropertyDefinition',
])

/** The declarations named by their `id`. */
const IDENTIFIED = createSet<string>([
  'ClassDeclaration',
  'ClassExpression',
  'FunctionDeclaration',
  'FunctionExpression',
  'TSDeclareFunction',
  'TSEnumDeclaration',
  'TSEnumMember',
  'TSInterfaceDeclaration',
  'TSMethodSignature',
  'TSModuleDeclaration',
  'TSTypeAliasDeclaration',
])

/**
 * The names a documented node goes by: its identifier, a member's class and key, a variable's
 * name and the name of the function or class it holds.
 *
 * @param node - The node, or null
 * @returns The identifiers it is known by
 */
function namesOf(node: Node | null | undefined): string[] {
  if (node === null || node === undefined) return []
  if (MEMBERS.has(node.kind)) return [...namesOf((node.parent as Node).parent), ...namesOf(node.key as Node)]
  if (IDENTIFIED.has(node.kind)) return namesOf(node.id as Node | null)
  switch (node.kind) {
    case 'ExportDefaultDeclaration':
    case 'ExportNamedDeclaration':
      return namesOf(node.declaration as Node | null)
    case 'Identifier':
      return [node.name as string]
    case 'Property':
      return namesOf(node.key as Node)
    case 'VariableDeclaration':
      return namesOf((node.declarations as readonly Node[])[0])
    case 'VariableDeclarator':
      return [...namesOf(node.id as Node), ...namesOf(node.init as Node | null)]
    default:
      return []
  }
}

/**
 * The words of a text: runs of word characters, camel case split, lower-cased, aliases expanded.
 *
 * @param text - The text split
 * @returns The lower-cased words, aliases expanded
 */
function wordsOf(text: string): string[] {
  const words: string[] = []
  let word = ''
  const flush = (): void => {
    if (word === '') return
    const lower = word.toLowerCase()
    words.push(...(hasOwn(ALIASES, lower) ? (ALIASES[lower] as readonly string[]) : [lower]))
    word = ''
  }
  for (const char of text) {
    if (!/\w/.test(char)) {
      flush()
      continue
    }
    // how: a capital after a lower-case letter starts a new word, as in `userId`.
    if (/[A-Z]/.test(char) && /[a-z]/.test(word.slice(-1))) flush()
    word += char
  }
  flush()
  return words
}

/**
 * Whether a description only repeats names: removing them and the filler words leaves no word.
 *
 * @param text - The description
 * @param names - The names it may repeat
 * @returns Whether it is uninformative
 */
function isRedundant(text: string, names: readonly string[]): boolean {
  const trimmed = text.trim()
  if (trimmed === '') return false
  const left = createSet(wordsOf(trimmed))
  for (const name of wordsOf(names.join(' '))) left.delete(name)
  for (const word of USELESS) left.delete(word)
  return left.size === 0
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/informative-docs',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      for (const { block, node } of fileBlocks(context)) {
        const names = namesOf(node)
        for (const tag of block.tags) {
          if (isRedundant(tag.description, [tag.name, ...names]))
            reportTag(context, tag, 'This tag description only repeats the name it describes.')
        }
        if (isRedundant(block.description, names)) reportBlock(context, block, 'This description only repeats the name it describes.')
      }
    },
  }),
})
