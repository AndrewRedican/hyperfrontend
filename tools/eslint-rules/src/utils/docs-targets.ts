/**
 * The documentation targets a workspace offers.
 *
 * Every publishable package, the entry points its manifest exports, the
 * symbols each entry carries and the members those symbols declare, the
 * declarations inside the package's sources, the bundle globals its build
 * names, and the pages the documentation site publishes. Rules that decide
 * whether a code mention has somewhere to link read all of it from here, so
 * the answer comes from the manifests and the sources rather than from a
 * hand-kept list.
 *
 * @module utils/docs-targets
 */

import type { DocsSymbol, SourceCache } from './docs-targets-source'
import { statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { listSources, readDeclarations, readSymbols } from './docs-targets-source'
import { exists, readFileIfExists, readJsonFileIfExists } from './fs'
import { getAllPublishableLibraries } from './nx-project'

export type { DocsSymbol } from './docs-targets-source'

/** One entry point of a package: a subpath the manifest exports and the page the site gives it. */
export interface DocsEntry {
  /** The subpath after the package name, empty for the root entry. */
  subpath: string
  /** Absolute path of the entry's TypeScript source. */
  file: string
  /** Site-relative route of the entry's page, with a trailing slash. */
  route: string
  /** Every symbol the entry exports, by name. */
  symbols: ReadonlyMap<string, DocsSymbol>
}

/** One publishable package and everything documented under it. */
export interface DocsPackage {
  /** The npm package name. */
  name: string
  /** Absolute path of the package root. */
  root: string
  /** Site-relative route of the package's landing page, with a trailing slash. */
  route: string
  /** The entry points, by subpath. */
  entries: ReadonlyMap<string, DocsEntry>
  /** Bundle global names the build declares, each mapped to the subpath the bundle exposes. */
  globals: ReadonlyMap<string, string>
  /** Top-level declaration names in the package's sources, each mapped to the files declaring it. */
  declarations: ReadonlyMap<string, readonly string[]>
}

/** Where a symbol is exported from. */
export interface SymbolHit {
  /** The package exporting it. */
  pkg: DocsPackage
  /** The entry exporting it. */
  entry: DocsEntry
}

/** Where a member name is declared. */
export interface MemberHit extends SymbolHit {
  /** The exported symbol whose declaration carries the member. */
  parent: DocsSymbol
  /** The member name that was looked up. */
  member: string
}

/** The whole index, built once per workspace and refreshed when its inputs change. */
export interface DocsTargetIndex {
  /** Absolute path of the workspace root. */
  workspaceRoot: string
  /** Absolute path of the documentation site's project. */
  siteRoot: string
  /** Every publishable package, by npm name. */
  packages: ReadonlyMap<string, DocsPackage>
  /** Every exported symbol name, mapped to each entry exporting it. */
  symbols: ReadonlyMap<string, readonly SymbolHit[]>
  /** Every member name, mapped to each exported symbol declaring it. */
  members: ReadonlyMap<string, readonly MemberHit[]>
}

/** Where the site keeps its routes, relative to its project root. */
const APP_DIR = 'src/app'

/** The route under which guides are served by a dynamic segment. */
const GUIDES_PREFIX = '/docs/guides/'

/** The route under which articles are served by a dynamic segment. */
const ARTICLES_PREFIX = '/articles/'

/**
 * Reads the slug a dynamic route serves.
 *
 * @param path - The route without its trailing slash.
 * @param prefix - The static part of the dynamic route.
 * @returns The one segment after the prefix, or null when the path is not that route.
 */
function dynamicSlug(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) {
    return null
  }
  const slug = path.slice(prefix.length)
  return slug !== '' && !slug.includes('/') ? slug : null
}

/** Directories a package's source walk never enters. */

/** One subpath a manifest exports, paired with the source it is built from. */
interface EntryPoint {
  /** The subpath after the package name, empty for the root entry. */
  subpath: string
  /** Absolute path of the entry's TypeScript source. */
  file: string
}

