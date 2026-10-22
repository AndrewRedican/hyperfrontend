/**
 * Every parameter of a documented function has a `@param` tag, the properties of a destructured
 * parameter included, named under the parameter's root or `root0`, `root1` for an unnamed one.
 * The fix inserts the missing tags where the parameters' order puts them.
 *
 * @module rules/jsdoc/require-param
 */

import type { Node } from '../../code/model.ts'
import type { Fix } from '../../engine/report.ts'
import type { JsdocBlock, JsdocTag, JsdocTokens } from '../../jsdoc/parse.ts'
import type { Parameter, RestParameter } from './shared/parameters.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../engine/rule.ts'
import { avoidsDocs, hasTag } from './shared/exemptions.ts'
import { documentedNodes } from './shared/functions.ts'
import { isObjectType, parametersOf } from './shared/parameters.ts'
import { samePath, unquotePath } from './shared/paths.ts'
import { reportBlock } from './shared/report.ts'
import { blockTokens, rewriteBlock } from './shared/rewrite.ts'

/** Constructors are checked; getters and setters are not. */
const CHECKS = { checkConstructors: true, checkGetters: false, checkSetters: false }

/** A tag the function lacks. */
interface Missing {
  /** The position of the parameter it documents among the flattened names, or of the empty tag it replaces. */
  readonly index: number
  /** The name the tag gives. */
  readonly name: string
  /** Whether it replaces a `@param` tag without a name. */
  readonly replaces: boolean
  /** The type the tag carries, empty for none. */
  readonly type: string
}

/** A `@param` tag as the checks read it. */
interface ParamTag {
  /** The name. */
  readonly name: string
  /** The type. */
  readonly type: string
}

/** A tag of the block the fix rewrites. */
interface ModelTag {
  /** The tag's name without `@`. */
  readonly tag: string
  /** The name it documents. */
  readonly name: string
  /** Whether the fix added it. */
  readonly added: boolean
  /** How many of its lines do not close the block. */
  readonly lineCount: number
}

/**
 * The names the parameters flatten to, in order: a parameter's name, a named destructured
 * parameter's root with its paths under it, an unnamed one's paths alone.
 *
 * @param parameters - The function's parameters
 * @returns The flattened parameter and path names
 */
function flattenedNames(parameters: readonly Parameter[]): string[] {
  return parameters.flatMap((parameter) => {
    if (parameter.kind === 'name') return [parameter.name]
    if (parameter.kind === 'rest') return [restName(parameter)]
    const { root } = parameter
    return root === undefined ? [...parameter.flat.names] : [root, ...parameter.flat.names.map((path) => `${root}.${path}`)]
  })
}

/**
 * How a rest parameter is named: its identifier, or its tuple's element names joined by commas.
 *
 * @param parameter - The rest parameter named
 * @returns Its identifier or joined element names
 */
function restName(parameter: RestParameter): string {
  return parameter.name ?? (parameter.elements as readonly (string | undefined)[]).join(',')
}

/**
 * The tags a function lacks, in the order the previous linter found them.
 *
 * @param parameters - The function's parameters
 * @param tags - The block's `@param` tags
 * @returns The tags lacking, in order
 */
function missingTags(parameters: readonly Parameter[], tags: readonly ParamTag[]): Missing[] {
  const flattened = flattenedNames(parameters)
  const positions = createMap<string, number>()
  flattened.forEach((name, index) => positions.set(unquotePath(name), index))
  const position = (name: string): number | undefined => positions.get(unquotePath(name))
  // how: every flattened name has a position, so a path or a parameter's own name always finds one.
  const at = (name: string): number => position(name) as number
  const shallow = tags.filter((tag) => !tag.name.includes('.'))
  const missing: Missing[] = []
  const offset = parameters[0]?.kind === 'name' && parameters[0].name === 'this' ? 1 : 0
  let rootIndex = 0
  parameters.forEach((parameter, index) => {
    if (parameter.kind !== 'destructured') {
      const name = parameter.kind === 'rest' ? restName(parameter) : parameter.name
      // why: the previous linter never matched a rest tuple's names with a tag, so its fix repeated the tag on every pass; a tag naming them as the fix writes them counts here.
      if (!tags.some((tag) => tag.name === name) && name !== 'this')
        missing.push({ index: at(name), name, replaces: false, type: parameter.kind === 'rest' ? '{...any}' : '' })
      return
    }
    const matched = shallow[index - offset]
    let root: string
    if (parameter.root !== undefined) root = parameter.root
    else if (matched !== undefined && matched.name !== '') {
      root = matched.name
      if (matched.type !== '' && !isObjectType(matched.type)) return
    } else root = `root${rootIndex}`
    rootIndex += 1
    const { names, rests, hasPropertyRest, hasRestElement } = parameter.flat
    const skipped: string[] = []
    names.forEach((path, place) => {
      if (!tags.some((tag) => tag.name === root) && !missing.some((item) => item.name === root)) {
        const empty = tags.findIndex((tag) => tag.name === '')
        if (empty !== -1) missing.push({ index: empty, name: root, replaces: true, type: '' })
        else missing.push({ index: position(root) ?? at(path), name: root, replaces: false, type: '' })
      }
      if (rests[place] === true) return
      const full = `${root}.${path}`
      const unchecked = tags.find((tag) => samePath(tag.name, full) && tag.type !== '' && !isObjectType(tag.type))
      if (unchecked !== undefined) skipped.push(unchecked.name)
      if (skipped.some((prefix) => full.startsWith(prefix)) || tags.some((tag) => samePath(tag.name, full))) return
      const type = hasRestElement && !hasPropertyRest ? '{...any}' : ''
      missing.push({ index: at(parameter.root === undefined ? path : full), name: full, replaces: false, type })
    })
  })
  return missing
}

