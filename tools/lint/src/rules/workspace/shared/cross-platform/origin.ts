/**
 * Where a string value comes from, as far as the source shows: a native path (`\` on Windows), a
 * native relative path from `relative()`, a portable path (always `/`), or unknown. An unknown
 * value may still be reached through a name that reads like a path, which is what the second
 * confidence tier rests on. Bindings of Node modules and of configured helper modules are read
 * from the scope analysis, so a shadowed name is never mistaken for an import.
 *
 * @module rules/workspace/shared/cross-platform/origin
 */

import type { Node, TemplateValue } from '@hyperfrontend/linter'
import type { Definition, Reference, ScopeAnalysis, Variable } from '@hyperfrontend/linter/helpers'
import { dirname, join, posix, relative, sep } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { isGlobalReference, referenceOf } from '@hyperfrontend/linter/helpers'

/** Which separator convention a value follows. */
export type Domain = 'native' | 'relative' | 'portable' | 'unknown'

/** What is known of a value. */
export interface Origin {
  /** Its separator convention. */
  readonly domain: Domain
  /** Whether an unknown value is reached through a path-like name. */
  readonly named: boolean
}

/** Path helpers outside `node:path` whose output domain is trusted. */
export interface Helper {
  /** A bare specifier, or a workspace-relative source path for relative imports; deeper paths match too. */
  readonly module: string
  /** The exports returning native paths. */
  readonly native?: readonly string[]
  /** The exports returning portable paths. */
  readonly portable?: readonly string[]
}

/** A name a module exports, as `module:member.member`, or the module itself. */
export interface Qualified {
  /** The module specifier, without a `node:` prefix. */
  readonly module: string
  /** The members read off it; empty for the module itself. */
  readonly members: readonly string[]
}

/** How many variables a value is followed through. */
export const MAX_HOPS = 8

/** An origin nothing is known of. */
export const UNKNOWN: Origin = { domain: 'unknown', named: false }

/** A portable origin. */
const PORTABLE: Origin = { domain: 'portable', named: false }

/** The calls whose result is a native path, by qualified name. */
const NATIVE_CALLS = createSet([
  ...['join', 'resolve', 'normalize', 'dirname', 'format', 'toNamespacedPath'].map((name) => `path:${name}`),
  'os:tmpdir',
  'os:homedir',
  'url:fileURLToPath',
  'fs:realpathSync',
  'fs:mkdtempSync',
  'process:cwd',
  'require:resolve',
])

/** The string methods whose result keeps its receiver's separators. */
const PRESERVING = createSet(['slice', 'substring', 'trim', 'trimStart', 'trimEnd', 'toLowerCase'])

/** The `import.meta` properties holding native paths. */
const META_PATHS = createSet(['dirname', 'filename'])

/** The last words that make a name path-like. */
const PATH_WORDS = createSet(['path', 'dir', 'directory', 'root', 'file', 'folder', 'cwd', 'filename', 'dirname'])

/** The earlier words that make a path-like name something else. */
const QUALIFIERS = createSet(['url', 'uri', 'href', 'route', 'request', 'req', 'pointer', 'schema', 'ref', 'import', 'export'])

/** The words that make a name a URL. */
const URL_WORDS = createSet(['url', 'uri', 'href'])

/** The type-only wrappers an expression is read through. */
const WRAPPERS = createSet(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'TSTypeAssertion', 'ChainExpression'])

/**
 * What several values amount to when any of them may be the one used: native or relative when
 * one is, portable when all are, else unknown and named when one is.
 *
 * @param origins - What is known of each value that may be used
 * @returns The combined origin
 */
export function combine(origins: readonly Origin[]): Origin {
  for (const domain of ['native', 'relative'] as const)
    if (origins.some((origin) => origin.domain === domain)) return { domain, named: false }
  if (origins.every((origin) => origin.domain === 'portable')) return PORTABLE
  return origins.some((origin) => origin.named) ? { domain: 'unknown', named: true } : UNKNOWN
}

/**
 * Whether a character is an ASCII capital.
 *
 * @param char - One character, or undefined past the end of the name
 * @returns Whether it is `A` to `Z`
 */
function isUpper(char: string | undefined): boolean {
  return char !== undefined && char >= 'A' && char <= 'Z'
}

/**
 * Whether a character is an ASCII lowercase letter.
 *
 * @param char - One character, or undefined past the end of the name
 * @returns Whether it is `a` to `z`
 */
function isLower(char: string | undefined): boolean {
  return char !== undefined && char >= 'a' && char <= 'z'
}

/**
 * Whether a character continues a lowercase word.
 *
 * @param char - One character, or undefined past the end of the name
 * @returns Whether it is `a` to `z` or `0` to `9`
 */
