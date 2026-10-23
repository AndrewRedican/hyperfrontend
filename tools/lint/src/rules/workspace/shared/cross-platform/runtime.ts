/**
 * The runtime checks: a native path where Node expects a module specifier, the pathname of a
 * module URL read as a path, a spawn of a `.cmd` shim, a `node_modules/.bin` launcher or the
 * first word of a split command line without a shell, and a hardcoded temporary path.
 *
 * @module rules/workspace/shared/cross-platform/runtime
 */

import type { Node, RegexValue, TemplateValue } from '@hyperfrontend/linter'
import type { Scan } from './edits.ts'
import { posix } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { mergeEdits } from '@hyperfrontend/linter/helpers'
import { argumentText, reportTiered } from './edits.ts'
import { MAX_HOPS, nameOf, partsOf, stringOf, unwrap } from './origin.ts'
import { methodOf } from './separators.ts'

/** The messages of these checks. */
const MESSAGES = {
  nativeImport:
    "`import()` of a native path fails on Windows, where 'C:\\x' parses as a URL with scheme 'c:'. Import `pathToFileURL(path).href` from node:url instead.",
  nativeSpecifier:
    "`{{ target }}` takes a module specifier, and a native path fails on Windows, where 'C:\\x' parses as a URL with scheme 'c:'. Pass `pathToFileURL(path).href` from node:url instead.",
  urlPathname: "`.pathname` of a module URL is '/C:/x' with percent-encoding on Windows. Use `fileURLToPath()` from node:url.",
  shellShim:
    "'{{ command }}' is a .cmd shim on Windows and cannot be spawned without a shell (ENOENT or EINVAL). Pass `shell: process.platform === 'win32'` and keep its arguments free of spaces and shell metacharacters.",
  binShim:
    "'{{ command }}' under node_modules/.bin is a shell script on POSIX and a .cmd shim on Windows, which cannot be spawned without a shell (ENOENT or EINVAL), and a shell splits a path that contains a space. Spawn `process.execPath` with the package's entry script, resolved with `require.resolve()`.",
  splitCommand:
    '`{{ command }}` is the first word of a split command line, and a .cmd shim such as `npm` cannot be spawned without a shell on Windows (ENOENT or EINVAL). Run the whole line through a shell: `execFileSync(line, { shell: true })`.',
  hardcodedTmp: "'{{ path }}' does not exist on Windows. Use `tmpdir()` or `devNull` from node:os.",
} as const

/** The suggestion of a shell on Windows, and of an `os` replacement. */
const SUGGESTIONS = { shell: 'Spawn through a shell on Windows only', os: 'Use `{{ replacement }}` from node:os' } as const

/** The option a shelled spawn gets. */
const SHELL = "shell: process.platform === 'win32'"

/** The flags whose value is a module specifier. */
const SPECIFIER_FLAGS = createSet(['--import', '--loader', '--experimental-loader', '--test-reporter'])

/** The array methods that take flags and their values. */
const ARGUMENT_METHODS = createSet(['push', 'unshift'])

/** The `child_process` functions that spawn without a shell unless told. */
const SPAWNERS = createSet(['execFileSync', 'execFile', 'spawn', 'spawnSync'])

/** The functions a launcher's path is joined with. */
const JOINERS = createSet(['join', 'resolve'])

/** The names that hold a package manager chosen at runtime. */
const MANAGER_NAMES = createSet(['packageManager', 'pm'])

// how: the POSIX paths are spelled from their segments, so this module does not write them out itself.
/** The POSIX temporary directory. */
const TMP = posix.join(posix.sep, 'tmp')

/** The POSIX null device. */
const DEV_NULL = posix.join(posix.sep, 'dev', 'null')

/**
 * The text of a template element with its escapes decoded.
 *
 * @param quasi - The template element
 * @returns The text, or null when an escape is invalid
 */
function cookedOf(quasi: Node): string | null {
  return (quasi.value as TemplateValue).cooked
}

/**
 * Fills a message's placeholder.
 *
 * @param message - A message with a placeholder
 * @param name - The placeholder
 * @param value - Its value
 * @returns The message
 */
function fill(message: string, name: string, value: string): string {
  return message.replace(`{{ ${name} }}`, value)
}

/**
 * Checks a value Node reads as a module specifier.
 *
 * @param scan - The file's checks
 * @param node - The value
 * @param message - What the report says, its target filled in
 */
