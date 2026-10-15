import { posix } from 'node:path'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * The section of the docs-site library index a package is listed under.
 */
export type DocsCategory = 'core' | 'supporting' | 'utils'

/**
 * One level of the docs-site ecosystem hierarchy, top to bottom.
 */
export type EcosystemTierId = 'sdk' | 'messaging' | 'tooling' | 'primitives' | 'standalone' | 'utilities'

/**
 * Every level of the hierarchy, in the order the index draws them.
 */
export const ECOSYSTEM_TIER_IDS: readonly EcosystemTierId[] = ['sdk', 'messaging', 'tooling', 'primitives', 'standalone', 'utilities']

/**
 * What is read from a project before it can be registered across the workspace.
 */
export interface LibraryFactsInput {
  /** Nx project name, `lib-data-utils` */
  projectName: string
  /** Workspace-relative project root, `libs/utils/data` */
  projectRoot: string
  /** npm package name, `@hyperfrontend/data-utils` */
  packageName: string
  /** The package's one-line description */
  description: string
  /** The project's Nx tags */
  tags: readonly string[]
  /** The package's exports map */
  exports: Record<string, unknown>
  /** Section of the docs-site index, when chosen rather than derived */
  docsCategory?: DocsCategory
  /** Whether the project carries an ARCHITECTURE.md */
  hasArchitecture: boolean
}

/**
 * Everything the workspace's registrations of one package are written from.
 *
 * The same package is named differently by each surface: the CI workflows
 * know it by a coverage flag, the docs site by a route and a manifest slug,
 * the navigation by its unscoped name. Deriving them once keeps every
 * registration agreeing with the lint rules that check them.
 */
export interface LibraryFacts {
  /** Nx project name, `lib-data-utils` */
  projectName: string
  /** Workspace-relative project root, `libs/utils/data` */
  projectRoot: string
  /** npm package name, `@hyperfrontend/data-utils` */
  packageName: string
  /** Package name without its scope, `data-utils` */
  libName: string
  /** The package's one-line description */
  description: string
  /** Codecov flag and CI filter name, `data-utils` */
  coverageFlag: string
  /** Docs-site route under `/docs/libraries/`, `utils/data` */
  routeSlug: string
  /** Slug the docs manifest knows the package by, `data-utils` */
  manifestSlug: string
  /** Slug the library page component receives, `data` */
  pageSlug: string
  /** Title-cased name, `Data Utils` */
  displayName: string
  /** Section of the docs-site index */
  docsCategory: DocsCategory
  /** Secondary entry subpaths, sorted, `['browser', 'node']` */
  secondaryEntries: string[]
  /** Workspace-relative TypeScript entry files, main entry first */
  entryPoints: string[]
  /** Whether the project carries an ARCHITECTURE.md */
  hasArchitecture: boolean
}

/**
 * Whether a project root sits under `libs/utils`.
 *
 * @param projectRoot - Workspace-relative project root
 * @returns True for a utility package
 */
export function isUtilsRoot(projectRoot: string): boolean {
  const parts = projectRoot.split(posix.sep).filter(Boolean)
  return parts.length >= 3 && parts[0] === 'libs' && parts[1] === 'utils'
}

/**
 * The name a project is known by on the surfaces that identify it by its
 * location: a utility becomes `<name>-utils`, anything else its last segment.
 *
 * @param projectRoot - Workspace-relative project root
 * @returns The derived name
 *
 * @example
 * ```typescript
 * locationName('libs/utils/json') // 'json-utils'
 * locationName('libs/network-protocol') // 'network-protocol'
 * ```
 */
export function locationName(projectRoot: string): string {
  const parts = projectRoot.split(posix.sep).filter(Boolean)
  const last = parts[parts.length - 1] as string
  return isUtilsRoot(projectRoot) ? `${last}-utils` : last
}

/**
 * The docs-site route of a project under `/docs/libraries/`.
 *
 * @param projectRoot - Workspace-relative project root
 * @returns `utils/<name>` for a utility, the last segment otherwise
 */
export function routeSlugFor(projectRoot: string): string {
  const parts = projectRoot.split(posix.sep).filter(Boolean)
  const last = parts[parts.length - 1] as string
  return isUtilsRoot(projectRoot) ? `utils/${last}` : last
}

/**
 * Title-case a hyphenated name.
 *
 * @param libName - Package name without its scope
 * @returns The words capitalised and separated by spaces
 */