function isLowerOrDigit(char: string | undefined): boolean {
  return isLower(char) || (char !== undefined && char >= '0' && char <= '9')
}

/**
 * The lowercase words of a name: camelCase, acronyms, snake_case and kebab-case split apart.
 *
 * A run of capitals is an acronym unless a lowercase letter follows it, in which case its last
 * capital starts the next word (`XMLHttp` is `xml`, `http`). Anything else separates words.
 * The name is read once, left to right, so its length alone bounds the work.
 *
 * @param name - An identifier or property name
 * @returns Its words
 * @example
 * ```ts
 * splitWords('readXMLHttp_requestPath2') // ['read', 'xml', 'http', 'request', 'path2']
 * ```
 */
export function splitWords(name: string): string[] {
  const words: string[] = []
  let index = 0
  while (index < name.length) {
    let start = index
    if (isUpper(name[index])) {
      while (isUpper(name[index])) index += 1
      if (!isLower(name[index])) {
        words.push(name.slice(start, index))
        continue
      }
      if (index - start > 1) words.push(name.slice(start, index - 1))
      start = index - 1
    } else if (!isLowerOrDigit(name[index])) {
      index += 1
      continue
    }
    while (isLowerOrDigit(name[index])) index += 1
    words.push(name.slice(start, index))
  }
  return words.map((word) => word.toLowerCase())
}

/**
 * Whether a name reads like a path: its last word is a path word and no earlier word marks it
 * as a URL, a request or a module specifier.
 *
 * @param name - An identifier or property name
 * @returns Whether it does
 */
export function readsAsPath(name: string): boolean {
  const words = splitWords(name)
  return PATH_WORDS.has(words[words.length - 1] as string) && !words.slice(0, -1).some((word) => QUALIFIERS.has(word))
}

/**
 * Whether a name names a URL.
 *
 * @param name - The name, or null
 * @returns Whether a word of it is `url`, `uri` or `href`
 */
export function isUrlName(name: string | null): boolean {
  return name !== null && splitWords(name).some((word) => URL_WORDS.has(word))
}

/**
 * An expression without the type assertions and optional chain around it.
 *
 * @param node - The expression
 * @returns The expression they wrap
 */
export function unwrap(node: Node): Node {
  let current = node
  while (WRAPPERS.has(current.kind)) current = current.expression as Node
  return current
}

/**
 * The name an expression is read through: an identifier, a written-out member, or the callee of a call.
 *
 * @param node - The expression
 * @returns The name, or null
 */
export function nameOf(node: Node): string | null {
  const target = unwrap(node)
  if (target.kind === 'Identifier') return target.name as string
  if (target.kind === 'MemberExpression') return target.computed === true ? null : ((target.property as Node).name as string)
  return target.kind === 'CallExpression' ? nameOf(target.callee as Node) : null
}

/**
 * A string a node holds outright: a string literal, or a template without interpolations.
 *
 * @param node - Any expression, or nothing
 * @returns The string, or null
 */
export function stringOf(node: Node | null | undefined): string | null {
  if (node?.kind === 'Literal') return typeof node.value === 'string' ? node.value : null
  if (node?.kind !== 'TemplateLiteral' || (node.expressions as readonly Node[]).length > 0) return null
  return ((node.quasis as readonly Node[])[0]?.value as TemplateValue).cooked
}

/** One piece of a built string. */
export interface Part {
  /** The literal text, or null for an interpolated expression. */
  readonly text: string | null
  /** The literal, the template element, or the expression. */
  readonly node: Node
}

/**
 * The pieces of a template or a `+` chain, the chain's templates and nested chains spread out.
 *
 * @param node - The template literal or binary expression
 * @param parts - Where the pieces go
 * @returns The pieces, in order
 */
export function partsOf(node: Node, parts: Part[] = []): Part[] {
  if (node.kind === 'BinaryExpression' && node.operator === '+') {
    partsOf(node.left as Node, parts)
    partsOf(node.right as Node, parts)
  } else if (node.kind === 'TemplateLiteral') {
    const quasis = node.quasis as readonly Node[]
    quasis.forEach((quasi, index) => {
      parts.push({ text: (quasi.value as TemplateValue).cooked as string, node: quasi })
      const expression = (node.expressions as readonly Node[])[index]
      if (expression !== undefined) parts.push({ text: null, node: expression })
    })
  } else if (node.kind === 'Literal' && typeof node.value === 'string') parts.push({ text: node.value, node })
  else parts.push({ text: null, node })
  return parts
}

/** What the tracer needs to know of the file. */
export interface TracerFile {
  /** The program's scope analysis. */
  readonly analysis: ScopeAnalysis
  /** The absolute path of the file. */
  readonly path: string
  /** The workspace root, or null when none was found. */
  readonly workspaceRoot: string | null
  /** The trusted helpers. */
  readonly helpers: readonly Helper[]
}

