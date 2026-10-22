/**
 * The imports of every code file, read by the parser and remembered on disk so that a lint run
 * reads only what changed since the last: a file whose size and modification time are unchanged
 * is not read, and one whose content hash is unchanged is not parsed.
 *
 * @module graph/imports
 */

import type { Node } from '../code/model.ts'
import type { FileImport } from './model.ts'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, posix } from 'node:path'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { childrenOf } from '../code/children.ts'
import { parseCode } from '../code/parse.ts'

/** Where the remembered imports live under the workspace. */
const CACHE_FILE = join('node_modules', '.cache', 'hyperfrontend-lint', 'imports.json')

/** The extensions of the files whose imports count. */
const CODE_EXTENSIONS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/

/** The parser's sources and this module, whose content decides what a remembered entry means. */
const READER_SOURCES = [
  ...readdirSync(join(import.meta.dirname, '..', 'code'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map((name) => join(import.meta.dirname, '..', 'code', name)),
  import.meta.filename,
]

/** The version of the reader, a hash of its sources, which a cache written by another does not survive. */
const CACHE_VERSION = READER_SOURCES.reduce((hash, file) => hash.update(readFileSync(file)), createHash('sha1')).digest('hex')

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
 * The string a literal node holds.
 *
 * @param node - The node, which may be absent
 * @returns The string, or null for anything else
 */
function stringOf(node: Node | null | undefined): string | null {
  return node !== null && node !== undefined && node.kind === 'Literal' && typeof node.value === 'string' ? node.value : null
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
 * The imports a tree makes: declarations, re-exports, dynamic imports, `require` and
 * `require.resolve` calls, import equals declarations and import types, as Nx counts them.
 *
 * @param tree - The program
 * @returns The imports, in source order
 */
export function importsOfTree(tree: Node): FileImport[] {
  const imports: FileImport[] = []
  const visit = (node: Node, nested: boolean): void => {
    const source = stringOf(node.source as Node | null | undefined)
    const dynamic = nested || isDynamicScope(node)
    if (
      (node.kind === 'ImportDeclaration' || node.kind === 'ExportNamedDeclaration' || node.kind === 'ExportAllDeclaration') &&
      source !== null
    ) {
      imports.push({ specifier: source, dynamic: false })
    } else if (node.kind === 'ImportExpression' && source !== null) imports.push({ specifier: source, dynamic: true })
    else if (node.kind === 'CallExpression' && isRequire(node.callee as Node)) {
      const argument = stringOf((node.arguments as readonly Node[])[0])
      if (argument !== null) imports.push({ specifier: argument, dynamic })
    } else if (node.kind === 'TSExternalModuleReference') {
      const argument = stringOf(node.expression as Node)
      if (argument !== null) imports.push({ specifier: argument, dynamic: false })
    } else if (node.kind === 'TSImportType') {
      const argument = stringOf(node.argument as Node)
      // why: Nx counts an import type as dynamic only where it opens a type alias, as its lexer sees `= import(`.
      if (argument !== null) imports.push({ specifier: argument, dynamic: (node.parent as Node).kind === 'TSTypeAliasDeclaration' })
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
  return parsed.tree === null ? null : importsOfTree(parsed.tree)
}

/**
 * The imports of every code file among the given, from the cache where the file is unchanged
 * and from the parser otherwise; the cache is rewritten only when an entry changed. A file that
 * no longer exists is left out, and one that does not parse counts as importing nothing and is
 * not remembered, so a parser that learns to read it reads it next time.
 *
 * @param root - The workspace root, absolute
 * @param files - The workspace-relative paths
 * @returns The imports by path, for the code files only
 */
export function importsOfFiles(root: string, files: readonly string[]): Map<string, readonly FileImport[]> {
  const cacheFile = join(root, CACHE_FILE)
  const cache = readCache(cacheFile)
  const remembered = cache !== null && cache.version === CACHE_VERSION ? cache.files : {}
  const fresh: Record<string, CachedImports> = {}
  const result = createMap<string, readonly FileImport[]>()
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
    result.set(file, imports ?? [])
    if (imports !== null) fresh[file] = { stamp, hash, imports }
    changed = Infinity
  }
  if (changed !== 0) writeCache(cacheFile, { version: CACHE_VERSION, files: fresh })
  return result
}

/**
 * Writes the cache: each process writes its own file and renames it into place, so that lint
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
