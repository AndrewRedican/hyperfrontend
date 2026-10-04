import type { TSESTree } from '@typescript-eslint/utils'
import type { BindingContext, ModuleReference } from './bindings'
import type { Domain, DomainKind, PathHelperModule, Tier } from './types'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { calleeName, isImportMeta, methodName, propertyName, receiverOf, unwrap } from './ast'
import { referenceOf, singleValueOf, variableOf } from './bindings'
import { piecesOf } from './segments'
import { conversionShape } from './shapes'

/**
 * How many variable hops classification follows before giving up.
 */
const MAX_DEPTH = 8

const NATIVE: Domain = { kind: 'native', pathLike: true }
const RELATIVE: Domain = { kind: 'relative', pathLike: true }
const PORTABLE: Domain = { kind: 'portable', pathLike: false }
const UNKNOWN: Domain = { kind: 'unknown', pathLike: false }
const UNKNOWN_PATH: Domain = { kind: 'unknown', pathLike: true }

/**
 * Functions, by module key, whose result is a native OS path.
 */
const NATIVE_CALLS = createMap<string, readonly string[]>([
  ['path', ['join', 'resolve', 'normalize', 'dirname', 'format', 'toNamespacedPath']],
  ['os', ['tmpdir', 'homedir']],
  ['url', ['fileURLToPath']],
  ['fs', ['realpathSync', 'mkdtempSync']],
  ['process', ['cwd']],
  ['require', ['resolve']],
])

/**
 * CommonJS globals that hold native OS paths.
 */
const NATIVE_GLOBALS: readonly string[] = ['__dirname', '__filename']

/**
 * String methods whose result keeps the receiver's separators.
 */
const STRING_PRESERVING: readonly string[] = ['slice', 'substring', 'trim', 'trimStart', 'trimEnd', 'toLowerCase']

/**
 * Final words that mark a name as holding a filesystem path.
 */
const PATH_WORDS: readonly string[] = ['path', 'dir', 'directory', 'root', 'file', 'folder', 'cwd', 'filename', 'dirname']

/**
 * Words that mark a path-like name as a URL, route, pointer, or module specifier instead.
 */
const NON_PATH_QUALIFIERS: readonly string[] = [
  'url',
  'uri',
  'href',
  'route',
  'request',
  'req',
  'pointer',
  'schema',
  'ref',
  'import',
  'export',
]

/**
 * Leading text that marks a built string as a relative module specifier, which is portable
 * by contract.
 */
const SPECIFIER_HEADS: readonly string[] = ['./', '../']

/**
 * Splits an identifier into lowercase words at camelCase, snake_case, and kebab-case boundaries.
 *
 * @param name - An identifier, property, or function name.
 * @returns The words, lowercased.
 */
export function wordsOf(name: string): string[] {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_$-]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase())
}

/**
 * Tests whether a name reads like it holds a filesystem path: its last word is a path word
 * (`projectRoot`, `out_dir`, `cwd`) and no earlier word marks it as a URL, route, or
 * specifier (`requestPath`, `exportPath`).
 *
 * @param name - An identifier, property, or function name.
 * @returns True when the name suggests a filesystem path.
 */
export function isPathLikeName(name: string): boolean {
  const words = wordsOf(name)
  if (words.length === 0 || words.slice(0, -1).some((word) => NON_PATH_QUALIFIERS.includes(word))) return false
  return PATH_WORDS.includes(words[words.length - 1])
}

/**
 * Tests whether a module key is a helper module or lies beneath it.
 *
 * @param key - The normalised module key of an import.
 * @param module - The helper module key.
 * @returns True when the import comes from the helper module.
 */
function isHelperModule(key: string, module: string): boolean {
  return key === module || key.startsWith(`${module}/`)
}

/**
 * Looks up the separator domain a function's result is known to have.
 *
 * @param reference - The module export being called.
 * @param helpers - Helper modules with known output domains.
 * @returns The result domain, or null when the function is not known.
 */
export function callResultKind(reference: ModuleReference, helpers: readonly PathHelperModule[]): Exclude<DomainKind, 'unknown'> | null {
  if (reference.module === 'path/posix') return 'portable'
  if (reference.module === 'path' && reference.name === 'relative') return 'relative'
  if (NATIVE_CALLS.get(reference.module)?.includes(reference.name)) return 'native'
  for (const helper of helpers) {
    if (!isHelperModule(reference.module, helper.module)) continue
    if (helper.native?.includes(reference.name)) return 'native'
    if (helper.portable?.includes(reference.name)) return 'portable'
  }
  return null
}

/**
 * Merges the domains of the parts a string is built from: any native part makes the whole
 * native, then any relative part makes it relative, and only all-portable parts stay portable.
 *
 * @param domains - Domains of the parts.
 * @returns The domain of the combined string.
 */
function combine(domains: readonly Domain[]): Domain {
  if (domains.some((domain) => domain.kind === 'native')) return NATIVE
  if (domains.some((domain) => domain.kind === 'relative')) return RELATIVE
  const unknowns = domains.filter((domain) => domain.kind === 'unknown')
  if (unknowns.length === 0) return PORTABLE
  return unknowns.some((domain) => domain.pathLike) ? UNKNOWN_PATH : UNKNOWN
}