/** The build options that name bundle globals. */
interface BundleBuildOptions {
  /** IIFE bundles, one or several. */
  iife?: BundleOptions | BundleOptions[]
  /** UMD bundles, one or several. */
  umd?: BundleOptions | BundleOptions[]
}

/** The build target of a project manifest. */
interface BundleBuildTarget {
  /** Its options. */
  options?: BundleBuildOptions
}

/** The targets of a project manifest. */
interface BundleTargets {
  /** The build target. */
  build?: BundleBuildTarget
}

/** The shape of a manifest's `exports` field this index reads. */
interface ManifestExports {
  /** Subpath exports, each a path or a conditions object. */
  exports?: Record<string, string | Record<string, string>>
}

/** The shape of a project's IIFE and UMD build options this index reads. */
interface BundleOptions {
  /** The entry the bundle wraps, `.` for the root. */
  entry?: string
  /** The global the bundle assigns itself to. */
  globalName?: string
}

/** The parts of a project manifest the bundle globals come from. */
interface BundleProjectJson {
  /** Build targets. */
  targets?: BundleTargets
}

/** A parsed source file and the declarations it exports, cached by path for the life of an index build. */

/**
 * Maps a package root to the route its landing page is published at.
 *
 * Utility packages live under a shared umbrella and drop their `-utils`
 * suffix in the URL, which is the same mapping the site's own route table
 * performs.
 *
 * @param workspaceRoot - Absolute path of the workspace.
 * @param packageRoot - Absolute path of the package.
 * @returns The site-relative route, with a trailing slash.
 */
export function packageRoute(workspaceRoot: string, packageRoot: string): string {
  const segments = relative(workspaceRoot, packageRoot).split(sep)
  const short = segments[segments.length - 1] ?? ''
  return segments[1] === 'utils' ? `/docs/libraries/utils/${short}/` : `/docs/libraries/${short}/`
}

/**
 * Turns a manifest export target into the TypeScript source it is built from.
 *
 * @param target - The manifest's path, such as `./src/host/index.js`.
 * @returns The `.ts` path relative to the package, or null when the target is not a module.
 */
