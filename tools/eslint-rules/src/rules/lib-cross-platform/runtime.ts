import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import type { CheckContext, MessageIds } from './types'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isImportMeta, methodName, propertyName, stringValue, unwrap } from './ast'
import { knownValueOf, referenceOf } from './bindings'
import { planImports } from './imports'
import { fixWith, reportTiered } from './report'
import { expressionSource } from './segments'

/**
 * `node:child_process` functions that spawn a file without a shell by default.
 */
const SPAWNERS: readonly string[] = ['execFileSync', 'execFile', 'spawn', 'spawnSync']

/**
 * The option that lets Windows resolve `.cmd` shims while POSIX keeps spawning directly.
 */
const SHELL_OPTION = "shell: process.platform === 'win32'"

/**
 * Methods whose first argument is a module specifier, not a path.
 */
const SPECIFIER_METHODS: readonly string[] = ['mock', 'doMock', 'unmock', 'requireActual', 'requireMock', 'resolve']

/**
 * Exact paths with a portable `node:os` replacement, as `[export, call suffix]`.
 */
const OS_REPLACEMENTS = createMap<string, readonly [string, string]>([
  ['/tmp', ['tmpdir', '()']],
  ['/dev/null', ['devNull', '']],
])

/**
 * How many variable hops the command lookup follows.
 */
const MAX_HOPS = 8

/**
 * Reports a dynamic `import()` of a native path, which Windows rejects because `C:\x` parses
 * as a URL with scheme `c:`.
 *
 * @param check - The check context.
 * @param node - The import expression.
 */
export function checkNativeImport(check: CheckContext, node: TSESTree.ImportExpression): void {
  const tier = check.tierOf(node.source)
  if (tier === 0) return
  reportTiered(check, node, 'nativeImport', tier, (flavour) => {
    const plan = flavour === 'native' ? planImports(check.sourceCode, node, [['url', 'pathToFileURL']]) : null
    if (!plan) return null
    const replacement = `${plan.texts[0]}(${expressionSource(node.source, check.sourceCode)}).href`
    return { replacement, fix: fixWith(plan, (fixer) => fixer.replaceText(node.source, replacement)) }
  })
}

/**
 * Tests whether a node is `new URL(..., import.meta.url)`, directly or through a variable.
 *
 * @param node - The node to test.
 * @param check - The check context.
 * @returns True for a URL resolved against the current module.
 */
function isModuleUrl(node: TSESTree.Node, check: CheckContext): boolean {
  const expr = unwrap(node)
  const value = expr.type === AST_NODE_TYPES.Identifier ? knownValueOf(expr, check.sourceCode) : expr
  const url = value && unwrap(value)
  return (
    url?.type === AST_NODE_TYPES.NewExpression &&
    url.callee.type === AST_NODE_TYPES.Identifier &&
    url.callee.name === 'URL' &&
    url.arguments.some((arg) => isImportMeta(unwrap(arg), 'url'))
  )
}

/**
 * Reports `.pathname` read off a module URL, which yields `/C:/x` with percent-encoding on
 * Windows instead of a usable path.
 *
 * @param check - The check context.
 * @param member - A member expression.
 */
export function checkUrlPathname(check: CheckContext, member: TSESTree.MemberExpression): void {
  if (!check.nodeCapable || propertyName(member) !== 'pathname' || !isModuleUrl(member.object, check)) return
  const plan = check.nodeFile && !member.optional ? planImports(check.sourceCode, member, [['url', 'fileURLToPath']]) : null
  check.context.report({
    node: member,
    messageId: 'urlPathname',
    fix:
      plan && fixWith(plan, (fixer) => fixer.replaceText(member, `${plan.texts[0]}(${expressionSource(member.object, check.sourceCode)})`)),
  })
}

/**
 * Tests whether a name holds a package manager chosen at runtime.
 *
 * @param name - An identifier or property name.
 * @returns True for names like `packageManager` or `pm`.
 */
function isPackageManagerName(name: string): boolean {
  return name === 'pm' || name.toLowerCase().endsWith('packagemanager')
}

/**
 * Works out whether a spawned command is a Windows `.cmd` shim.
 *
 * @param arg - The command argument.
 * @param check - The check context.
 * @param hops - Variable hops followed so far.
 * @returns The command as written, or null when it is not a known shim.
 */
function shimCommandOf(arg: TSESTree.Node | undefined, check: CheckContext, hops = 0): string | null {
  if (!arg) return null
  const expr = unwrap(arg)
  const value = stringValue(expr)
  if (value !== null) return check.shimCommands.has(value) ? value : null
  if (expr.type === AST_NODE_TYPES.ConditionalExpression)
    return shimCommandOf(expr.consequent, check, hops) ?? shimCommandOf(expr.alternate, check, hops)
  let name: string | null = null
  if (expr.type === AST_NODE_TYPES.Identifier) name = expr.name
  else if (expr.type === AST_NODE_TYPES.MemberExpression) name = propertyName(expr)
  if (name !== null && isPackageManagerName(name)) return name
  const known = expr.type === AST_NODE_TYPES.Identifier && hops < MAX_HOPS ? knownValueOf(expr, check.sourceCode) : null
  return known ? shimCommandOf(known, check, hops + 1) : null
}

/**
 * Reads the static key of an object property.
 *
 * @param property - The property or spread element.
 * @returns The key, or null for spreads and computed keys.
 */
function staticKey(property: TSESTree.ObjectLiteralElement): string | null {
  if (property.type !== AST_NODE_TYPES.Property || property.computed) return null
  return property.key.type === AST_NODE_TYPES.Identifier ? property.key.name : stringValue(property.key)
}

