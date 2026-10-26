/**
 * The imports of every code file, read by the parser and remembered on disk so that a graph build
 * reads only what changed since the last: a file whose size and modification time are unchanged
 * is not read, and one whose content hash is unchanged is not parsed. Each import carries its
 * form, whether it brings in types alone, the names it imports and where it stands; a load whose
 * specifier is an expression rather than a literal is kept as `unresolved`, so the analysis can
 * see that the file reaches something it cannot name.
 *
 * @module graph/imports
 */

import type { Node } from '@hyperfrontend/linter'
import type { FileImport, ImportKind } from './model'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, posix } from 'node:path'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { childrenOf, parseCode } from '@hyperfrontend/linter/helpers'
import { readAliases, readJson } from './workspace'

/** Where the remembered imports live under the workspace. */
const CACHE_FILE = join('node_modules', '.cache', 'hyperfrontend-lint', 'imports.json')

/** The extensions of the files whose imports count. */
const CODE_EXTENSIONS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/

/** The shape of a remembered import; raised when `FileImport` changes, which a cache written for the old shape does not survive. */
const CACHE_FORMAT = '3'

/** The alias naming the parser package, whose sources decide what a remembered entry means where a workspace runs the parser from source. */
const PARSER_ALIAS = '@hyperfrontend/linter'

/** The kinds whose braces make the `require` calls inside them dynamic for Nx. */
const DYNAMIC_SCOPES = createSet(['SwitchStatement', 'ClassBody', 'StaticBlock', 'TSModuleBlock'])

/** The cache file's shape. */
interface ImportCache {
  /** The reader version that wrote it. */
  readonly version: string
  /** The remembered imports by path. */
  readonly files: Readonly<Record<string, CachedImports>>
}

/** What is remembered for one file. */
interface CachedImports {
  /** The file's size and modification time when it was read. */
  readonly stamp: string
  /** The content hash the imports were read from. */
  readonly hash: string
  /** The imports. */
  readonly imports: readonly FileImport[]
}

/** An installed package's manifest, as far as its version is read. */
interface InstalledManifest {
  /** The installed version. */
  readonly version?: string
}

/** Where a statement stands in its file. */
interface Position {
  /** The one-based line. */
  readonly line: number
  /** The one-based column. */
  readonly column: number
}

/** The imports of each code file: the list read, or null for a file the parser could not read. */
export type ImportTable = ReadonlyMap<string, readonly FileImport[] | null>

/** The reader versions computed so far, by root. */
const readerVersions = createMap<string, string>()

/**
 * Whether a file's imports count: a code file outside any node_modules.
 *
 * @param path - The workspace-relative path
 * @returns Whether to read it
 */
export function isCodeFile(path: string): boolean {
  return CODE_EXTENSIONS.test(path) && !path.includes(`node_modules${posix.sep}`)
}

/**
 * The version of the reader for a workspace: the cache format, then a hash of the parser's
 * sources where the workspace aliases the parser package to its source, else the installed
 * parser's version. A cache another version wrote is discarded.
 *
 * @param root - The workspace root, absolute
 * @returns The version string
 */
export function readerVersion(root: string): string {
  let version = readerVersions.get(root)
  if (version === undefined) {
    version = `${CACHE_FORMAT}:${parserIdentity(root)}`
    readerVersions.set(root, version)
  }
  return version
}

/**
 * What identifies the parser a workspace reads imports with.
 *
 * @param root - The workspace root, absolute
 * @returns A hash of the aliased parser sources, the installed package's version, or `unknown`
 */
function parserIdentity(root: string): string {
  const target = readAliases(root).get(PARSER_ALIAS)?.[0]
  const sources = target === undefined ? null : join(root, dirname(target), 'code')
  if (sources !== null && existsSync(sources)) {
    const hash = createHash('sha1')
    for (const name of readdirSync(sources).sort()) {
      if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) hash.update(readFileSync(join(sources, name)))
    }
    return hash.digest('hex')
  }
  return readJson<InstalledManifest>(join(root, 'node_modules', '@hyperfrontend', 'linter', 'package.json'))?.version ?? 'unknown'
}

/**
 * The string a literal node holds.
 *
 * @param node - The node, which may be absent
 * @returns The string, or null for anything else
 */
function stringOf(node: Node | null | undefined): string | null {
  return node !== null && node !== undefined && node.kind === 'Literal' && typeof node.value === 'string' ? node.value : null
}

/**
 * The name an identifier or string literal carries.
 *
 * @param node - An identifier or a string literal
 * @returns The identifier's name or the literal's value
 */
function nameOf(node: Node): string {
  return node.kind === 'Identifier' ? (node.name as string) : (node.value as string)
}

/**
 * Whether a callee is `require` or `require.resolve`.
 *
 * @param callee - The called expression
 * @returns Whether a call of it loads a module
 */