function checkSpecifier(scan: Scan, node: Node, message: string): void {
  reportTiered(
    scan,
    node,
    message,
    scan.tracer.originOf(node),
    () => {
      const naming = scan.namer('url', ['pathToFileURL'], node)
      if (naming === null) return null
      const replacement = `${naming.texts[0] as string}(${argumentText(scan.text, node)}).href`
      return { replacement, edits: [...naming.edits, { start: node.start, end: node.end, text: replacement }] }
    },
    false
  )
}

/**
 * Checks the values following specifier flags in a list of arguments.
 *
 * @param scan - The file's checks
 * @param items - The list, holes included
 */
function checkFlagValues(scan: Scan, items: readonly (Node | null)[]): void {
  items.forEach((item, index) => {
    const flag = stringOf(items[index - 1])
    if (item !== null && item.kind !== 'SpreadElement' && flag !== null && SPECIFIER_FLAGS.has(flag))
      checkSpecifier(scan, item, fill(MESSAGES.nativeSpecifier, 'target', flag))
  })
}

/**
 * Checks a dynamic import.
 *
 * @param scan - The file's checks
 * @param node - The import expression
 */
export function checkImport(scan: Scan, node: Node): void {
  const source = node.source as Node
  reportTiered(
    scan,
    node,
    MESSAGES.nativeImport,
    scan.tracer.originOf(source),
    () => {
      const naming = scan.namer('url', ['pathToFileURL'], node)
      if (naming === null) return null
      const replacement = `${naming.texts[0] as string}(${argumentText(scan.text, source)}).href`
      return { replacement, edits: [...naming.edits, { start: source.start, end: source.end, text: replacement }] }
    },
    false
  )
}

/**
 * Checks an array literal for native paths after specifier flags.
 *
 * @param scan - The file's checks
 * @param node - An array literal
 */
export function checkArray(scan: Scan, node: Node): void {
  checkFlagValues(scan, node.elements as readonly (Node | null)[])
}

/**
 * Checks a template interpolating a value straight after a specifier flag, as in `--import=${path}`.
 *
 * @param scan - The file's checks
 * @param node - A template literal
 */
export function checkFlagTemplate(scan: Scan, node: Node): void {
  const [head, tail] = (node.quasis as readonly Node[]).map(cookedOf)
  const expression = (node.expressions as readonly Node[])[0]
  if (expression === undefined || tail !== '' || head?.endsWith('=') !== true || !SPECIFIER_FLAGS.has(head.slice(0, -1))) return
  checkSpecifier(scan, expression, fill(MESSAGES.nativeSpecifier, 'target', head.slice(0, -1)))
}

/**
 * Checks a module URL's `.pathname`.
 *
 * @param scan - The file's checks
 * @param node - The member expression
 */
export function checkPathname(scan: Scan, node: Node): void {
  if (!scan.node || node.computed === true || (node.property as Node).name !== 'pathname') return
  const object = unwrap(node.object as Node)
  const variable = object.kind === 'Identifier' ? scan.tracer.variableOf(object) : null
  const value = variable === null ? object : scan.tracer.valueOf(variable)
  if (value === null || !isModuleUrl(unwrap(value))) return
  const naming = scan.nodeImports && node.optional !== true ? scan.namer('url', ['fileURLToPath'], node) : null
  const replacement = naming === null ? '' : `${naming.texts[0] as string}(${scan.text.slice(object.start, object.end)})`
  scan.report(
    node,
    MESSAGES.urlPathname,
    naming === null ? null : mergeEdits(scan.text, [...naming.edits, { start: node.start, end: node.end, text: replacement }])
  )
}

/**
 * Whether an expression is a `new URL()` of `import.meta.url`.
 *
 * @param node - The expression
 * @returns Whether it is
 */
function isModuleUrl(node: Node): boolean {
  const callee = node.callee as Node | undefined
  return (
    node.kind === 'NewExpression' &&
    callee?.kind === 'Identifier' &&
    callee.name === 'URL' &&
    (node.arguments as readonly Node[]).some(
      (argument) =>
        argument.kind === 'MemberExpression' &&
        (argument.object as Node).kind === 'MetaProperty' &&
        (argument.property as Node).name === 'url'
    )
  )
}

/**
 * Checks a call for specifier flags given to `push` or `unshift`, a native path given to
 * `register()` from node:module, and a spawn without a shell.
 *
 * @param scan - The file's checks
 * @param call - Any call
 */