/**
 * A one-line block's tokens made three lines: the opening, the content, the close.
 *
 * @param line - The one line's tokens
 * @returns The three lines
 */
function multiline(line: JsdocTokens): JsdocTokens[] {
  const { description, postName, postType, postTag } = line
  const blank = description === ''
  const indent = `${line.start} `
  const empty = {
    ...line,
    postDelimiter: '',
    tag: '',
    postTag: '',
    type: '',
    postType: '',
    name: '',
    postName: '',
    description: '',
    end: '',
    lineEnd: '',
  }
  return [
    { ...empty, delimiter: '/**' },
    {
      ...line,
      start: indent,
      delimiter: '*',
      postTag: blank && postName === '' && postType === '' ? '' : postTag,
      postType: blank && postName === '' ? '' : postType,
      postName: blank ? '' : postName,
      description: description.trimEnd(),
      end: '',
      lineEnd: '',
    },
    { ...empty, start: indent, delimiter: '', end: '*/', lineEnd: line.lineEnd },
  ]
}

/**
 * The fix inserting every missing tag, each where the previous linter placed it: before the tag
 * of the next parameter documented, else after the last `@param` line, else before the first
 * tag or the close.
 *
 * @param block - The block the tags go in
 * @param missing - The tags to insert, in order
 * @param flattened - The parameters' flattened names, in order
 * @returns The rewrite of the block
 */
function insertTags(block: JsdocBlock, missing: readonly Missing[], flattened: readonly string[]): Fix {
  const lines = block.lines.length === 1 ? multiline(blockTokens(block)[0] as JsdocTokens) : blockTokens(block)
  const tags: ModelTag[] = block.tags.map((tag) => ({ tag: tag.tag, name: tag.name, added: false, lineCount: lineCount(tag) }))
  const insert = (tagIndex: number, lineIndex: number, removed: number, item: Missing): void => {
    const tokens: JsdocTokens = {
      start: (lines[lineIndex] as JsdocTokens).start,
      delimiter: '*',
      postDelimiter: ' ',
      tag: '@param',
      postTag: ' ',
      type: item.type,
      postType: item.type === '' ? '' : ' ',
      name: item.name,
      postName: '',
      description: '',
      end: '',
      lineEnd: '',
    }
    tags.splice(tagIndex, removed, { tag: 'param', name: item.name, added: true, lineCount: 1 })
    lines.splice(lineIndex, removed, tokens)
  }
  for (const item of missing) {
    const offset = lines.findIndex((line) => line.tag !== '' || line.end !== '')
    if (item.replaces) {
      insert(item.index, offset + item.index, 1, item)
      continue
    }
    const later = flattened.slice(item.index + 1)
    const found = tags.findIndex((tag) => !tag.added && later.some((name) => tag.name === name || tag.name.endsWith(`.${name}`)))
    const before = found === -1 ? tags.filter((tag) => tag.tag === 'param') : tags.slice(0, found)
    const count = before.reduce((sum, tag) => sum + tag.lineCount, 0)
    const firstParam = lines.findIndex((line) => line.tag === '@param')
    insert(count, (found !== -1 || firstParam === -1 ? offset : firstParam) + count, 0, item)
  }
  return rewriteBlock(block, lines)
}

/**
 * How many lines of a tag do not close the block; a one-line block's tag counts one.
 *
 * @param tag - The tag counted
 * @returns How many lines it spans
 */
function lineCount(tag: JsdocTag): number {
  return tag.index === 0 ? 1 : tag.lines.filter((line) => line.tokens.end === '').length
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/require-param',
  language: 'code',
  fixable: true,
  create: (context) =>
    documentedNodes(context, (node, block) => {
      if (avoidsDocs(context, node, block, CHECKS) || hasTag(block, ['type'])) return
      const parameters = parametersOf(node)
      if (parameters.length === 0) return
      const tags = block.tags.filter((tag) => tag.tag === 'param').map((tag) => ({ name: tag.name, type: tag.type }))
      const missing = missingTags(parameters, tags)
      if (missing.length === 0) return
      const fix = insertTags(block, missing, flattenedNames(parameters))
      for (const item of missing) reportBlock(context, block, `Missing JSDoc @param "${item.name}" declaration.`, fix)
    }),
})