function isRequire(callee: Node): boolean {
  if (callee.kind === 'Identifier') return callee.name === 'require'
  if (callee.kind !== 'MemberExpression' || callee.computed === true) return false
  const object = callee.object as Node
  const property = callee.property as Node
  return object.kind === 'Identifier' && object.name === 'require' && property.kind === 'Identifier' && property.name === 'resolve'
}

/**
 * Whether a callee is a `createRequire(...)` call, whose result loads a module when called.
 *
 * @param callee - The called expression
 * @returns Whether a call of it loads a module
 */
function isCreatedRequire(callee: Node): boolean {
  return (
    callee.kind === 'CallExpression' && (callee.callee as Node).kind === 'Identifier' && (callee.callee as Node).name === 'createRequire'
  )
}

/**
 * Whether a node opens a scope whose `require` calls Nx counts as dynamic: a braced block other
 * than a function declaration's body or a block nested in one, a switch, a class body or a module
 * block.
 *
 * @param node - The node entered
 * @returns Whether `require` calls below it are dynamic
 */
function isDynamicScope(node: Node): boolean {
  if (node.kind === 'BlockStatement') {
    const parent = (node.parent as Node).kind
    return parent !== 'FunctionDeclaration' && parent !== 'BlockStatement'
  }
  return DYNAMIC_SCOPES.has(node.kind)
}

/**
 * Whether a declaration brings in types alone: written `import type` or `export type`, or every
 * one of its specifiers written so.
 *
 * @param node - An import declaration, a named re-export or a star re-export
 * @returns True for a type-only declaration
 */
function isTypeOnly(node: Node): boolean {
  if (node.importKind === 'type' || node.exportKind === 'type') return true
  const specifiers = node.specifiers ?? []
  return specifiers.length > 0 && specifiers.every((specifier) => specifier.importKind === 'type' || specifier.exportKind === 'type')
}

/**
 * The names a declaration imports or re-exports from its source.
 *
 * @param node - An import declaration, a named re-export or a star re-export
 * @returns `default`, `*` for a namespace, or the names as the source exports them
 */
function namesOf(node: Node): string[] {
  if (node.kind === 'ExportAllDeclaration') return node.exported === null ? [] : ['*']
  return (node.specifiers ?? []).map((specifier) => {
    if (specifier.kind === 'ImportDefaultSpecifier') return 'default'
    if (specifier.kind === 'ImportNamespaceSpecifier') return '*'
    return nameOf((specifier.kind === 'ImportSpecifier' ? specifier.imported : specifier.local) as Node)
  })
}

/**
 * The source text of a node.
 *
 * @param text - The file's text
 * @param node - The node whose text is taken
 * @returns The text between the node's start and end
 */
function textOf(text: string, node: Node): string {
  return text.slice(node.start, node.end)
}

/**
 * The offsets at which each line of a text starts.
 *
 * @param text - The text whose lines are located
 * @returns The offsets, the first 0
 */
function lineStarts(text: string): number[] {
  const starts = [0]
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) starts.push(at + 1)
  return starts
}

/**
 * The line and column of an offset.
 *
 * @param starts - The offsets each line starts at
 * @param offset - The offset located
 * @returns The one-based position
 */
function positionOf(starts: readonly number[], offset: number): Position {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if ((starts[middle] as number) <= offset) low = middle
    else high = middle - 1
  }
  return { line: low + 1, column: offset - (starts[low] as number) + 1 }
}

/**
 * The imports a tree makes: declarations, re-exports, dynamic imports, `require` and
 * `require.resolve` calls, import equals declarations and import types, as Nx counts them, each
 * with its form, names and position.
 *
 * @param tree - The program
 * @param text - The text the program was parsed from, for positions
 * @returns The imports, in source order
 */