function sourceOfExport(target: string): string | null {
  const normalized = target.replace(/^\.\//, '')
  if (normalized.endsWith('.json')) {
    return null
  }
  if (normalized.endsWith('.js')) {
    return `${normalized.slice(0, -3)}.ts`
  }
  return normalized.endsWith('.ts') ? normalized : join(normalized, 'index.ts')
}

/**
 * Reads the entry points a manifest exports, as subpath and source file pairs.
 *
 * @param packageRoot - Absolute path of the package.
 * @param manifest - The parsed manifest.
 * @returns Each concrete subpath with the source it points at.
 */
function readEntryPoints(packageRoot: string, manifest: ManifestExports | null): EntryPoint[] {
  const points: EntryPoint[] = []
  for (const [key, value] of entries(manifest?.exports ?? {})) {
    if (key === './package.json' || key.includes('*') || !key.startsWith('.')) {
      continue
    }
    const target = typeof value === 'string' ? value : (value['import'] ?? value['default'] ?? value['require'])
    const source = typeof target === 'string' ? sourceOfExport(target) : null
    if (source === null) {
      continue
    }
    const file = join(packageRoot, source)
    if (exists(file)) {
      points.push({ subpath: key === '.' ? '' : key.slice(2), file })
    }
  }
  return points
}

/**
 * Parses a source file once per index build.
 *
 * @param cache - The build's parse cache.
 * @param file - Absolute path of the file.
 * @returns The parsed file, or null when it cannot be read.
 */

/**
 * Reads the bundle globals a project's build declares.
 *
 * @param projectJson - The parsed project manifest.
 * @returns Each global name mapped to the subpath its bundle exposes.
 */
function readBundleGlobals(projectJson: BundleProjectJson | null): Map<string, string> {
  const globals = createMap<string, string>()
  const options = projectJson?.targets?.build?.options
  for (const bundles of [options?.iife, options?.umd]) {
    const list = bundles === undefined ? [] : isArray(bundles) ? bundles : [bundles]
    for (const bundle of list) {
      if (typeof bundle.globalName === 'string') {
        const entry = bundle.entry ?? '.'
        globals.set(bundle.globalName, entry === '.' ? '' : entry.replace(/^\.\//, ''))
      }
    }
  }
  return globals
}

/**
 * Lists every source file of a package that documents the package rather than tests it.
 *
 * @param dir - Directory to walk.
 * @param into - The list files are appended to.
 * @returns The list, for chaining.
 */

/**
 * Fingerprints the inputs an index is built from, so a rebuild happens only
 * when a manifest, an entry or a source has changed.
 *
 * @param files - The files the index read.
 * @returns A string that changes when any of them does.
 */
function fingerprint(files: readonly string[]): string {
  return files
    .map((file) => {
      try {
        return `${file}:${statSync(file).mtimeMs}`
      } catch {
        return `${file}:missing`
      }
    })
    .join('\n')
}

/** A freshly built index and the files it read. */
interface BuiltIndex {
  /** The built index. */
  index: DocsTargetIndex
  /** The files the index read, to fingerprint. */
  inputs: string[]
}

/** An index together with the fingerprint of what it was built from. */
interface CachedIndex {
  /** The built index. */
  index: DocsTargetIndex
  /** The inputs' fingerprint at build time. */
  fingerprint: string
  /** The inputs to fingerprint on the next request. */
  inputs: readonly string[]
}

const cache = createMap<string, CachedIndex>()

/**
 * Builds the index from scratch.
 *
 * @param workspaceRoot - Absolute path of the workspace.
 * @param siteRoot - Absolute path of the documentation site's project.
 * @returns The index and the files it read.
 */
function buildIndex(workspaceRoot: string, siteRoot: string): BuiltIndex {
  const parsed: SourceCache = createMap()
  const packages = createMap<string, DocsPackage>()
  const symbols = createMap<string, SymbolHit[]>()
  const members = createMap<string, MemberHit[]>()
  const inputs: string[] = []

  for (const library of getAllPublishableLibraries(workspaceRoot)) {
    const manifest = readJsonFileIfExists<ManifestExports>(join(library.root, 'package.json'))
    const sources = listSources(join(library.root, 'src'))
    inputs.push(join(library.root, 'package.json'), join(library.root, 'project.json'), ...sources)
    const route = packageRoute(workspaceRoot, library.root)
    const entryMap = createMap<string, DocsEntry>()
    for (const point of readEntryPoints(library.root, manifest)) {
      entryMap.set(point.subpath, {
        subpath: point.subpath,
        file: point.file,
        route: point.subpath === '' ? route : `${route}${point.subpath}/`,
        symbols: readSymbols(parsed, point.file),
      })
    }
    const pkg: DocsPackage = {
      name: library.name,
      root: library.root,
      route,
      entries: entryMap,
      globals: readBundleGlobals(library.projectJson as BundleProjectJson),
      declarations: readDeclarations(parsed, sources),
    }
    packages.set(pkg.name, pkg)
    for (const entry of entryMap.values()) {
      for (const symbol of entry.symbols.values()) {
        symbols.set(symbol.name, [...(symbols.get(symbol.name) ?? []), { pkg, entry }])
        for (const member of symbol.members) {
          members.set(member, [...(members.get(member) ?? []), { pkg, entry, parent: symbol, member }])
        }
      }
    }
  }

  return { index: { workspaceRoot, siteRoot, packages, symbols, members }, inputs }
}

/**
 * The documentation target index of a workspace.
 *
 * Built on first request and rebuilt only when one of the manifests, entry
 * points or sources it was read from has changed since, so an editor session
 * that keeps a lint process alive sees a new export as soon as it is saved
 * and a batch run pays for the build once.
 *
 * @param workspaceRoot - Absolute path of the workspace.
 * @param siteRoot - Absolute path of the documentation site's project.
 * @returns The workspace's packages, symbols and members, ready to query.
 *
 * @example Looking up where a symbol is documented
 * ```typescript
 * const index = getDocsTargetIndex('/repo', '/repo/apps/docs-site')
 * index.symbols.get('createShell')?.[0]?.entry.route // '/docs/libraries/features/host/'
 * ```
 */
export function getDocsTargetIndex(workspaceRoot: string, siteRoot: string): DocsTargetIndex {
  const key = `${workspaceRoot}\n${siteRoot}`
  const cached = cache.get(key)
  if (cached !== undefined && fingerprint(cached.inputs) === cached.fingerprint) {
    return cached.index
  }
  const built = buildIndex(workspaceRoot, siteRoot)
  cache.set(key, { index: built.index, fingerprint: fingerprint(built.inputs), inputs: built.inputs })
  return built.index
}

/**
 * Forgets every built index, so the next request rebuilds.
 *
 * @example Isolating a test from an earlier build
 * ```typescript
 * resetDocsTargetIndex()
 * ```
 */
export function resetDocsTargetIndex(): void {
  cache.clear()
}

/**
 * The package a file belongs to.
 *
 * @param index - The workspace's target index.
 * @param file - Absolute path of the file.
 * @returns The deepest package whose root contains the file, or null when none does.
 */
export function packageOfFile(index: DocsTargetIndex, file: string): DocsPackage | null {
  let owner: DocsPackage | null = null
  for (const pkg of index.packages.values()) {
    if (file.startsWith(`${pkg.root}${sep}`) && (owner === null || pkg.root.length > owner.root.length)) {
      owner = pkg
    }
  }
  return owner
}

/**
 * The entry point a file documents, when it sits beside one.
 *
 * An entry's README lives in the entry's own directory, so the directory is
 * what says which entry a document belongs to. A package README, an
 * architecture document or a module README with no entry of its own belongs
 * to the package as a whole and yields null.
 *
 * @param pkg - The package the file belongs to.
 * @param file - Absolute path of the file.
 * @returns The entry whose directory holds the file, or null.
 */
export function entryOfFile(pkg: DocsPackage, file: string): DocsEntry | null {
  const dir = dirname(file)
  for (const entry of pkg.entries.values()) {
    if (dirname(entry.file) === dir) {
      return entry
    }
  }
  return null
}

/**
 * Whether the site publishes a page at a route.
 *
 * A static route has a `page.tsx` where the route says; a guide or an article
 * is served by a dynamic segment and exists when its content does.
 *
 * @param index - The workspace's target index.
 * @param route - Site-relative route, with or without a trailing slash.
 * @returns True when a request for the route is answered by a page.
 */
export function routeExists(index: DocsTargetIndex, route: string): boolean {
  const path = route.replace(/\/+$/, '')
  if (path === '') {
    return true
  }
  const appDir = join(index.siteRoot, APP_DIR)
  if (exists(join(appDir, path, 'page.tsx'))) {
    return true
  }
  const guide = dynamicSlug(path, GUIDES_PREFIX)
  if (guide !== null) {
    return exists(join(index.siteRoot, 'content/guides', guide, 'guide.md'))
  }
  const article = dynamicSlug(path, ARTICLES_PREFIX)
  if (article !== null) {
    return exists(join(index.siteRoot, 'content/articles', `${article}.md`))
  }
  return false
}

/**
 * The markdown source a route renders, when it renders one.
 *
 * Package pages render the package README, architecture pages the package's
 * ARCHITECTURE.md, entry pages the README beside the entry, guides their
 * guide file, and a handful of top-level pages the workspace documents of the
 * same name. A page written in TSX renders no markdown and yields null.
 *
 * @param index - The workspace's target index.
 * @param route - Site-relative route.
 * @returns Absolute path of the markdown file, or null when the route is not a rendered document.
 */
export function markdownOfRoute(index: DocsTargetIndex, route: string): string | null {
  const path = route.replace(/\/+$/, '')
  const rootDocs: Record<string, string> = {
    '/architecture': 'ARCHITECTURE.md',
    '/docs/contributing': 'CONTRIBUTING.md',
    '/docs/manifesto': 'MANIFESTO.md',
    '/docs/acknowledgments': 'ACKNOWLEDGMENTS.md',
    '/docs/regarding-ai': 'REGARDING_AI.md',
  }
  const rootDoc = rootDocs[path]
  if (rootDoc !== undefined) {
    return join(index.workspaceRoot, rootDoc)
  }
  const guide = dynamicSlug(path, GUIDES_PREFIX)
  if (guide !== null) {
    return join(index.siteRoot, 'content/guides', guide, 'guide.md')
  }
  const article = dynamicSlug(path, ARTICLES_PREFIX)
  if (article !== null) {
    return join(index.siteRoot, 'content/articles', `${article}.md`)
  }
  for (const pkg of index.packages.values()) {
    const base = pkg.route.replace(/\/$/, '')
    if (path === base) {
      return join(pkg.root, 'README.md')
    }
    if (path === `${base}/architecture`) {
      return join(pkg.root, 'ARCHITECTURE.md')
    }
    if (path.startsWith(`${base}/`)) {
      const subpath = path.slice(base.length + 1)
      for (const candidate of [join(pkg.root, 'src', subpath, 'README.md'), join(pkg.root, 'src/lib', subpath, 'README.md')]) {
        if (exists(candidate)) {
          return candidate
        }
      }
    }
  }
  return null
}

/**
 * The package and entry a route belongs to, when it is a package or entry page.
 *
 * @param index - The workspace's target index.
 * @param route - Site-relative route.
 * @returns The package, and the entry when the route is an entry's page.
 */

/** The package a route belongs to, and the entry when the route is an entry's page. */
export interface RouteOwner {
  /** The package. */
  pkg: DocsPackage
  /** The entry, or null on the package's own landing or architecture page. */
  entry: DocsEntry | null
}

/**
 * The package and entry a route belongs to, when it is a package or entry page.
 *
 * @param index - The workspace's target index.
 * @param route - Site-relative route.
 * @returns The package, and the entry when the route is an entry's page.
 */
export function entryOfRoute(index: DocsTargetIndex, route: string): RouteOwner | null {
  const path = route.replace(/\/+$/, '')
  for (const pkg of index.packages.values()) {
    const base = pkg.route.replace(/\/$/, '')
    if (path === base) {
      return { pkg, entry: null }
    }
    if (path.startsWith(`${base}/`)) {
      const entry = pkg.entries.get(path.slice(base.length + 1))
      return { pkg, entry: entry ?? null }
    }
  }
  return null
}

/** The repository field of a manifest, in either of the shapes npm accepts. */
interface RepositoryField {
  /** Clone URL the repository is published under. */
  url?: string
}

/** The parts of the workspace manifest the repository URL comes from. */
interface RootManifest {
  /** npm repository descriptor, or the URL alone. */
  repository?: RepositoryField | string
}

/**
 * Reads a workspace's canonical repository URL from its root manifest.
 *
 * @param workspaceRoot - Absolute path of the workspace.
 * @returns A browsable `https://host/owner/name` URL, or null when the manifest declares none.
 */
export function readRepositoryUrl(workspaceRoot: string): string | null {
  const text = readFileIfExists(join(workspaceRoot, 'package.json'))
  if (text === null) {
    return null
  }
  const manifest = parse(text) as RootManifest
  const declared = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url
  if (typeof declared !== 'string' || declared === '') {
    return null
  }
  return declared
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
}
