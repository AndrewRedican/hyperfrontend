/**
 * Types, names and namepaths are well formed and where the tag takes them: a type that does not
 * parse, a namepath with a stray character, a type or name on a tag that takes none, a tag
 * missing the type or name it needs, a malformed bracketed name, and an inline link without
 * content are reported, as the TypeScript flavour of JSDoc reads them.
 *
 * @module rules/jsdoc/valid-types
 */

import type { Node } from '../../code/model.ts'
import type { RuleContext } from '../../engine/rule.ts'
import type { JsdocBlock, JsdocLine, JsdocTag } from '../../jsdoc/parse.ts'
import { defineRule } from '../../engine/rule.ts'
import { parseType, typeNodes } from '../../jsdoc/types.ts'
import { fileBlocks } from './shared/blocks.ts'
import { isIdentifier, isNamepath } from './shared/namepaths.ts'
import { reportBlock, reportTag } from './shared/report.ts'
import { structureOf } from './shared/tag-structure.ts'

/** The inline tags that need content. */
const INLINE_TAGS = ['include', 'includeCode', 'inheritDoc', 'inheritdoc', 'label', 'link', 'linkcode', 'linkplain', 'tutorial']

/** The tags whose name is a namepath. */
const NAMEPATH_TAGS = [
  'alias',
  'arg',
  'argument',
  'emits',
  'fires',
  'lends',
  'listens',
  'memberof',
  'memberof!',
  'mixes',
  'module',
  'param',
  'prop',
  'property',
  'requires',
]

/** The tags whose name is a plain name. */
const NAME_TAGS = ['typedef']

/** The tags whose missing name other rules report. */
const NAME_REPORTED_ELSEWHERE = ['arg', 'argument', 'param', 'prop', 'property']

/** The suffix naming the mode when another mode reads a tag differently. */
const IN_MODE = ' in "typescript" mode'

/**
 * Whether a namepath is valid for a tag: as written, or with the separator a tag allows at its
 * edge, or as a module when the tag names one.
 *
 * @param namepath - The text tested as a namepath
 * @param tag - The tag's name, or null for a namepath with no allowance
 * @returns Whether it is valid
 */
function isValidNamepath(namepath: string, tag: string | null): boolean {
  if (isNamepath(namepath)) return true
  const edge = (char: string): boolean => char === '#' || char === '.' || char === '~'
  if ((tag === 'memberof' || tag === 'memberof!') && edge(namepath.slice(-1))) return isNamepath(namepath.slice(0, -1))
  if ((tag === 'module' || tag === 'requires') && !namepath.startsWith('module:')) return isNamepath(`module:${namepath}`)
  return tag === 'borrows' && edge(namepath.charAt(0)) && isNamepath(namepath.slice(1))
}

/**
 * The problem a bracketed name has, as the previous parser recorded it, or null.
 *
 * @param tag - The tag whose bracketed name is read
 * @returns The problem's wording
 */
function nameProblem(tag: JsdocTag): string | null {
  if (tag.unpaired) return 'unpaired brackets'
  if (!tag.optional) return null
  if (tag.name === '') return 'empty name'
  if (tag.default === '') return 'empty default value'
  const value = tag.default ?? ''
  const quoted = /^".*"$/.test(value) || /^'.*'$/.test(value)
  return !quoted && /=(?!>)/.test(value) ? 'invalid default value syntax' : null
}

/**
 * Reports the inline tags of a text that need content and have none.
 *
 * @param lines - The lines whose descriptions are searched
 * @param report - Reports one missing content by tag name
 */
function checkInline(lines: readonly JsdocLine[], report: (name: string) => void): void {
  for (const line of lines) {
    const { description } = line.tokens
    for (let at = description.indexOf('{@'); at !== -1; at = description.indexOf('{@', at + 2)) {
      const close = description.indexOf('}', at)
      const inner = description.slice(at + 2, close === -1 ? description.length : close).trim()
      const space = inner.search(/\s/)
      const name = space === -1 ? inner : inner.slice(0, space)
      if (INLINE_TAGS.includes(name) && space === -1) report(name)
    }
  }
}

/**
 * Checks a type: it parses, and no field or tuple member's type ends in a nullable `?`.
 *
 * @param context - The rule's context
 * @param tag - The tag holding the type
 * @param type - The type, as written in the braces
 */
function checkType(context: RuleContext<unknown, Node>, tag: JsdocTag, type: string): void {
  const { node } = parseType(type)
  if (node === null) {
    reportTag(context, tag, `Syntax error in type: ${type}`)
    return
  }
  for (const item of typeNodes(node)) {
    const right = item.left
    if ((item.kind === 'field' || item.kind === 'member') && right?.kind === 'nullable' && right.start === right.left?.start) {
      reportTag(context, tag, 'Syntax error in type: JsdocTypeNullable')
    }
  }
}

