import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import type { FlavourEdit } from './report'
import type { CheckContext, Flavour, MessageIds } from './types'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { calleeName, isImportMeta, methodName, propertyName, regexOf, stringValue, unwrap } from './ast'
import { knownValueOf, referenceOf, variableOf } from './bindings'
import { planImports } from './imports'
import { fixWith, reportTiered } from './report'
import { expressionSource, piecesOf } from './segments'

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
 * The POSIX temporary directory, which does not exist on Windows.
 */
// eslint-disable-next-line workspace/cross-platform -- the rule reports this path, so it has to name it
const TMP = '/tmp'

/**
 * The POSIX null device, which Windows names `NUL`.
 */
// eslint-disable-next-line workspace/cross-platform -- the rule reports this path, so it has to name it
const DEV_NULL = '/dev/null'

/**
 * Exact paths with a portable `node:os` replacement, as `[export, call suffix]`.
 */
const OS_REPLACEMENTS = createMap<string, readonly [string, string]>([
  [TMP, ['tmpdir', '()']],
  [DEV_NULL, ['devNull', '']],
])

/**
 * How many variable hops the command lookup follows.
 */
const MAX_HOPS = 8

/**
 * `node` flags whose value is a module specifier, so an absolute Windows path parses as a URL.
 */
const SPECIFIER_FLAGS: readonly string[] = ['--import', '--loader', '--experimental-loader', '--test-reporter']

/**
 * Array methods that add the arguments they are given to an argument list.
 */
const LIST_ADDERS: readonly string[] = ['push', 'unshift']

/**
 * Reports a native path used where Node expects a module specifier, which Windows rejects
 * because `C:\x` parses as a URL with scheme `c:`.
 *
 * @param check - The check context.
 * @param node - The node to report.
 * @param source - The expression holding the specifier.
 * @param messageId - The finding's message.
 * @param data - Placeholder values for the message.
 */
function reportNativeSpecifier(
  check: CheckContext,
  node: TSESTree.Node,
  source: TSESTree.Node,
  messageId: MessageIds,
  data?: Record<string, string>
): void {
  const tier = check.tierOf(source)
  if (tier === 0) return
  const build = (flavour: Flavour): FlavourEdit | null => {
    const plan = flavour === 'native' ? planImports(check.sourceCode, node, [['url', 'pathToFileURL']]) : null
    if (!plan) return null
    const replacement = `${plan.texts[0]}(${expressionSource(source, check.sourceCode)}).href`
    return { replacement, fix: fixWith(plan, (fixer) => fixer.replaceText(source, replacement)) }
  }
  reportTiered(check, node, messageId, tier, build, data)
}

/**
 * Reports a dynamic `import()` of a native path, which Windows rejects because `C:\x` parses
 * as a URL with scheme `c:`.
 *
 * @param check - The check context.
 * @param node - The import expression.
 */
export function checkNativeImport(check: CheckContext, node: TSESTree.ImportExpression): void {
  reportNativeSpecifier(check, node, node.source, 'nativeImport')
}

/**
 * Reports a native path passed to `register()` from `node:module`, which resolves its first
 * argument as a module specifier.
 *
 * @param check - The check context.
 * @param call - A call expression.
 */
export function checkNativeRegister(check: CheckContext, call: TSESTree.CallExpression): void {
  const [specifier] = call.arguments
  if (!specifier || specifier.type === AST_NODE_TYPES.SpreadElement) return
  const reference = referenceOf(call.callee, check.binding)
  if (reference?.module !== 'module' || reference.name !== 'register') return
  reportNativeSpecifier(check, specifier, specifier, 'nativeSpecifier', { target: 'register()' })
}

/**
 * Reports a native path that follows a specifier flag such as `--import` in a list of `node`
 * arguments: an array literal, or the arguments of `push` and `unshift`.
 *
 * @param check - The check context.
 * @param node - An array literal or a call expression.
 */