export function checkRuntimeCall(scan: Scan, call: Node): void {
  const args = call.arguments as readonly Node[]
  if (ARGUMENT_METHODS.has(methodOf(call)?.name as string)) checkFlagValues(scan, args)
  const qualified = scan.tracer.qualify(call.callee as Node)
  const name = qualified?.members.join('.') as string
  const first = args[0]
  if (first === undefined || first.kind === 'SpreadElement' || qualified === null) return
  if (qualified.module === 'module' && name === 'register')
    checkSpecifier(scan, first, fill(MESSAGES.nativeSpecifier, 'target', 'register()'))
  if (qualified.module === 'child_process' && SPAWNERS.has(name)) checkSpawn(scan, call, first, args.slice(1))
}

/**
 * Checks a spawn: the first word of a split line, a `node_modules/.bin` launcher, or a shim.
 * The first inline object after the command is taken as the options.
 *
 * @param scan - The file's checks
 * @param call - A call of a `child_process` spawner
 * @param command - The command argument
 * @param rest - The arguments after it
 */
function checkSpawn(scan: Scan, call: Node, command: Node, rest: readonly Node[]): void {
  const options = rest.find((node) => node.kind === 'ObjectExpression')
  const properties = (options?.properties ?? []) as readonly Node[]
  if (
    properties.some(
      (property) =>
        property.computed !== true && ((property.key as Node | undefined)?.name ?? (property.key as Node | undefined)?.value) === 'shell'
    )
  )
    return
  if (isFirstWord(scan, command)) {
    scan.report(call, fill(MESSAGES.splitCommand, 'command', scan.text.slice(command.start, command.end)))
    return
  }
  const launcher = binName(scan, command, 0)
  if (launcher !== null) {
    scan.report(call, fill(MESSAGES.binShim, 'command', launcher))
    return
  }
  if (
    options === undefined
      ? rest.some((node) => node.kind !== 'ArrayExpression')
      : properties.some((property) => property.kind === 'SpreadElement')
  )
    return
  const shim = shimName(scan, command, 0)
  if (shim === null) return
  const last = properties[properties.length - 1]
  const after = rest[rest.length - 1] ?? command
  const edit =
    options === undefined
      ? { start: after.end, end: after.end, text: `, { ${SHELL} }` }
      : last === undefined
        ? { start: options.start, end: options.end, text: `{ ${SHELL} }` }
        : { start: last.end, end: last.end, text: `, ${SHELL}` }
  scan.report(call, fill(MESSAGES.shellShim, 'command', shim), null, [{ message: SUGGESTIONS.shell, fix: edit }])
}

/**
 * Whether a command is the first word of a split line: `line.split(' ')[0]`, the same through a
 * variable, or the first name destructured from such a split.
 *
 * @param scan - The file's checks
 * @param node - The command
 * @returns Whether it is
 */
function isFirstWord(scan: Scan, node: Node): boolean {
  const target = unwrap(node)
  if (target.kind === 'MemberExpression') {
    const property = target.property as Node
    if (target.computed !== true || property.kind !== 'Literal' || property.value !== 0) return false
    const object = unwrap(target.object as Node)
    const variable = object.kind === 'Identifier' ? scan.tracer.variableOf(object) : null
    return isWordSplit(variable === null ? object : scan.tracer.valueOf(variable))
  }
  const variable = target.kind === 'Identifier' ? scan.tracer.variableOf(target) : null
  const def = variable?.defs[0]
  const pattern = def?.kind === 'Variable' ? (def.node.id as Node) : null
  return (
    pattern?.kind === 'ArrayPattern' &&
    (pattern.elements as readonly (Node | null)[])[0] === def?.name &&
    isWordSplit(def.node.init ?? null)
  )
}

/**
 * Whether an expression splits a line into words, on a space or a regex.
 *
 * @param node - The expression, or null
 * @returns Whether it does
 */
function isWordSplit(node: Node | null): boolean {
  const call = node === null ? null : unwrap(node)
  if (call?.kind !== 'CallExpression' || methodOf(call)?.name !== 'split') return false
  const separator = (call.arguments as readonly Node[])[0]
  return stringOf(separator) === ' ' || (separator?.regex as RegexValue | undefined) !== undefined
}

/**
 * The launcher a command runs from a `.bin` directory: the literal segment after `.bin` that ends
 * the path, in a literal, a template, a chain, or the arguments of `join()` or `resolve()`.
 *
 * @param scan - The file's checks
 * @param node - The command
 * @param hops - The variables followed so far
 * @returns The launcher's name, or null
 */