export function importsOfTree(tree: Node, text: string): FileImport[] {
  const starts = lineStarts(text)
  const imports: FileImport[] = []
  const push = (node: Node, specifier: string, dynamic: boolean, kind: ImportKind, typeOnly: boolean, names: readonly string[]): void => {
    imports.push({ specifier, dynamic, kind, typeOnly, names, ...positionOf(starts, node.start) })
  }
  const visit = (node: Node, nested: boolean): void => {
    const source = stringOf(node.source as Node | null | undefined)
    const dynamic = nested || isDynamicScope(node)
    if (
      (node.kind === 'ImportDeclaration' || node.kind === 'ExportNamedDeclaration' || node.kind === 'ExportAllDeclaration') &&
      source !== null
    ) {
      const typeOnly = isTypeOnly(node)
      const kind =
        node.kind === 'ExportAllDeclaration' && node.exported === null
          ? 're-export-all'
          : node.kind === 'ImportDeclaration' && (node.specifiers as readonly Node[]).length === 0
            ? 'side-effect'
            : typeOnly
              ? 'type'
              : 'value'
      push(node, source, false, kind, typeOnly, namesOf(node))
    } else if (node.kind === 'ImportExpression') {
      if (source !== null) push(node, source, true, 'dynamic', false, [])
      else push(node, textOf(text, node.source as Node), true, 'unresolved', false, [])
    } else if (node.kind === 'CallExpression' && (isRequire(node.callee as Node) || isCreatedRequire(node.callee as Node))) {
      const first = (node.arguments as readonly Node[])[0]
      const argument = stringOf(first)
      if (argument !== null) {
        // why: Nx reads `require` and `require.resolve` calls alone, so a literal through a created require draws no edge of its own.
        if (!isCreatedRequire(node.callee as Node)) push(node, argument, dynamic, 'value', false, [])
      } else if (first !== undefined) push(node, textOf(text, first), true, 'unresolved', false, [])
    } else if (node.kind === 'TSExternalModuleReference') {
      const argument = stringOf(node.expression as Node)
      const typeOnly = (node.parent as Node).importKind === 'type'
      if (argument !== null) push(node, argument, false, typeOnly ? 'type' : 'value', typeOnly, ['*'])
    } else if (node.kind === 'TSImportType') {
      const argument = stringOf(node.argument as Node)
      // why: Nx counts an import type as dynamic only where it opens a type alias, as its lexer sees `= import(`.
      if (argument !== null) push(node, argument, (node.parent as Node).kind === 'TSTypeAliasDeclaration', 'type', true, [])
    }
    for (const child of childrenOf(node)) visit(child, dynamic)
  }
  visit(tree, false)
  return imports
}

/**
 * The imports of a text.
 *
 * @param text - The file's text
 * @param file - Its path, whose extension decides the dialect
 * @returns The imports, in source order, or null when the text does not parse
 */
export function importsOfText(text: string, file: string): FileImport[] | null {
  const parsed = parseCode(text, extname(file), 'module', /\.d\.[cm]?ts$/.test(file))
  return parsed.tree === null ? null : importsOfTree(parsed.tree, text)
}

/**
 * The imports of one code file, read and parsed now.
 *
 * @param root - The workspace root, absolute
 * @param file - The workspace-relative path
 * @returns The imports, or null when the file does not parse
 */
export function readImports(root: string, file: string): FileImport[] | null {
  return importsOfText(readFileSync(join(root, file), 'utf8'), file)
}

/**
 * The imports of every code file among the given, from the cache where the file is unchanged
 * and from the parser otherwise; the cache is rewritten only when an entry changed. A file that
 * no longer exists is left out, and one that does not parse is recorded as null and is not
 * remembered, so a parser that learns to read it reads it next time.
 *
 * @param root - The workspace root, absolute
 * @param files - The workspace-relative paths
 * @returns The imports by path, for the code files only
 */
export function importsOfFiles(root: string, files: readonly string[]): Map<string, readonly FileImport[] | null> {
  const cacheFile = join(root, CACHE_FILE)
  const cache = readCache(cacheFile)
  const version = readerVersion(root)
  const remembered = cache !== null && cache.version === version ? cache.files : {}
  const fresh: Record<string, CachedImports> = {}
  const result = createMap<string, readonly FileImport[] | null>()
  let changed = keys(remembered).length
  for (const file of files) {
    if (!isCodeFile(file)) continue
    const stats = statSync(join(root, file), { throwIfNoEntry: false })
    if (stats === undefined) continue
    const stamp = `${stats.size}:${stats.mtimeMs}`
    const known = remembered[file]
    if (known !== undefined && known.stamp === stamp) {
      fresh[file] = known
      result.set(file, known.imports)
      changed -= 1
      continue
    }
    const text = readFileSync(join(root, file), 'utf8')
    const hash = createHash('sha1').update(text).digest('hex')
    const imports = known !== undefined && known.hash === hash ? known.imports : importsOfText(text, file)
    result.set(file, imports)
    if (imports !== null) fresh[file] = { stamp, hash, imports }
    changed = Infinity
  }
  if (changed !== 0) writeCache(cacheFile, { version, files: fresh })
  return result
}

/**
 * Writes the cache: each process writes its own file and renames it into place, so that
 * processes running in parallel never read half a cache.
 *
 * @param cacheFile - The cache's absolute path
 * @param cache - What to remember
 */
function writeCache(cacheFile: string, cache: ImportCache): void {
  mkdirSync(dirname(cacheFile), { recursive: true })
  const written = `${cacheFile}.${process.pid}.tmp`
  writeFileSync(written, stringify(cache))
  renameSync(written, cacheFile)
}

/**
 * The remembered imports, none when the cache is missing or unreadable.
 *
 * @param cacheFile - The cache's absolute path
 * @returns The cache, or null
 */
function readCache(cacheFile: string): ImportCache | null {
  if (!existsSync(cacheFile)) return null
  try {
    return parse(readFileSync(cacheFile, 'utf8')) as ImportCache
  } catch {
    return null
  }
}
