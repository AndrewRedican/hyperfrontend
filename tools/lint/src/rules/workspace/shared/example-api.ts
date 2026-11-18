/**
 * What a code example states about the workspace's API, held against what exists. An example
 * names an entry point of a package and takes names from it, by an import, a re-export, a
 * `require`, a namespace or a bundle's global; each of those is checked against the entry point's
 * exports. Where a caller asks for it, a function the example calls at its top level must also be
 * provided by something. An example that does not parse still has its import statements read.
 *
 * @module rules/workspace/shared/example-api
 */

import type { Node } from '@hyperfrontend/linter'
import type { DocsEntry, DocsIndex, DocsPackage } from './docs-catalog.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createWeakMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-map'
import { BROWSER_AND_NODE_GLOBALS } from '@hyperfrontend/linter'
import { childrenOf, parseCode } from '@hyperfrontend/linter/helpers'
import { declarationsOf } from './docs-catalog.ts'

/** An example as a rule hands it over. */
export interface Example {
  /** The example's text, its lines joined by line feeds. */
  readonly text: string
  /** The extension it is parsed as, with its dot. */
  readonly extension: string
  /** Where each of its lines begins in the file, as an offset. */
  readonly lineStarts: readonly number[]
  /** The package whose documentation holds it, when its top-level calls are to be checked; null to leave calls alone. */
  readonly own: DocsPackage | null
}

/** How a problem is reported: the file offsets it spans, and what is wrong. */
export type ReportExample = (start: number, end: number, message: string) => void

/** An entry point of a workspace package, as an example names it. */
interface Source {
  /** The specifier or the global as written. */
  readonly specifier: string
  /** The package. */
  readonly pkg: DocsPackage
  /** The entry point. */
  readonly entry: DocsEntry
}

/** The extension each fence language is parsed as. */
export const EXTENSIONS: Readonly<Record<string, string>> = {
  ts: '.ts',
  typescript: '.ts',
  mts: '.ts',
  cts: '.ts',
  tsx: '.tsx',
  js: '.js',
  javascript: '.js',
  mjs: '.js',
  cjs: '.js',
  jsx: '.jsx',
}

/** The Node modules whose exports an example calls without importing them, as an example about files or processes does. */
const NODE_MODULES = ['assert', 'child_process', 'crypto', 'events', 'fs', 'http', 'https', 'module', 'os', 'path', 'stream', 'url', 'util']

/** The functions and constructors an example may call without declaring: the language's, the platform's, Node's and a test runner's. */
const PROVIDED = createSet([
  ...`AggregateError Array ArrayBuffer BigInt BigInt64Array BigUint64Array Boolean DataView Date Error EvalError FinalizationRegistry
  Float32Array Float64Array Function Int16Array Int32Array Int8Array Map Number Object Promise Proxy RangeError ReferenceError
  RegExp Set SharedArrayBuffer String Symbol SyntaxError TypeError URIError Uint16Array Uint32Array Uint8Array Uint8ClampedArray
  WeakMap WeakRef WeakSet decodeURI decodeURIComponent encodeURI encodeURIComponent eval isFinite isNaN parseFloat parseInt
  afterAll afterEach beforeAll beforeEach describe expect it test`.split(/\s+/),
  ...keys(BROWSER_AND_NODE_GLOBALS),
  ...NODE_MODULES.flatMap((name) => keys(process.getBuiltinModule(`node:${name}`))),
])