export function checkSpecifierFlagList(check: CheckContext, node: TSESTree.ArrayExpression | TSESTree.CallExpression): void {
  if (node.type === AST_NODE_TYPES.CallExpression && !LIST_ADDERS.includes(methodName(node) ?? '')) return
  const items = node.type === AST_NODE_TYPES.ArrayExpression ? node.elements : node.arguments
  items.forEach((item, index) => {
    const flag = stringValue(item ?? undefined)
    const value = items[index + 1]
    if (flag === null || !SPECIFIER_FLAGS.includes(flag) || !value || value.type === AST_NODE_TYPES.SpreadElement) return
    reportNativeSpecifier(check, value, value, 'nativeSpecifier', { target: flag })
  })
}

/**
 * Reports a native path interpolated straight after a specifier flag, as in `--import=${path}`.
 *
 * @param check - The check context.
 * @param template - A template literal.
 */
export function checkSpecifierFlagTemplate(check: CheckContext, template: TSESTree.TemplateLiteral): void {
  const [head, tail] = template.quasis
  if (template.expressions.length !== 1 || tail.value.cooked !== '') return
  const flag = SPECIFIER_FLAGS.find((candidate) => head.value.cooked === `${candidate}=`)
  if (flag) reportNativeSpecifier(check, template.expressions[0], template.expressions[0], 'nativeSpecifier', { target: flag })
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
 * `node:path` functions that build a path out of the segments they are given.
 */
const PATH_BUILDERS: readonly string[] = ['join', 'resolve']

/**
 * The directory npm fills with launchers: shell scripts on POSIX, `.cmd` files on Windows.
 */
const BIN_DIRECTORY = '.bin'

/**
 * A spawned command that cannot start on Windows without a shell.
 */
interface ShimFinding {
  /** Which message describes the problem. */
  messageId: 'shellShim' | 'binShim' | 'splitCommand'
  /** The command as written. */
  command: string
}

/**
 * Reads the launcher a path into `node_modules/.bin` names, whether the path is built by
 * `join()` or `resolve()`, a template, a `+` chain, or written out.
 *
 * @param expr - The command expression.
 * @returns The launcher's name, or null when the expression is not a path into `.bin`.
 */
function binCommandOf(expr: TSESTree.Node): string | null {
  let texts: (string | null)[]
  if (expr.type !== AST_NODE_TYPES.CallExpression) texts = piecesOf(expr).map((piece) => (piece.kind === 'text' ? piece.value : null))
  else if (PATH_BUILDERS.includes(calleeName(expr) ?? '')) texts = expr.arguments.map((arg) => stringValue(arg))
  else return null
  const segments = texts.flatMap((text) => (text === null ? [null] : text.split('/').filter((segment) => segment.length > 0)))
  const [directory, command] = segments.slice(-2)
  return directory === BIN_DIRECTORY && typeof command === 'string' ? command : null
}

/**
 * Tests whether a node splits a command line into words: `line.split(' ')` or a split on a regex.
 *
 * @param node - The node to test, or null.
 * @returns True for such a split call.
 */
function isCommandLineSplit(node: TSESTree.Node | null): boolean {
  if (!node || methodName(node) !== 'split') return false
  const [separator] = (unwrap(node) as TSESTree.CallExpression).arguments
  return stringValue(separator) === ' ' || regexOf(separator) !== null
}

/**
 * Tests whether an expression is the first word of a split command line: `line.split(' ')[0]`,
 * the same through a variable, or the first name of `const [file, ...args] = line.split(' ')`.
 *
 * @param expr - The command expression.
 * @param check - The check context.
 * @returns True when the command is whatever word a command line starts with.
 */
function isSplitCommandHead(expr: TSESTree.Node, check: CheckContext): boolean {
  if (expr.type === AST_NODE_TYPES.MemberExpression) {
    if (!expr.computed || expr.property.type !== AST_NODE_TYPES.Literal || expr.property.value !== 0) return false
    const list = unwrap(expr.object)
    return isCommandLineSplit(list.type === AST_NODE_TYPES.Identifier ? knownValueOf(list, check.sourceCode) : list)
  }
  if (expr.type !== AST_NODE_TYPES.Identifier) return false
  const declarator = variableOf(expr, check.sourceCode)?.defs[0].node
  if (declarator?.type !== AST_NODE_TYPES.VariableDeclarator || declarator.id.type !== AST_NODE_TYPES.ArrayPattern) return false
  const [first] = declarator.id.elements
  return first?.type === AST_NODE_TYPES.Identifier && first.name === expr.name && isCommandLineSplit(declarator.init)
}

/**
 * Works out whether a spawned command needs a shell on Windows: a known `.cmd` shim, a
 * launcher under `node_modules/.bin`, or the first word of a split command line.
 *
 * @param arg - The command argument.
 * @param check - The check context.
 * @param hops - Variable hops followed so far.
 * @returns The finding, or null when the command is not known to need a shell.
 */
function shimFindingOf(arg: TSESTree.Node | undefined, check: CheckContext, hops = 0): ShimFinding | null {
  if (!arg) return null
  const expr = unwrap(arg)
  const value = stringValue(expr)
  if (value !== null && check.shimCommands.has(value)) return { messageId: 'shellShim', command: value }
  const binCommand = binCommandOf(expr)
  if (binCommand !== null) return { messageId: 'binShim', command: binCommand }
  if (expr.type === AST_NODE_TYPES.ConditionalExpression)
    return shimFindingOf(expr.consequent, check, hops) ?? shimFindingOf(expr.alternate, check, hops)
  let name: string | null = null
  if (expr.type === AST_NODE_TYPES.Identifier) name = expr.name
  else if (expr.type === AST_NODE_TYPES.MemberExpression) name = propertyName(expr)
  if (name !== null && isPackageManagerName(name)) return { messageId: 'shellShim', command: name }
  if (isSplitCommandHead(expr, check)) return { messageId: 'splitCommand', command: check.sourceCode.getText(expr) }
  const known = expr.type === AST_NODE_TYPES.Identifier && hops < MAX_HOPS ? knownValueOf(expr, check.sourceCode) : null
  return known ? shimFindingOf(known, check, hops + 1) : null
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
 * Reports spawning a `.cmd` shim without a shell, which fails with ENOENT or EINVAL on Windows:
 * a command like `npm`, a launcher under `node_modules/.bin`, or the first word of a split
 * command line. Calls whose options are not an inline literal are left alone.
 *
 * @param check - The check context.
 * @param call - A call expression.
 */
export function checkShellShim(check: CheckContext, call: TSESTree.CallExpression): void {
  const reference = referenceOf(call.callee, check.binding)
  if (reference?.module !== 'child_process' || !SPAWNERS.includes(reference.name)) return
  const finding = shimFindingOf(call.arguments[0], check)
  const rest = call.arguments.slice(1)
  if (finding === null || rest.some((arg) => arg.type === AST_NODE_TYPES.SpreadElement)) return
  const options = rest.find((arg): arg is TSESTree.ObjectExpression => arg.type === AST_NODE_TYPES.ObjectExpression)
  const handled = options
    ? options.properties.some((property) => property.type === AST_NODE_TYPES.SpreadElement || staticKey(property) === 'shell')
    : !rest.every((arg) => arg.type === AST_NODE_TYPES.ArrayExpression)
  if (handled) return
  check.context.report({
    node: call,
    messageId: finding.messageId,
    data: { command: finding.command },
    // why: a shell splits a path or command line that contains a space, so only a bare command name gets the shell suggestion
    suggest: finding.messageId === 'shellShim' ? [{ messageId: 'useShellOnWindows', fix: shellFix(call, options) }] : [],
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
  const isTmp = head === TMP || head.startsWith(`${TMP}/`)
  if (!isTmp && !(exact && head === DEV_NULL)) return
  const osReplacement = exact ? OS_REPLACEMENTS.get(head) : undefined
  check.context.report({
    node,
    messageId: 'hardcodedTmp',
    data: { path: isTmp ? TMP : DEV_NULL },
    suggest: osReplacement ? osSuggestion(check, node, osReplacement) : [],
  })
}
