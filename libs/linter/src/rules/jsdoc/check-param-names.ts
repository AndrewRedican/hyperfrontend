/**
 * The `@param` tags of a block name the function's parameters, in order: a name that differs,
 * a tag past the last parameter, a duplicate, a destructured property left out or one that
 * does not exist, and a dotted path without its root are reported.
 *
 * @module rules/jsdoc/check-param-names
 */

import type { Node } from '../../code/model'
import type { RuleContext } from '../../engine/rule'
import type { JsdocBlock, JsdocTag } from '../../jsdoc/parse'
import type { DestructuredParameter, Parameter } from './shared/parameters'
import { defineRule } from '../../engine/rule'
import { documentedNodes, FUNCTION_KINDS } from './shared/functions'
import { isObjectType, parametersOf } from './shared/parameters'
import { lacksPrefix, samePath } from './shared/paths'
import { reportLineNumber, reportTag } from './shared/report'
import { checkPathRoots } from './shared/tag-paths'

/** What the checks of one block share. */
interface Check {
  /** The rule's context. */
  readonly context: RuleContext<unknown, Node>
  /** The block. */
  readonly block: JsdocBlock
  /** Its `@param` tags, in order. */
  readonly tags: readonly JsdocTag[]
}

/**
 * Whether a tag's type asks for its destructured properties to be documented: no type, or a
 * plain object or array type.
 *
 * @param type - The tag's type
 * @returns Whether the properties are checked
 */
function checksProperties(type: string): boolean {
  return type === '' || isObjectType(type)
}

/**
 * Checks the tags documenting a destructured parameter: the inline type's name, each property
 * documented, no property documented that the parameter lacks.
 *
 * @param check - The block checked
 * @param tag - The tag naming the parameter
 * @param parameter - The destructured parameter the tag documents
 * @returns Whether a problem was reported
 */
function checkDestructured(check: Check, tag: JsdocTag, parameter: DestructuredParameter): boolean {
  const { names, rests, hasPropertyRest } = parameter.flat
  const name = tag.name.trim()
  if (parameter.annotationName !== undefined && name !== parameter.annotationName) {
    reportTag(check.context, tag, `@param "${name}" does not match parameter name "${parameter.annotationName}"`)
  }
  const root = parameter.root ?? name
  const expected = names.map((path) => `${root}.${path}`)
  const actual = check.tags.map((candidate) => candidate.name.trim())
  const skipped: string[] = []
  const commentLine = (check.block.lines[0] as JsdocBlock['lines'][number]).number
  let missing = false
  expected.forEach((path, index) => {
    if (skipped.some((prefix) => path.startsWith(prefix))) return
    const found = actual.findIndex((candidate) => samePath(candidate, path))
    if (found === -1) {
      if (rests[index] === true) return
      const before = actual.findIndex((candidate) => lacksPrefix(path, candidate))
      const offset = (tag.lines[0] as JsdocBlock['lines'][number]).number - commentLine - 1 + (before === -1 ? actual.length : before)
      missing = true
      reportLineNumber(check.context, commentLine + (offset === 0 ? 1 : offset), `Missing @param "${path}"`)
    } else if (!checksProperties((check.tags[found] as JsdocTag).type)) skipped.push(path)
  })
  if (hasPropertyRest) return missing
  const extras = check.tags.filter((candidate, index) => {
    const path = actual[index] as string
    return path.startsWith(`${name}.`) && !expected.some((other) => samePath(path, other)) && !samePath(path, tag.name)
  })
  for (const extra of extras) reportTag(check.context, extra, `@param "${extra.name.trim()}" does not exist on ${tag.name}`)
  return missing || extras.length > 0
}

/**
 * How a parameter is named in the list of expected names: a rest parameter with its dots, a
 * destructured one by the root the tag at its position names.
 *
 * @param parameter - The parameter at the position in the signature
 * @param root - The root the tag at the parameter's position names, if any
 * @returns The name shown
 */
function expectedName(parameter: Parameter, root: string | undefined): string {
  if (parameter.kind === 'name') return parameter.name
  if (parameter.kind === 'destructured') return root ?? ''
  return `...${parameter.name ?? (parameter.elements as readonly (string | undefined)[]).join(',')}`
}

/**
 * Checks the tags against the parameters in order, stopping at the first problem.
 *
 * @param check - The block checked
 * @param parameters - The function's parameters
 * @returns Whether a problem was reported
 */
function checkNames(check: Check, parameters: readonly Parameter[]): boolean {
  const { context, tags } = check
  const roots = tags.filter((tag) => !tag.name.includes('.')).map((tag) => tag.name.trim())
  let dotted = 0
  let offset = 0
  return tags.some((tag, index) => {
    const duplicate = tags.find((other, at) => other.name === tag.name && at !== index)
    if (duplicate !== undefined) {
      reportTag(context, duplicate, `Duplicate @param "${tag.name}"`)
      return true
    }
    if (tag.name.includes('.')) {
      dotted += 1
      return false
    }
    const name = tag.name.trim()
    let parameter = parameters[index - dotted + offset]
    if (parameter?.kind === 'name' && parameter.name === 'this' && name !== 'this') {
      offset += 1
      parameter = parameters[index - dotted + offset]
    }
    if (parameter === undefined) {
      reportTag(context, tag, `@param "${tag.name}" does not match an existing function parameter.`)
      return true
    }
    if (parameter.kind === 'rest' && parameter.elements !== null) {
      const element = parameter.elements[index]
      if (name === element) {
        // why: the next tag names the next element of the same rest tuple.
        offset -= 1
        return false
      }
      reportTag(context, tag, `Expected @param name to be "${element}". Got "${name}".`)
      return true
    }
    if (parameter.kind === 'destructured') {
      if (!checksProperties(tag.type)) return false
      return checkDestructured(check, tag, parameter)
    }
    if (parameter.name === name) return false
    const expected = parameters.map((item, at) => expectedName(item, roots[at])).filter((item) => item !== 'this')
    reportTag(context, tag, `Expected @param names to be "${expected.join(', ')}". Got "${roots.join(', ')}".`)
    return true
  })
}

export default defineRule<undefined, Node>({
  id: 'jsdoc/check-param-names',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(
      context,
      (node, block) => {
        const tags = block.tags.filter((tag) => tag.tag === 'param')
        if (tags.length === 0) return
        const check = { context, block, tags }
        if (!checkNames(check, parametersOf(node))) checkPathRoots(context, tags, 'param', 'parameter')
      },
      [...FUNCTION_KINDS, 'TSMethodSignature']
    ),
})