/**
 * Treats a built string that starts like `./x` as a portable specifier unless a native part
 * proves otherwise.
 *
 * @param node - The template literal or `+` chain.
 * @param domain - The combined domain of its parts.
 * @returns Portable for an unknown specifier-shaped string, the combined domain otherwise.
 */
function specifierAware(node: TSESTree.Node, domain: Domain): Domain {
  if (domain.kind !== 'unknown') return domain
  const [head] = piecesOf(node)
  return head?.kind === 'text' && SPECIFIER_HEADS.some((prefix) => head.value.startsWith(prefix)) ? PORTABLE : domain
}

/**
 * Lets a path-like name speak for a value whose origin says nothing.
 *
 * @param domain - The domain established from the value's origin.
 * @param name - The name the value is reached through, or null.
 * @returns The domain, marked path-like when it is unknown and the name suggests a path.
 */
function named(domain: Domain, name: string | null): Domain {
  if (domain.kind !== 'unknown' || domain.pathLike || name === null) return domain
  return isPathLikeName(name) ? UNKNOWN_PATH : domain
}

/**
 * Maps a domain to how confidently it is treated as a native path.
 *
 * @param domain - The domain to grade.
 * @param nodeCapable - Whether name-only evidence counts in this project.
 * @returns 1 for proven native origins, 2 for path-like names in Node code, 0 otherwise.
 */
export function tierOfDomain(domain: Domain, nodeCapable: boolean): Tier {
  if (domain.kind === 'native' || domain.kind === 'relative') return 1
  return domain.kind === 'unknown' && domain.pathLike && nodeCapable ? 2 : 0
}

/**
 * Creates a memoised classifier that traces where a string value's separators come from.
 *
 * @param binding - The file being linted.
 * @param helpers - Helper modules with known output domains.
 * @returns A function from expression to separator domain.
 */
export function createClassifier(binding: BindingContext, helpers: readonly PathHelperModule[]): (node: TSESTree.Node) => Domain {
  const cache = createWeakMap<TSESTree.Node, Domain>()

  const classifyCall = (call: TSESTree.CallExpression, depth: number): Domain => {
    if (conversionShape(call, binding)) return PORTABLE
    const method = methodName(call)
    if (method !== null && STRING_PRESERVING.includes(method)) return classify(receiverOf(call), depth + 1)
    const reference = referenceOf(call.callee, binding)
    const kind = reference ? callResultKind(reference, helpers) : null
    if (kind === 'native') return NATIVE
    if (kind === 'relative') return RELATIVE
    return kind === 'portable' ? PORTABLE : named(UNKNOWN, calleeName(call))
  }

  const classifyIdentifier = (id: TSESTree.Identifier, depth: number): Domain => {
    const variable = variableOf(id, binding.sourceCode)
    if (!variable) return NATIVE_GLOBALS.includes(id.name) ? NATIVE : named(UNKNOWN, id.name)
    const value = singleValueOf(variable)
    return named(value ? classify(value, depth + 1) : UNKNOWN, id.name)
  }

  const classifyNode = (expr: TSESTree.Node, depth: number): Domain => {
    switch (expr.type) {
      case AST_NODE_TYPES.Literal:
        return typeof expr.value === 'string' ? PORTABLE : UNKNOWN
      case AST_NODE_TYPES.TemplateLiteral:
        return specifierAware(expr, combine(expr.expressions.map((part) => classify(part, depth + 1))))
      case AST_NODE_TYPES.BinaryExpression:
        return expr.operator === '+'
          ? specifierAware(expr, combine([classify(expr.left, depth + 1), classify(expr.right, depth + 1)]))
          : UNKNOWN
      case AST_NODE_TYPES.LogicalExpression:
        return expr.operator === '&&' ? UNKNOWN : combine([classify(expr.left, depth + 1), classify(expr.right, depth + 1)])
      case AST_NODE_TYPES.ConditionalExpression:
        return combine([classify(expr.consequent, depth + 1), classify(expr.alternate, depth + 1)])
      case AST_NODE_TYPES.SequenceExpression:
        return classify(expr.expressions[expr.expressions.length - 1], depth + 1)
      case AST_NODE_TYPES.CallExpression:
        return classifyCall(expr, depth)
      case AST_NODE_TYPES.Identifier:
        return classifyIdentifier(expr, depth)
      case AST_NODE_TYPES.MemberExpression:
        return isImportMeta(expr, 'dirname') || isImportMeta(expr, 'filename') ? NATIVE : named(UNKNOWN, propertyName(expr))
      default:
        return UNKNOWN
    }
  }

  const classify = (node: TSESTree.Node, depth: number): Domain => {
    if (depth > MAX_DEPTH) return UNKNOWN
    const cached = cache.get(node)
    if (cached) return cached
    const domain = classifyNode(unwrap(node), depth)
    cache.set(node, domain)
    return domain
  }

  return (node) => classify(node, 0)
}