function binName(scan: Scan, node: Node, hops: number): string | null {
  const target = unwrap(node)
  if (target.kind === 'ConditionalExpression')
    return binName(scan, target.consequent as Node, hops) ?? binName(scan, target.alternate as Node, hops)
  if (target.kind === 'Identifier') {
    const variable = scan.tracer.variableOf(target)
    const value = variable === null ? null : scan.tracer.valueOf(variable)
    return value === null || hops >= MAX_HOPS ? null : binName(scan, value, hops + 1)
  }
  const joined = target.kind === 'CallExpression' && JOINERS.has(nameOf(target.callee as Node) as string)
  // how: a piece the source does not spell out becomes a NUL, so no segment holding one is taken for a name.
  const pieces = joined
    ? (target.arguments as readonly Node[]).map((argument) => stringOf(argument) ?? '\0').join('/')
    : partsOf(target)
        .map((part) => part.text ?? '\0')
        .join('')
  const segments = pieces.split('/')
  const name = segments[segments.length - 1] as string
  return segments[segments.length - 2] === '.bin' && name !== '' && !name.includes('\0') ? name : null
}

/**
 * The shim a command names: a literal shim command, a variable holding one, either branch of a
 * conditional, or a package manager chosen at runtime.
 *
 * @param scan - The file's checks
 * @param node - The command
 * @param hops - The variables followed so far
 * @returns The command as reported, or null
 */
function shimName(scan: Scan, node: Node, hops: number): string | null {
  const target = unwrap(node)
  const value = stringOf(target)
  if (value !== null) return scan.shims.has(value) ? value : null
  if (target.kind === 'ConditionalExpression')
    return shimName(scan, target.consequent as Node, hops) ?? shimName(scan, target.alternate as Node, hops)
  const name = target.kind === 'CallExpression' ? null : nameOf(target)
  if (name !== null && MANAGER_NAMES.has(name)) return name
  const variable = target.kind === 'Identifier' ? scan.tracer.variableOf(target) : null
  const held = variable === null ? null : scan.tracer.valueOf(variable)
  return held === null || hops >= MAX_HOPS ? null : shimName(scan, held, hops + 1)
}

/**
 * Checks a string for a temporary path written out.
 *
 * @param scan - The file's checks
 * @param node - The string literal or template
 */
export function checkTemporaryPath(scan: Scan, node: Node): void {
  const text = node.kind === 'Literal' ? node.value : cookedOf((node.quasis as readonly Node[])[0] as Node)
  if (typeof text !== 'string' || isExempt(node)) return
  const exact = node.kind === 'Literal' || (node.expressions as readonly Node[]).length === 0
  const path = text === TMP || text.startsWith(`${TMP}/`) ? TMP : text === DEV_NULL && exact ? DEV_NULL : null
  if (path === null) return
  const naming = exact && text === path ? scan.namer('os', [path === TMP ? 'tmpdir' : 'devNull'], node) : null
  const replacement = naming === null ? '' : `${naming.texts[0] as string}${path === TMP ? '()' : ''}`
  const suggestions =
    naming === null
      ? []
      : [
          {
            message: fill(SUGGESTIONS.os, 'replacement', replacement),
            fix: mergeEdits(scan.text, [...naming.edits, { start: node.start, end: node.end, text: replacement }]),
          },
        ]
  scan.report(node, fill(MESSAGES.hardcodedTmp, 'path', path), null, suggestions)
}

/**
 * Whether a string is a module specifier, a type, a property key, or the argument of `require`,
 * `require.resolve` or a mock.
 *
 * @param node - The string
 * @returns Whether it is exempt
 */
function isExempt(node: Node): boolean {
  const parent = node.parent as Node
  if (parent.kind === 'TSLiteralType' || parent.kind === 'TSExternalModuleReference') return true
  if (parent.source === node || (parent.kind === 'Property' && parent.key === node)) return true
  if (parent.kind !== 'CallExpression') return false
  const callee = unwrap(parent.callee as Node)
  if (callee.kind === 'Identifier') return callee.name === 'require'
  const method = methodOf(parent)
  return (
    method?.name === 'mock' ||
    (method?.name === 'resolve' &&
      (method.member.object as Node).kind === 'Identifier' &&
      (method.member.object as Node).name === 'require')
  )
}