/**
 * Builds the suggestion that adds the Windows shell option to a spawn call.
 *
 * @param call - The spawn call.
 * @param options - Its inline options object, if any.
 * @returns The fix function.
 */
function shellFix(call: TSESTree.CallExpression, options: TSESTree.ObjectExpression | undefined): TSESLint.ReportFixFunction {
  return (fixer) => {
    if (!options) return fixer.insertTextAfter(call.arguments[call.arguments.length - 1], `, { ${SHELL_OPTION} }`)
    const last = options.properties[options.properties.length - 1]
    return last ? fixer.insertTextAfter(last, `, ${SHELL_OPTION}`) : fixer.replaceText(options, `{ ${SHELL_OPTION} }`)
  }
}

/**
 * Reports spawning a `.cmd` shim like `npm` without a shell, which fails with ENOENT or EINVAL
 * on Windows. Calls whose options are not an inline literal are left alone.
 *
 * @param check - The check context.
 * @param call - A call expression.
 */
export function checkShellShim(check: CheckContext, call: TSESTree.CallExpression): void {
  const reference = referenceOf(call.callee, check.binding)
  if (reference?.module !== 'child_process' || !SPAWNERS.includes(reference.name)) return
  const command = shimCommandOf(call.arguments[0], check)
  const rest = call.arguments.slice(1)
  if (command === null || rest.some((arg) => arg.type === AST_NODE_TYPES.SpreadElement)) return
  const options = rest.find((arg): arg is TSESTree.ObjectExpression => arg.type === AST_NODE_TYPES.ObjectExpression)
  const handled = options
    ? options.properties.some((property) => property.type === AST_NODE_TYPES.SpreadElement || staticKey(property) === 'shell')
    : !rest.every((arg) => arg.type === AST_NODE_TYPES.ArrayExpression)
  if (handled) return
  check.context.report({
    node: call,
    messageId: 'shellShim',
    data: { command },
    suggest: [{ messageId: 'useShellOnWindows', fix: shellFix(call, options) }],
  })
}

/**
 * Reports splitting text on a bare line feed, which leaves `\r` on every line of a CRLF file.
 *
 * @param check - The check context.
 * @param call - A call expression.
 */
export function checkLineSplit(check: CheckContext, call: TSESTree.CallExpression): void {
  const [arg] = call.arguments
  if (!arg || methodName(call) !== 'split') return
  const value = stringValue(arg)
  if (value !== '\n' && value !== '\r\n') return
  check.context.report({ node: arg, messageId: 'lineSplit', fix: (fixer) => fixer.replaceText(arg, '/\\r?\\n/') })
}

/**
 * Tests whether a string sits where a module specifier or type, not a runtime path, belongs.
 *
 * @param node - The string node.
 * @returns True for import sources, `require`/mock arguments, literal types, and property keys.
 */
function isSpecifierPosition(node: TSESTree.Node): boolean {
  const parent = node.parent
  switch (parent?.type) {
    case AST_NODE_TYPES.ImportDeclaration:
    case AST_NODE_TYPES.ExportAllDeclaration:
    case AST_NODE_TYPES.ExportNamedDeclaration:
    case AST_NODE_TYPES.ImportExpression:
    case AST_NODE_TYPES.TSExternalModuleReference:
    case AST_NODE_TYPES.TSLiteralType:
      return true
    case AST_NODE_TYPES.Property:
      return parent.key === node
    case AST_NODE_TYPES.CallExpression: {
      const method = methodName(parent)
      const isRequire = parent.callee.type === AST_NODE_TYPES.Identifier && parent.callee.name === 'require'
      return parent.arguments[0] === node && (isRequire || (method !== null && SPECIFIER_METHODS.includes(method)))
    }
    default:
      return false
  }
}

/**
 * Builds the suggestion that swaps a hardcoded path for its `node:os` equivalent.
 *
 * @param check - The check context.
 * @param node - The string node.
 * @param osReplacement - The `node:os` export and the suffix that reads it.
 * @returns The suggestion, or none when the export cannot be referenced.
 */
function osSuggestion(
  check: CheckContext,
  node: TSESTree.Node,
  osReplacement: readonly [string, string]
): TSESLint.SuggestionReportDescriptor<MessageIds>[] {
  const [name, suffix] = osReplacement
  const plan = planImports(check.sourceCode, node, [['os', name]])
  if (!plan) return []
  const replacement = `${plan.texts[0]}${suffix}`
  return [{ messageId: 'useOsPath', data: { replacement }, fix: fixWith(plan, (fixer) => fixer.replaceText(node, replacement)) }]
}

/**
 * Reports `/tmp` and `/dev/null` written out, which do not exist on Windows.
 *
 * @param check - The check context.
 * @param node - A string literal or template literal.
 */
export function checkHardcodedTmp(check: CheckContext, node: TSESTree.Literal | TSESTree.TemplateLiteral): void {
  const head = node.type === AST_NODE_TYPES.TemplateLiteral ? node.quasis[0].value.cooked : stringValue(node)
  const exact = node.type === AST_NODE_TYPES.Literal || node.expressions.length === 0
  if (head === null || isSpecifierPosition(node)) return
  const isTmp = head === '/tmp' || head.startsWith('/tmp/')
  if (!isTmp && !(exact && head === '/dev/null')) return
  const osReplacement = exact ? OS_REPLACEMENTS.get(head) : undefined
  check.context.report({
    node,
    messageId: 'hardcodedTmp',
    data: { path: isTmp ? '/tmp' : '/dev/null' },
    suggest: osReplacement ? osSuggestion(check, node, osReplacement) : [],
  })
}