/** Answers where values come from in one file. */
export interface Tracer {
  /** The origin of an expression. */
  readonly originOf: (node: Node, hops?: number) => Origin
  /** The qualified name an expression reads, when it reads a module binding or a known global. */
  readonly qualify: (node: Node) => Qualified | null
  /** The expression a variable holds, when it is written exactly once. */
  readonly valueOf: (variable: Variable) => Node | null
  /** The variable an identifier refers to, when the program declares it. */
  readonly variableOf: (identifier: Node) => Variable | null
  /** The module export a variable is bound to by an import or a `require`. */
  readonly bindingOf: (variable: Variable) => Qualified | null
  /** The domain a configured helper returns. */
  readonly helperDomain: (qualified: Qualified) => Domain | null
}

/**
 * Whether a qualified name is the given export.
 *
 * @param qualified - The name, or null
 * @param key - `module:member.member`
 * @returns Whether it is
 */
export function isQualified(qualified: Qualified | null, key: string): boolean {
  return qualified !== null && `${qualified.module}:${qualified.members.join('.')}` === key
}

/**
 * Builds the tracer of a file, which remembers each variable's origin once followed.
 *
 * @param file - The file's analysis, location and helpers
 * @returns The queries on where the file's values come from
 */
export function createTracer(file: TracerFile): Tracer {
  const memo = createMap<Variable, Origin>()
  const variableOf = (identifier: Node): Variable | null => {
    const variable = referenceOf(file.analysis, identifier)?.resolved ?? null
    return variable !== null && variable.defs.length > 0 ? variable : null
  }

  const moduleOf = (specifier: string): string => {
    if (!specifier.startsWith('.')) return specifier.replace(/^node:/, '')
    if (file.workspaceRoot === null) return specifier
    return relative(file.workspaceRoot, join(dirname(file.path), specifier))
      .split(sep)
      .join(posix.sep)
  }

  const bindingOf = (variable: Variable): Qualified | null => {
    const [def, other] = variable.defs
    if (def === undefined || other !== undefined) return null
    if (def.kind === 'ImportBinding') {
      if (def.node.kind === 'TSImportEqualsDeclaration') return null
      const module = moduleOf(((def.parent as Node).source as Node).value as string)
      if (def.node.kind !== 'ImportSpecifier') return { module, members: [] }
      const imported = def.node.imported as Node
      return { module, members: [(imported.name ?? imported.value) as string] }
    }
    if (def.kind !== 'Variable' || def.node.kind !== 'VariableDeclarator') return null
    const init = def.node.init
    if (init?.kind !== 'CallExpression' || !isRequireCall(init)) return null
    const module = moduleOf(((init.arguments as readonly Node[])[0] as Node).value as string)
    const id = def.node.id as Node
    if (id === def.name) return { module, members: [] }
    const property = (id.properties as readonly Node[] | undefined)?.find((entry) => entry.value === def.name)
    const key = property?.key as Node | undefined
    return property === undefined || property.computed === true || key === undefined ? null : { module, members: [key.name as string] }
  }

  const isRequireCall = (call: Node): boolean => {
    const callee = call.callee as Node
    const argument = (call.arguments as readonly Node[])[0]
    return (
      callee.kind === 'Identifier' &&
      callee.name === 'require' &&
      isGlobalReference(file.analysis, callee) &&
      argument?.kind === 'Literal' &&
      typeof argument.value === 'string'
    )
  }

  const qualify = (node: Node): Qualified | null => {
    const target = unwrap(node)
    if (target.kind === 'Identifier') {
      const variable = variableOf(target)
      if (variable !== null) return bindingOf(variable)
      return target.name === 'process' || target.name === 'require' ? { module: target.name, members: [] } : null
    }
    if (target.kind !== 'MemberExpression' || target.computed === true) return null
    const object = qualify(target.object as Node)
    if (object === null) return null
    const members = [...object.members, (target.property as Node).name as string]
    // why: `path.posix.join` is the export of `path/posix`, and `path.win32.join` that of `path/win32`.
    if (object.module === 'path' && (members[0] === 'posix' || members[0] === 'win32') && members.length > 1)
      return { module: `path/${members[0]}`, members: members.slice(1) }
    return { module: object.module, members }
  }

  const valueOf = (variable: Variable): Node | null => {
    const def = variable.defs[0] as Definition
    if (variable.defs.length !== 1 || def.kind !== 'Variable' || def.node.id !== def.name) return null
    const loop = def.parent?.parent
    if (loop?.kind === 'ForOfStatement' || loop?.kind === 'ForInStatement') return null
    const assignments = variable.references.filter((use) => use.isWrite())
    return assignments.length === 1 ? (assignments[0] as Reference).writeExpr : null
  }

  const helperDomain = (qualified: Qualified): Domain | null => {
    const name = qualified.members.join('.')
    for (const helper of file.helpers) {
      if (qualified.module !== helper.module && !qualified.module.startsWith(`${helper.module}/`)) continue
      if (helper.native?.includes(name) === true) return 'native'
      if (helper.portable?.includes(name) === true) return 'portable'
    }
    return null
  }

  const nameOrigin = (name: string | null): Origin => (name !== null && readsAsPath(name) ? { domain: 'unknown', named: true } : UNKNOWN)

  const builtOrigin = (node: Node, hops: number): Origin => {
    const parts = partsOf(node)
    const origins = parts.flatMap((part) => (part.text === null ? [originOf(part.node, hops)] : []))
    const combined = combine(origins)
    if (combined.domain === 'native' || combined.domain === 'relative') return combined
    const first = parts[0]
    return first?.text?.startsWith('./') === true || first?.text?.startsWith('../') === true ? PORTABLE : combined
  }

  const callOrigin = (call: Node, hops: number): Origin => {
    const callee = unwrap(call.callee as Node)
    if (callee.kind === 'MemberExpression' && callee.computed !== true) {
      const method = (callee.property as Node).name as string
      if (PRESERVING.has(method)) return originOf(callee.object as Node, hops)
      if (method === 'join' && isCanonical(call, callee.object as Node)) return PORTABLE
    }
    const qualified = qualify(callee)
    if (qualified !== null) {
      const key = `${qualified.module}:${qualified.members.join('.')}`
      if (NATIVE_CALLS.has(key)) return { domain: 'native', named: false }
      if (key === 'path:relative') return { domain: 'relative', named: false }
      if (qualified.module === 'path/posix') return PORTABLE
      const domain = helperDomain(qualified)
      if (domain !== null) return { domain, named: false }
    }
    return nameOrigin(nameOf(callee))
  }

  const isCanonical = (call: Node, receiver: Node): boolean => {
    const split = unwrap(receiver)
    const callee = split.kind === 'CallExpression' ? unwrap(split.callee as Node) : null
    if (callee?.kind !== 'MemberExpression' || (callee.property as Node).name !== 'split') return false
    const [separator] = split.arguments as readonly Node[]
    const [joiner] = call.arguments as readonly Node[]
    return isExport(separator, 'path:sep') && isExport(joiner, 'path/posix:sep')
  }

  const isExport = (node: Node | undefined, key: string): boolean => node !== undefined && isQualified(qualify(node), key)

  const identifierOrigin = (identifier: Node, hops: number): Origin => {
    const name = identifier.name as string
    const variable = variableOf(identifier)
    if (variable === null) return name === '__dirname' || name === '__filename' ? { domain: 'native', named: false } : nameOrigin(name)
    const value = valueOf(variable)
    if (value === null) return nameOrigin(name)
    const known = memo.get(variable)
    if (known !== undefined) return known
    if (hops >= MAX_HOPS) return UNKNOWN
    const origin = originOf(value, hops + 1)
    const result = origin.domain === 'unknown' && !origin.named ? nameOrigin(name) : origin
    memo.set(variable, result)
    return result
  }

  const originOf = (node: Node, hops = 0): Origin => {
    const target = unwrap(node)
    switch (target.kind) {
      case 'Literal':
        return typeof target.value === 'string' ? PORTABLE : UNKNOWN
      case 'TemplateLiteral':
        return builtOrigin(target, hops)
      case 'BinaryExpression':
        return target.operator === '+' ? builtOrigin(target, hops) : UNKNOWN
      case 'ConditionalExpression':
        return combine([originOf(target.consequent as Node, hops), originOf(target.alternate as Node, hops)])
      case 'LogicalExpression':
        return target.operator === '&&' ? UNKNOWN : combine([originOf(target.left as Node, hops), originOf(target.right as Node, hops)])
      case 'SequenceExpression':
        return originOf((target.expressions as readonly Node[])[(target.expressions as readonly Node[]).length - 1] as Node, hops)
      case 'Identifier':
        return identifierOrigin(target, hops)
      case 'MemberExpression':
        if ((target.object as Node).kind === 'MetaProperty' && META_PATHS.has(nameOf(target) as string))
          return { domain: 'native', named: false }
        return nameOrigin(nameOf(target))
      case 'CallExpression':
        return callOrigin(target, hops)
      default:
        return UNKNOWN
    }
  }

  return { originOf, qualify, valueOf, variableOf, bindingOf, helperDomain }
}