export function displayNameFor(libName: string): string {
  return libName
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

/**
 * The docs-site section a project belongs in when none is chosen: a package
 * under `libs/utils` is a utility, a project tagged `type:core` is core, and
 * anything else is supporting.
 *
 * @param projectRoot - Workspace-relative project root
 * @param tags - The project's Nx tags
 * @returns The section
 */
export function defaultDocsCategory(projectRoot: string, tags: readonly string[]): DocsCategory {
  if (isUtilsRoot(projectRoot)) return 'utils'
  return tags.includes('type:core') ? 'core' : 'supporting'
}

/**
 * The level of the ecosystem hierarchy a package lands on when none is chosen.
 *
 * @param docsCategory - Section of the docs-site index
 * @returns The utilities level for a utility, the standalone level otherwise
 */
export function defaultEcosystemTier(docsCategory: DocsCategory): EcosystemTierId {
  return docsCategory === 'utils' ? 'utilities' : 'standalone'
}

/**
 * The subpaths of a package's secondary entries, sorted.
 *
 * @param exports - The package's exports map
 * @returns Every `./x` key as `x`, leaving out the main entry, the manifest and patterns
 */
export function secondaryEntriesOf(exports: Record<string, unknown>): string[] {
  return keys(exports)
    .filter((key) => key.startsWith('./') && key !== './package.json' && !key.includes('*'))
    .map((key) => key.slice(2))
    .sort()
}

/**
 * The target a conditional export resolves to for documentation purposes.
 *
 * @param target - The export entry
 * @returns The target when it is a path or a conditions map naming one, null otherwise
 */
function exportPath(target: unknown): string | null {
  if (typeof target === 'string') return target
  if (typeof target !== 'object' || target === null) return null
  const conditions = target as Record<string, unknown>
  const chosen = conditions['import'] ?? conditions['default'] ?? conditions['require']
  return typeof chosen === 'string' ? chosen : null
}

/**
 * The TypeScript source files behind a package's exports, main entry first.
 *
 * @param projectRoot - Workspace-relative project root
 * @param exports - The package's exports map
 * @returns Workspace-relative `.ts` paths, each once
 */
export function entryPointsOf(projectRoot: string, exports: Record<string, unknown>): string[] {
  const found: string[] = []
  for (const key of keys(exports)) {
    if (key.includes('*')) continue
    const target = exportPath(exports[key])
    if (target === null || target.endsWith('.json')) continue
    const stripped = target.startsWith('./') ? target.slice(2) : target
    const source = stripped.endsWith('.js') ? `${stripped.slice(0, -3)}.ts` : posix.join(stripped, 'index.ts')
    const entry = posix.join(projectRoot, source)
    if (!found.includes(entry)) found.push(entry)
  }
  return found
}

/**
 * Derive every name and path a package is registered under from what its
 * project declares.
 *
 * @param input - What was read from the project
 * @returns The facts every registration is written from
 *
 * @example
 * ```typescript
 * const facts = deriveLibraryFacts({
 *   projectName: 'lib-json-utils',
 *   projectRoot: 'libs/utils/json',
 *   packageName: '@hyperfrontend/json-utils',
 *   description: 'JSON Schema validation.',
 *   tags: ['type:util', 'scope:public'],
 *   exports: { '.': './src/index.js', './package.json': './package.json' },
 *   hasArchitecture: false,
 * })
 * facts.coverageFlag // 'json-utils'
 * facts.routeSlug // 'utils/json'
 * ```
 */
export function deriveLibraryFacts(input: LibraryFactsInput): LibraryFacts {
  const slash = input.packageName.indexOf('/')
  const libName = slash === -1 ? input.packageName : input.packageName.slice(slash + 1)
  const parts = input.projectRoot.split(posix.sep).filter(Boolean)
  return {
    projectName: input.projectName,
    projectRoot: input.projectRoot,
    packageName: input.packageName,
    libName,
    description: input.description,
    coverageFlag: locationName(input.projectRoot),
    routeSlug: routeSlugFor(input.projectRoot),
    manifestSlug: locationName(input.projectRoot),
    pageSlug: parts[parts.length - 1] as string,
    displayName: displayNameFor(libName),
    docsCategory: input.docsCategory ?? defaultDocsCategory(input.projectRoot, input.tags),
    secondaryEntries: secondaryEntriesOf(input.exports),
    entryPoints: entryPointsOf(input.projectRoot, input.exports),
    hasArchitecture: input.hasArchitecture,
  }
}
