/**
 * The catalogue of what the documentation site publishes for a workspace: each publishable
 * library under `libs` with its route, its entry points and the symbols they export, the globals
 * its bundles assign, and the pages, guides and articles the site renders. Built once per
 * workspace and site for the life of the process.
 *
 * @module rules/workspace/shared/docs-catalog
 */

import type { DocsSymbol } from './docs-api.ts'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, posix, relative, sep } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { listSources, readDeclarations, readSymbols } from './docs-api.ts'
import { resolveModule } from './exports-index.ts'
import { isPublishableProject, readPackageFile, readProjectFile } from './project-file.ts'

/** The package a route sits under, and the entry whose page it is. */
export interface RouteOwner {
  /** The package. */
  readonly pkg: DocsPackage
  /** The entry, or null for the package's landing or another of its pages. */
  readonly entry: DocsEntry | null
}

/** The part of a manifest the repository URL is read from. */
interface RepositoryManifest {
  /** The repository, as a URL or an object with a `url`. */
  readonly repository?: unknown
}

/** An entry point a package exports, and the page documenting it. */
export interface DocsEntry {
  /** The subpath after the package name, empty for the root entry. */
  readonly subpath: string
  /** The site route of its page, with a trailing slash. */
  readonly route: string
  /** The source file the entry is built from. */
  readonly source: string
  /** What the entry exports, by name. */
  readonly symbols: ReadonlyMap<string, DocsSymbol>
}

/** A publishable library the site documents. */
export interface DocsPackage {
  /** The package name, or the directory name when the manifest names none. */
  readonly name: string
  /** The library's directory. */
  readonly directory: string
  /** The site route of its landing page, with a trailing slash. */
  readonly route: string
  /** Its entries, by subpath, in manifest order. */
  readonly entries: ReadonlyMap<string, DocsEntry>
  /** The subpath each bundle global exposes, by global name. */
  readonly globals: ReadonlyMap<string, string>
}

/** A symbol as one entry of one package exports it. */
export interface SymbolHit {
  /** The package. */
  readonly pkg: DocsPackage
  /** The entry. */
  readonly entry: DocsEntry
  /** The symbol. */
  readonly symbol: DocsSymbol
}

/** A member as one exported symbol carries it. */
export interface MemberHit {
  /** The package. */
  readonly pkg: DocsPackage
  /** The entry exporting the parent. */
  readonly entry: DocsEntry
  /** The symbol carrying the member. */
  readonly parent: DocsSymbol
  /** The member's name. */
  readonly member: string
}

/** What the site publishes, and where. */
export interface DocsIndex {
  /** The workspace root. */
  readonly root: string
  /** The documentation site's project directory. */
  readonly site: string
  /** The packages by name, in directory order. */
  readonly packages: ReadonlyMap<string, DocsPackage>
  /** Every export of every entry, by symbol name. */
  readonly symbols: ReadonlyMap<string, readonly SymbolHit[]>
  /** Every member of every exported symbol, by member name. */
  readonly members: ReadonlyMap<string, readonly MemberHit[]>
  /** The routes the site has a page for, as their segments joined by slashes. */
  readonly pages: ReadonlySet<string>
}

/** The workspace documents the site renders, by route. */
const ROOT_DOCUMENTS: Readonly<Record<string, string>> = {
  architecture: 'ARCHITECTURE.md',
  'docs/acknowledgments': 'ACKNOWLEDGMENTS.md',
  'docs/contributing': 'CONTRIBUTING.md',
  'docs/manifesto': 'MANIFESTO.md',
  'docs/regarding-ai': 'REGARDING_AI.md',
}

/** The source extensions an entry may be built from. */
const SOURCE = /\.[cm]?[jt]sx?$/

const indexes = createMap<string, DocsIndex>()
const declarationsByPackage = createMap<DocsPackage, Map<string, string[]>>()

/**
 * Reduces a route to its segments joined by slashes, `.` and `..` resolved, so that slashes
 * doubled, leading or trailing compare equal.
 *
 * @param route - A site path
 * @returns The canonical form, empty for the home page
 */
export function routeKey(route: string): string {
  const segments: string[] = []
  for (const segment of route.split('/')) {
    if (segment === '..') segments.pop()
    else if (segment !== '' && segment !== '.') segments.push(segment)
  }
  return segments.join('/')
}

/**
 * Lists the subdirectories of a directory, in name order.
 *
 * @param directory - An absolute directory that may not exist
 * @returns Their names, none when the directory cannot be read
 */