/** The node kinds whose body runs when the reader's code calls it, not when the example does. */
const FUNCTIONS = createSet(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/** The marks an example sets on code it shows as right and as wrong. */
const RIGHT = '✅'
const WRONG = '❌'

/** What every finding advises. */
const ADVICE = 'Update the example to the API as it is now.'

/** A statement that takes names from a module, which reads the same whether or not the code around it parses. */
const MODULE_STATEMENT = /^[ \t]*(?:import|export)\s[^'";]*?\sfrom\s*(['"])[^'"\n]*\1/gm

/** The globals each catalogue's bundles assign, by name. */
const globalsByIndex = createWeakMap<DocsIndex, Map<string, Source>>()

/**
 * Lists the bundle globals of a catalogue's packages, each with the entry point it exposes.
 *
 * @param index - The catalogue
 * @returns The entry points by global name, the same map on every call for the catalogue
 */
function globalsOf(index: DocsIndex): Map<string, Source> {
  let globals = globalsByIndex.get(index)
  if (globals === undefined) {
    globals = createMap<string, Source>()
    for (const pkg of index.packages.values()) {
      for (const [specifier, subpath] of pkg.globals)
        globals.set(specifier, { specifier, pkg, entry: pkg.entries.get(subpath) as DocsEntry })
    }
    globalsByIndex.set(index, globals)
  }
  return globals
}

/**
 * Visits a node and everything below it.
 *
 * @param node - Where to start
 * @param nested - Whether the node sits inside a function
 * @param visit - What is done with each node
 */
function walk(node: Node, nested: boolean, visit: (node: Node, nested: boolean) => void): void {
  visit(node, nested)
  const inside = nested || FUNCTIONS.has(node.kind)
  for (const child of childrenOf(node)) walk(child, inside, visit)
}

/**
 * Collects the names a binding pattern declares.
 *
 * @param pattern - An identifier, a destructuring pattern, a default, a rest or a parameter property
 * @param names - Where the names go
 */
function bind(pattern: Node | null | undefined, names: Set<string>): void {
  if (pattern === null || pattern === undefined) return
  if (pattern.kind === 'Identifier') names.add(pattern.name as string)
  else if (pattern.kind === 'ObjectPattern') {
    for (const property of pattern.properties as readonly Node[])
      bind(property.kind === 'Property' ? (property.value as Node) : property, names)
  } else if (pattern.kind === 'ArrayPattern') for (const element of pattern.elements as readonly (Node | null)[]) bind(element, names)
  else if (pattern.kind === 'AssignmentPattern') bind(pattern.left as Node, names)
  else if (pattern.kind === 'RestElement') bind(pattern.argument as Node, names)
  else if (pattern.kind === 'TSParameterProperty') bind(pattern.parameter as Node, names)
}

/**
 * Collects every name an example declares, whatever scope declares it: an example is read as one
 * piece, so a name it gives a meaning anywhere is a name it provides.
 *
 * @param program - The example's tree
 * @returns Every name some declaration in the example binds
 */
function declaredNames(program: Node): Set<string> {
  const names = createSet<string>()
  walk(program, false, (node) => {
    bind((node.id ?? node.local ?? node.param) as Node | null | undefined, names)
    for (const parameter of (node.params ?? []) as readonly Node[]) bind(parameter, names)
  })
  return names
}

/**
 * Reads the string a node spells.
 *
 * @param node - Any node
 * @returns The value of a string literal, or null
 */
function stringOf(node: Node | null | undefined): string | null {
  return node?.kind === 'Literal' && typeof node.value === 'string' ? node.value : null
}

/**
 * Reads the name an identifier or a string literal spells, as an import or export specifier and
 * an object key write it.
 *
 * @param node - The identifier or literal
 * @returns The name, or null for anything else
 */
function nameOf(node: Node): string | null {
  return node.kind === 'Identifier' ? (node.name as string) : stringOf(node)
}

/**
 * Finds the module a declarator's initialiser loads: the argument of a `require` call or of a
 * dynamic import, awaited or not.
 *
 * @param init - The initialiser
 * @returns The node naming the module, or null
 */
function loadedModule(init: Node | null | undefined): Node | null {
  const value = init?.kind === 'AwaitExpression' ? (init.argument as Node) : init
  if (value?.kind === 'ImportExpression') return value.source as Node
  const callee = value?.kind === 'CallExpression' ? (value.callee as Node) : null
  return callee?.kind === 'Identifier' && callee.name === 'require' ? (((value as Node).arguments as readonly Node[])[0] ?? null) : null
}

/**
 * Tells whether a line of an example sits under a mark of wrong code: the nearest mark at or
 * above it is the one that speaks for it.
 *
 * @param lines - The example's lines
 * @param row - The 0-based line
 * @returns True when the example shows the line as what not to write
 */
function shownAsWrong(lines: readonly string[], row: number): boolean {
  for (let index = row; index >= 0; index -= 1) {
    const line = lines[index] as string
    if (line.includes(WRONG)) return true
    if (line.includes(RIGHT)) return false
  }
  return false
}

/** Where an offset of an example sits. */
interface Place {
  /** The 0-based line of the example. */
  readonly row: number
  /** The offset in the file. */
  readonly at: number
}

/**
 * Finds where an offset of an example sits: its line, and its place in the file.
 *
 * @param example - The example the offset counts into
 * @param offset - An offset into its text
 * @returns The line and the file offset
 */
function locate(example: Example, offset: number): Place {
  const before = example.text.slice(0, offset).split(/\r?\n/)
  const row = before.length - 1
  return { row, at: (example.lineStarts[row] as number) + (before[row] as string).length }
}

/**
 * Cuts a part out of an example as an example of its own, whose problems land where the part
 * sits in the file.
 *
 * @param example - The example the part is cut from
 * @param from - Where the part starts in its text
 * @param to - Where it ends
 * @param extension - The extension the part is parsed as
 * @returns The part, with its calls left alone
 *
 * @example The script of an HTML block, read as JavaScript
 * ```ts
 * const html = { text: '<script>\n  load()\n</script>', extension: '.html', lineStarts: [100, 109, 118], own: null }
 * partOf(html, 8, 18, '.js')
 * // => { text: '\n  load()\n', extension: '.js', lineStarts: [108, 109, 118], own: null }
 * ```
 */
export function partOf(example: Example, from: number, to: number, extension: string): Example {
  const text = example.text.slice(from, to)
  const { row, at } = locate(example, from)
  const lineStarts = [at, ...example.lineStarts.slice(row + 1, row + text.split(/\r?\n/).length)]
  return { text, extension, lineStarts, own: null }
}

/**
 * Checks what an example states about the workspace's API, reporting each name and entry point
 * that does not exist.
 *
 * @param index - The catalogue of what the packages export
 * @param example - What a rule read out of a document or a comment
 * @param report - What is done with each problem
 *
 * @example A name the package root does not export
 * ```ts
 * const text = "import { removed } from '@hyperfrontend/nexus'"
 * checkExample(index, { text, extension: '.ts', lineStarts: [40], own: null }, (start, end, message) => {
 *   // start 49, end 56: "Example takes `removed` from `@hyperfrontend/nexus`, which exports no `removed`. ..."
 * })
 * ```
 */
export function checkExample(index: DocsIndex, example: Example, report: ReportExample): void {
  check(index, example, report, true)
}

/**
 * Checks an example, or one statement cut out of an example that did not parse.
 *
 * @param index - The catalogue of what the packages export
 * @param example - The example, or the statement as an example of its own
 * @param report - What is done with each problem
 * @param whole - Whether the example is whole, so that its statements are read on their own when it does not parse
 */
function check(index: DocsIndex, example: Example, report: ReportExample, whole: boolean): void {
  const { text, own } = example
  const program = parseCode(text, example.extension).tree
  if (program === null) {
    // why: an example with an elision in it is a sketch and does not parse, but the statements naming where its API comes from are whole, and they are the part that drifts.
    for (const statement of whole ? text.matchAll(MODULE_STATEMENT) : []) {
      check(index, partOf(example, statement.index, statement.index + statement[0].length, example.extension), report, false)
    }
    return
  }
  const lines = text.split(/\r?\n/)
  const declared = declaredNames(program)
  const sources = createMap<Node, Source | null>()
  const namespaces = createMap<string, Source>()
  for (const [name, source] of globalsOf(index)) if (!declared.has(name)) namespaces.set(name, source)

  /**
   * Reports a problem on a node of the example, at its place in the file.
   *
   * @param node - The node of the example
   * @param message - What is wrong
   */
  const problem = (node: Node, message: string): void => {
    const { at } = locate(example, node.start)
    report(at, at + node.end - node.start, message)
  }

  /**
   * Resolves the entry point a specifier names, reporting one a workspace package does not have.
   *
   * @param node - The node naming the module
   * @returns The entry point, or null for a module outside the workspace or a missing entry point
   */
  const sourceOf = (node: Node | null): Source | null => {
    const specifier = stringOf(node)
    if (node === null || specifier === null) return null
    const known = sources.get(node)
    if (known !== undefined) return known
    const parts = specifier.split('/')
    const count = specifier.startsWith('@') ? 2 : 1
    const pkg = index.packages.get(parts.slice(0, count).join('/'))
    const subpath = parts.slice(count).join('/')
    const entry = pkg?.entries.get(subpath)
    const source = pkg === undefined || entry === undefined ? null : { specifier, pkg, entry }
    // why: the manifest is importable by its own subpath and is no entry point with exports to check.
    if (pkg !== undefined && entry === undefined && subpath !== 'package.json') {
      problem(node, `Example imports from \`${specifier}\`, but ${pkg.name} has no entry point \`./${subpath}\`. ${ADVICE}`)
    }
    sources.set(node, source)
    return source
  }

  /**
   * Reports a name an entry point does not export.
   *
   * @param source - The entry point the example takes the name from
   * @param name - The name taken
   * @param node - Where the example takes it
   */
  const checkName = (source: Source, name: string | null, node: Node): void => {
    if (name === null || name === 'default' || source.entry.symbols.has(name)) return
    const others = [...source.pkg.entries.values()].filter((entry) => entry.symbols.has(name))
    const elsewhere = others.map((entry) => `\`${entry.subpath === '' ? source.pkg.name : `${source.pkg.name}/${entry.subpath}`}\``)
    const hint = elsewhere.length === 0 ? '' : ` It is exported by ${elsewhere.join(', ')}.`
    problem(node, `Example takes \`${name}\` from \`${source.specifier}\`, which exports no \`${name}\`.${hint} ${ADVICE}`)
  }

  walk(program, false, (node, nested) => {
    if (node.kind === 'ImportDeclaration' || node.kind === 'ExportNamedDeclaration' || node.kind === 'ExportAllDeclaration') {
      const source = sourceOf(node.source as Node | null)
      if (source === null) return
      for (const specifier of (node.specifiers ?? []) as readonly Node[]) {
        if (specifier.kind === 'ImportNamespaceSpecifier') namespaces.set((specifier.local as Node).name as string, source)
        else if (specifier.kind === 'ImportSpecifier') checkName(source, nameOf(specifier.imported as Node), specifier.imported as Node)
        else if (specifier.kind === 'ExportSpecifier') checkName(source, nameOf(specifier.local as Node), specifier.local as Node)
      }
    } else if (node.kind === 'VariableDeclarator') {
      const init = node.init as Node | null
      // why: a bundle's global is destructured the way a required module is, so the two are one source of names.
      const source = init?.kind === 'Identifier' ? (namespaces.get(init.name as string) ?? null) : sourceOf(loadedModule(init))
      const id = node.id as Node
      if (source === null) return
      if (id.kind === 'Identifier') namespaces.set(id.name as string, source)
      else if (id.kind === 'ObjectPattern') {
        for (const property of id.properties as readonly Node[]) {
          if (property.kind === 'Property' && property.computed !== true)
            checkName(source, nameOf(property.key as Node), property.key as Node)
        }
      }
    } else if (node.kind === 'ImportExpression') sourceOf(node.source as Node)
    else if (node.kind === 'MemberExpression' || node.kind === 'TSQualifiedName') {
      const [space, member] = (node.kind === 'MemberExpression' ? [node.object, node.property] : [node.left, node.right]) as [Node, Node]
      const source = space.kind === 'Identifier' ? namespaces.get(space.name as string) : undefined
      if (source !== undefined && node.computed !== true) checkName(source, nameOf(member), member)
    } else if (node.kind === 'CallExpression' || node.kind === 'NewExpression') {
      const callee = node.callee as Node
      if (callee.kind !== 'Identifier') return
      const name = callee.name as string
      if (name === 'require') sourceOf((node.arguments as readonly Node[])[0] ?? null)
      // why: what a function's body calls is the reader's to supply, a handler or a renderer standing in for their code; what the example runs itself, at its top level, is what it demonstrates.
      if (own === null || nested || declared.has(name) || PROVIDED.has(name)) return
      if (index.symbols.has(name) || declarationsOf(own).has(name)) return
      if (shownAsWrong(lines, locate(example, callee.start).row)) return
      problem(
        callee,
        `Example calls \`${name}\`, which nothing provides: the example neither declares nor imports it, and no workspace package exports or declares it. Import it from where it lives now, declare it in the example, or mark a counter-example with ${WRONG}.`
      )
    }
  })
}