/**
 * Checks a `@borrows` tag: `that as this`, both namepaths.
 *
 * @param context - The rule's context
 * @param tag - The borrowing tag checked
 */
function checkBorrows(context: RuleContext<unknown, Node>, tag: JsdocTag): void {
  const { description } = tag
  const target = description.replace(/as\s+/, '').trim()
  if (!/as\s+/.test(description) || target === '') {
    reportTag(context, tag, `@borrows must have an "as" expression. Found "${description}"`)
    return
  }
  if (!isValidNamepath(target, 'borrows')) reportTag(context, tag, `Syntax error in namepath: ${target}`)
  else if (!isValidNamepath(tag.name, null)) reportTag(context, tag, `Syntax error in namepath: ${tag.name}`)
}

/**
 * Checks the names of a tag that has one: a namepath, a template's list, a plain name.
 *
 * @param context - The rule's context
 * @param tag - The tag whose names are checked
 */
function checkName(context: RuleContext<unknown, Node>, tag: JsdocTag): void {
  if (tag.tag === 'template') {
    for (const name of tag.name.split(',').map((part) => part.trim())) {
      if (!isNamepath(name)) reportTag(context, tag, `Syntax error in namepath: ${name}`)
    }
    return
  }
  if (NAMEPATH_TAGS.includes(tag.tag) && !isValidNamepath(tag.name, tag.tag))
    reportTag(context, tag, `Syntax error in namepath: ${tag.name}`)
  if (NAME_TAGS.includes(tag.tag) && !isIdentifier(tag.name)) reportTag(context, tag, `Syntax error in name: ${tag.name}`)
}

/**
 * Checks one tag, stopping at its first problem as the previous linter did.
 *
 * @param context - The rule's context
 * @param tag - The tag checked
 */
function checkTag(context: RuleContext<unknown, Node>, tag: JsdocTag): void {
  const problem = nameProblem(tag)
  if (problem !== null) {
    reportTag(context, tag, `Invalid name: ${problem}`)
    return
  }
  if (tag.tag === 'import') return
  if (tag.tag === 'borrows') {
    checkBorrows(context, tag)
    return
  }
  const structure = structureOf(tag.tag)
  const name = tag.tag === 'template' ? tag.name.trim() : tag.name
  if (structure.name !== 'yes' && name !== '') {
    reportTag(context, tag, `@${tag.tag} should not have a name${structure.name === 'other' ? IN_MODE : ''}.`)
    return
  }
  // why: `@returns {@link Foo}` holds an inline tag where a type would be, which reads as description.
  const type = tag.type.trim().startsWith('@') ? '' : tag.type
  if (structure.type !== 'yes' && type !== '') {
    reportTag(context, tag, `@${tag.tag} should not have a bracketed type${structure.type === 'other' ? IN_MODE : ''}.`)
    return
  }
  const seeLink = tag.tag === 'see' && tag.description.includes('{@link')
  if (structure.nameRequired !== 'no' && name === '' && !NAME_REPORTED_ELSEWHERE.includes(tag.tag) && !seeLink) {
    reportTag(context, tag, `Tag @${tag.tag} must have a name/namepath${structure.nameRequired === 'mode' ? IN_MODE : ''}.`)
    return
  }
  if (structure.typeRequired !== 'no' && type === '') {
    reportTag(context, tag, `Tag @${tag.tag} must have a type${structure.typeRequired === 'mode' ? IN_MODE : ''}.`)
    return
  }
  if (structure.either !== 'no' && type === '' && name === '') {
    reportTag(context, tag, `Tag @${tag.tag} must have either a type or namepath${structure.either === 'mode' ? IN_MODE : ''}.`)
    return
  }
  if (type !== '' && !(type === 'const' && tag.tag === 'type')) checkType(context, tag, type)
  if (name !== '') checkName(context, tag)
  const inlineSource =
    type === '' && tag.type !== ''
      ? [{ ...tag.lines[0], tokens: { ...(tag.lines[0] as JsdocLine).tokens, description: `{${tag.type}} ${tag.description}` } }]
      : tag.lines
  checkInline(inlineSource as readonly JsdocLine[], (inline) => reportTag(context, tag, `Inline tag "${inline}" missing content`))
}

/**
 * The lines of a block's description, before its first tag.
 *
 * @param block - The block whose description is read
 * @returns The lines before the first tag
 */
function descriptionLines(block: JsdocBlock): readonly JsdocLine[] {
  const first = block.tags[0]
  return first === undefined ? block.lines : block.lines.slice(0, first.index)
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/valid-types',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Program() {
      for (const { block } of fileBlocks(context)) {
        for (const tag of block.tags) checkTag(context, tag)
        checkInline(descriptionLines(block), (inline) => reportBlock(context, block, `Inline tag "${inline}" missing content`))
      }
    },
  }),
})