function subdirectories(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

/**
 * Finds the publishable libraries under a directory, not looking inside a project once found.
 *
 * @param directory - Where to look
 * @param found - Where the library directories go
 * @returns The library directories, in directory order
 */
function libraryDirectories(directory: string, found: string[] = []): string[] {
  for (const name of subdirectories(directory)) {
    const path = join(directory, name)
    const project = readProjectFile(path)
    if (project === null) libraryDirectories(path, found)
    else if (isPublishableProject(project)) found.push(path)
  }
  return found
}

/**
 * Reads the entries a manifest's `exports` map names: the root and `./` subpaths, no patterns
 * and no manifest, each built from a source file that exists.
 *
 * @param directory - The library's directory
 * @param route - The library's landing route
 * @param exportsField - The manifest's `exports` value
 * @returns The entries by subpath
 */
function readEntries(directory: string, route: string, exportsField: unknown): Map<string, DocsEntry> {
  const read = createMap<string, DocsEntry>()
  const manifest = join(directory, 'package.json')
  for (const [key, value] of entries(typeof exportsField === 'object' && exportsField !== null ? exportsField : {})) {
    if (key !== '.' && (!key.startsWith('./') || key.includes('*') || key === './package.json')) continue
    const conditions = value as Record<string, unknown>
    const target = [value, conditions?.['import'], conditions?.['default'], conditions?.['require']].find(
      (item) => typeof item === 'string'
    )
    const source = typeof target === 'string' ? resolveModule(manifest, target) : null
    if (source === null || !SOURCE.test(source)) continue
    const subpath = key === '.' ? '' : key.slice(2)
    read.set(subpath, { subpath, route: subpath === '' ? route : `${route}${subpath}/`, source, symbols: readSymbols(source) })
  }
  return read
}

/**
 * Reads the globals a library's bundles assign themselves to, from its build target's `iife`
 * and `umd` options, keeping those that expose an entry the library exports.
 *
 * @param options - The build target's options
 * @param exported - The library's entries
 * @returns The exposed subpath by global name
 */
function readGlobals(options: Record<string, unknown>, exported: ReadonlyMap<string, DocsEntry>): Map<string, string> {
  const globals = createMap<string, string>()
  for (const format of ['iife', 'umd']) {
    const declared = options[format]
    for (const bundle of isArray(declared) ? declared : [declared]) {
      const { globalName, entry } = (bundle ?? {}) as Record<string, unknown>
      const subpath = typeof entry === 'string' && entry !== '.' ? entry.replace(/^\.\//, '') : ''
      if (typeof globalName === 'string' && exported.has(subpath)) globals.set(globalName, subpath)
    }
  }
  return globals
}

/**
 * Lists the routes the site has a page for: every directory of its app holding a `page.tsx`.
 *
 * @param directory - The directory being read
 * @param segments - The route segments down to it
 * @param pages - Where the routes go
 * @returns The routes
 */
function readPages(directory: string, segments: readonly string[] = [], pages: Set<string> = createSet<string>()): Set<string> {
  if (existsSync(join(directory, 'page.tsx'))) pages.add(segments.join('/'))
  for (const name of subdirectories(directory)) readPages(join(directory, name), [...segments, name], pages)
  return pages
}

/**
 * Appends a value to the list a map holds under a key.
 *
 * @param map - Lists by key, grown in place
 * @param key - The list to grow
 * @param value - What it gains
 */
function append<Value>(map: Map<string, Value[]>, key: string, value: Value): void {
  const list = map.get(key)
  if (list === undefined) map.set(key, [value])
  else list.push(value)
}

/**
 * Builds the catalogue of a workspace, once per workspace and site.
 *
 * @param root - The workspace root
 * @param site - The documentation site's project directory
 * @returns The catalogue
 */
export function docsIndex(root: string, site: string): DocsIndex {
  const key = `${root}\n${site}`
  const known = indexes.get(key)
  if (known !== undefined) return known
  const packages = createMap<string, DocsPackage>()
  const symbols = createMap<string, SymbolHit[]>()
  const members = createMap<string, MemberHit[]>()
  const libraries = join(root, 'libs')
  for (const directory of libraryDirectories(libraries)) {
    const manifest = readPackageFile(directory)
    const name = typeof manifest?.name === 'string' && manifest.name !== '' ? manifest.name : basename(directory)
    const route = `/docs/libraries/${relative(libraries, directory).split(sep).join(posix.sep)}/`
    const build = readProjectFile(directory)?.targets?.['build'] as Record<string, unknown> | undefined
    const exported = readEntries(directory, route, manifest?.exports)
    const globals = readGlobals({ ...(build?.['options'] as object) }, exported)
    const pkg: DocsPackage = { name, directory, route, entries: exported, globals }
    packages.set(name, pkg)
    for (const entry of pkg.entries.values()) {
      for (const symbol of entry.symbols.values()) {
        append(symbols, symbol.name, { pkg, entry, symbol })
        for (const member of createSet(symbol.members)) append(members, member, { pkg, entry, parent: symbol, member })
      }
    }
  }
  const index: DocsIndex = { root, site, packages, symbols, members, pages: readPages(join(site, 'src', 'app')) }
  indexes.set(key, index)
  return index
}

/**
 * Reads the declarations a package's sources make, once per package.
 *
 * @param pkg - The package
 * @returns The declaring files by name
 */
export function declarationsOf(pkg: DocsPackage): Map<string, string[]> {
  const known = declarationsByPackage.get(pkg)
  if (known !== undefined) return known
  const declarations = readDeclarations(listSources(join(pkg.directory, 'src')))
  declarationsByPackage.set(pkg, declarations)
  return declarations
}

/**
 * Finds the package a file belongs to.
 *
 * @param index - The catalogue
 * @param file - The absolute path
 * @returns The package whose directory holds the file, or null
 */
export function packageOfFile(index: DocsIndex, file: string): DocsPackage | null {
  for (const pkg of index.packages.values()) if (file.startsWith(`${pkg.directory}${sep}`)) return pkg
  return null
}

/**
 * Finds the entry a file sits beside: the one built from a source in the same directory.
 *
 * @param pkg - The package
 * @param file - The absolute path
 * @returns The entry, or null
 */
export function entryOfFile(pkg: DocsPackage, file: string): DocsEntry | null {
  for (const entry of pkg.entries.values()) if (dirname(entry.source) === dirname(file)) return entry
  return null
}

/**
 * Finds the package a route sits under, and the entry whose page it is.
 *
 * @param index - The catalogue
 * @param route - A site path
 * @returns The package with the entry, null for a landing or other package page; null for a route outside every package
 */
export function entryOfRoute(index: DocsIndex, route: string): RouteOwner | null {
  const key = routeKey(route)
  for (const pkg of index.packages.values()) {
    const prefix = routeKey(pkg.route)
    if (key !== prefix && !key.startsWith(`${prefix}/`)) continue
    const rest = key.slice(prefix.length + 1)
    return { pkg, entry: rest === '' ? null : (pkg.entries.get(rest) ?? null) }
  }
  return null
}

/**
 * Tells whether the site publishes a route: the home page, a page of its app, or a guide or an
 * article with content.
 *
 * @param index - The catalogue
 * @param route - A site path
 * @returns True when the route resolves
 */
export function routeExists(index: DocsIndex, route: string): boolean {
  const path = routeKey(route)
  if (path === '' || index.pages.has(path)) return true
  const content = markdownOfRoute(index, route)
  return content !== null && /^(?:docs\/guides|articles)\/[^/]+$/.test(path) && existsSync(content)
}

/**
 * Finds the Markdown document a route renders: a workspace document, a guide or an article, a
 * package's README or architecture document, or the README beside an entry or a module.
 *
 * @param index - The catalogue
 * @param route - A site path
 * @returns The document's path, or null for a page that renders none
 */
export function markdownOfRoute(index: DocsIndex, route: string): string | null {
  const path = routeKey(route)
  const document = ROOT_DOCUMENTS[path]
  if (document !== undefined) return join(index.root, document)
  const guide = /^docs\/guides\/([^/]+)$/.exec(path)
  if (guide !== null) return join(index.site, 'content', 'guides', guide[1] as string, 'guide.md')
  const article = /^articles\/([^/]+)$/.exec(path)
  if (article !== null) return join(index.site, 'content', 'articles', `${article[1] as string}.md`)
  const owner = entryOfRoute(index, route)
  if (owner === null) return null
  const rest = path.slice(routeKey(owner.pkg.route).length + 1)
  if (rest === '' || rest === 'architecture') return join(owner.pkg.directory, rest === '' ? 'README.md' : 'ARCHITECTURE.md')
  const readme =
    owner.entry === null ? join(owner.pkg.directory, 'src', 'lib', rest, 'README.md') : join(dirname(owner.entry.source), 'README.md')
  return existsSync(readme) ? readme : null
}

/**
 * Reads the browsable URL of the workspace's repository from its manifest.
 *
 * @param root - The workspace root
 * @returns The URL without a `git+` prefix, `.git` suffix or trailing slash, or null when none is declared
 */
export function repositoryUrl(root: string): string | null {
  let manifest: RepositoryManifest
  try {
    manifest = parse(readFileSync(join(root, 'package.json'), 'utf8')) as RepositoryManifest
  } catch {
    return null
  }
  const declared = manifest.repository
  const url = typeof declared === 'object' && declared !== null ? (declared as Record<string, unknown>)['url'] : declared
  if (typeof url !== 'string' || url === '') return null
  return url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '')
}
