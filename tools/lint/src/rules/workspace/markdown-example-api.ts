/**
 * A fenced TypeScript or JavaScript example in Markdown uses API that exists. What an example
 * takes from a workspace package, by an import, a re-export, a `require` or a namespace, is
 * exported by the entry point it names; and in a package's own documentation, a function an
 * example calls at its top level is provided by something: the example, the platform, or a
 * workspace package.
 *
 * @module rules/workspace/markdown-example-api
 */

import type { MarkdownNode, Node, RuleContext } from '@hyperfrontend/linter'
import type { DocsEntry, DocsPackage } from './shared/docs-catalog.ts'
import { basename, dirname, join } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { BROWSER_AND_NODE_GLOBALS, defineRule } from '@hyperfrontend/linter'
import { childrenOf, parseCode } from '@hyperfrontend/linter/helpers'
import { workspaceRootOf } from '@hyperfrontend/workspace/lint'
import { declarationsOf, docsIndex, packageOfFile } from './shared/docs-catalog.ts'

/** The extension each fence language is parsed as. */
const EXTENSIONS: Readonly<Record<string, string>> = {
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

/** The functions and constructors an example may call without declaring: the language's, the platform's and a test runner's. */
const PROVIDED = createSet([
  ...`AggregateError Array ArrayBuffer BigInt BigInt64Array BigUint64Array Boolean DataView Date Error EvalError FinalizationRegistry
  Float32Array Float64Array Function Int16Array Int32Array Int8Array Map Number Object Promise Proxy RangeError ReferenceError
  RegExp Set SharedArrayBuffer String Symbol SyntaxError TypeError URIError Uint16Array Uint32Array Uint8Array Uint8ClampedArray
  WeakMap WeakRef WeakSet decodeURI decodeURIComponent encodeURI encodeURIComponent eval isFinite isNaN parseFloat parseInt
  afterAll afterEach beforeAll beforeEach describe expect it test`.split(/\s+/),
  ...keys(BROWSER_AND_NODE_GLOBALS),
])

/** The node kinds whose body runs when the reader's code calls it, not when the example does. */
const FUNCTIONS = createSet(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/** The marks an example sets on code it shows as right and as wrong. */
const RIGHT = '✅'
const WRONG = '❌'

/** What every finding advises. */
const ADVICE = 'Update the example to the API as it is now.'

/** An entry point of a workspace package, as an example names it. */
interface Source {
  /** The specifier as written. */
  readonly specifier: string
  /** The package. */
  readonly pkg: DocsPackage
  /** The entry point. */
  readonly entry: DocsEntry
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

export default defineRule<undefined, MarkdownNode>({
  id: 'workspace/markdown-example-api',
  language: 'markdown',
  fixable: false,
  create(context: RuleContext<undefined, MarkdownNode>) {
    const path = context.file.path
    if (!path.endsWith('.md') || basename(path) === 'CHANGELOG.md') return {}
    const root = workspaceRootOf(dirname(path))
    if (root === null) return {}
    const index = docsIndex(root, join(root, 'apps/docs-site'))
    const own = packageOfFile(index, path)
    return {
      code(block) {
        const extension = EXTENSIONS[(block.lang ?? '').toLowerCase()]
        if (extension === undefined) return
        const text = block.value as string
        // why: an example that does not parse is a sketch, elided or schematic, and a sketch states no API precisely enough to check.
        const program = parseCode(text, extension).tree
        if (program === null) return
        const lines = text.split(/\r?\n/)
        const declared = declaredNames(program)
        const sources = createMap<Node, Source | null>()
        const namespaces = createMap<string, Source>()

        /**
         * Reports a problem on a node of the example, at its place in the file.
         *
         * @param node - The node of the example
         * @param message - What is wrong
         */
        const report = (node: Node, message: string): void => {
          const before = text.slice(0, node.start).split(/\r?\n/)
          const row = before.length - 1
          // why: a fence inside a list or a quote loses its indentation in the example's text, so each line is found again in the file's own line.
          const lineStart = context.file.lines.starts[block.position.start.line + row] as number
          const start = context.file.text.indexOf(lines[row] as string, lineStart) + (before[row] as string).length
          context.report({ start, end: start + node.end - node.start, message })
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
            report(node, `Example imports from \`${specifier}\`, but ${pkg.name} has no entry point \`./${subpath}\`. ${ADVICE}`)
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
          report(node, `Example takes \`${name}\` from \`${source.specifier}\`, which exports no \`${name}\`.${hint} ${ADVICE}`)
        }

        walk(program, false, (node, nested) => {
          if (node.kind === 'ImportDeclaration' || node.kind === 'ExportNamedDeclaration' || node.kind === 'ExportAllDeclaration') {
            const source = sourceOf(node.source as Node | null)
            if (source === null) return
            for (const specifier of (node.specifiers ?? []) as readonly Node[]) {
              if (specifier.kind === 'ImportNamespaceSpecifier') namespaces.set((specifier.local as Node).name as string, source)
              else if (specifier.kind === 'ImportSpecifier')
                checkName(source, nameOf(specifier.imported as Node), specifier.imported as Node)
              else if (specifier.kind === 'ExportSpecifier') checkName(source, nameOf(specifier.local as Node), specifier.local as Node)
            }
          } else if (node.kind === 'VariableDeclarator') {
            const source = sourceOf(loadedModule(node.init as Node | null))
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
            const [space, member] = (node.kind === 'MemberExpression' ? [node.object, node.property] : [node.left, node.right]) as [
              Node,
              Node,
            ]
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
            if (shownAsWrong(lines, text.slice(0, callee.start).split(/\r?\n/).length - 1)) return
            report(
              callee,
              `Example calls \`${name}\`, which nothing provides: the example neither declares nor imports it, and no workspace package exports or declares it. Import it from where it lives now, declare it in the example, or mark a counter-example with ${WRONG}.`
            )
          }
        })
      },
    }
  },
})
