import type { Rule } from 'eslint'
import type { PackageJson, ProjectJson } from '../utils'
import { basename, dirname, join } from 'node:path'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import {
  exists,
  findNxWorkspaceRoot,
  isDirectory,
  isPublishableProjectJson,
  readDirectory,
  readPackageJson,
  readProjectJson,
} from '../utils'

/**
 * Rule identifier for the lib-compatibility-matrix rule.
 */
export const RULE_NAME = 'lib-compatibility-matrix'

/**
 * Name of the document this rule generates.
 */
const DOCUMENT_NAME = 'LIBRARY_COMPATIBILITY.md'

/**
 * Folders scanned for publishable libraries.
 */
const LIBRARY_FOLDERS = ['libs', 'plugins']

/**
 * Directory names the scan never descends into.
 */
const SKIPPED_DIRECTORIES = ['node_modules', 'dist']

/**
 * Scope prefix that marks a dependency as first-party.
 */
const FIRST_PARTY_SCOPE = '@hyperfrontend/'

/**
 * Placeholder for a table cell with no value to show.
 */
const EMPTY_CELL = '-'

/**
 * Support a package declares for one runtime environment.
 */
export type SupportLevel = 'full' | 'partial' | 'none'

/**
 * Glyphs the tables use: one per declared support level, plus the marker for an
 * environment a package declares nothing about. A shipped output format reuses
 * the `full` glyph and a missing one reuses `none`.
 */
const GLYPH = {
  full: '✅',
  partial: '⚠️',
  none: '❌',
  unknown: '❓',
}

/**
 * Environment support declared under `metadata.compatibility` in project.json.
 */
interface CompatibilityEnvironments {
  /** Declared support for Node.js. */
  node?: unknown
  /** Declared support for the browser. */
  browser?: unknown
  /** Declared support for a Web Worker. */
  webWorker?: unknown
}

/**
 * The `metadata.compatibility` block of project.json.
 */
interface CompatibilityMetadata {
  /** Declared support per runtime environment. */
  environments?: CompatibilityEnvironments
  /** Caveat rendered under the platform table. */
  note?: string
}

/**
 * The `metadata` block of project.json, restricted to what this rule reads.
 */
interface ProjectMetadata {
  /** Compatibility declaration for the package. */
  compatibility?: CompatibilityMetadata
}

/**
 * Configuration for one browser bundle (IIFE or UMD).
 */
interface BundleFormatConfig {
  /** Entry point the bundle is built from. */
  entry?: string
  /** Global variable the bundle assigns itself to. */
  globalName?: string
}

/**
 * Build options of project.json, restricted to the output formats this rule reads.
 */
interface MatrixBuildOptions {
  /** ESM output configuration. */
  esm?: unknown
  /** CommonJS output configuration. */
  cjs?: unknown
  /** IIFE output configuration: one bundle or several. */
  iife?: BundleFormatConfig | BundleFormatConfig[]
  /** UMD output configuration: one bundle or several. */
  umd?: BundleFormatConfig | BundleFormatConfig[]
  [key: string]: unknown
}

/**
 * Build target of project.json, restricted to its options.
 */
interface MatrixBuildTarget {
  /** Options passed to the build executor. */
  options?: MatrixBuildOptions
  [key: string]: unknown
}

/**
 * The `targets` map of project.json, restricted to the `build` entry.
 */
interface MatrixTargets {
  /** Build target. */
  build?: MatrixBuildTarget
  [key: string]: unknown
}

/**
 * project.json fields the matrix is derived from.
 */
interface MatrixProjectJson extends ProjectJson {
  /** Nx project metadata carrying the compatibility declaration. */
  metadata?: ProjectMetadata
  /** Build targets. */
  targets?: MatrixTargets
}

/**
 * The npm `engines` block.
 */
interface PackageEngines {
  /** Supported Node.js range. */
  node?: string
  /** Supported npm range. */
  npm?: string
}

/**
 * package.json fields the matrix is derived from.
 */
interface MatrixPackageJson extends PackageJson {
  /** Runtime version ranges the package supports. */
  engines?: PackageEngines
  /** Runtime dependencies. */
  dependencies?: Record<string, string>
  /** Peer dependencies. */
  peerDependencies?: Record<string, string>
}

/**
 * A first-party dependency edge drawn in the dependency section.
 */
export interface MatrixDependency {
  /** Name of the package depended on. */
  packageName: string
  /** Whether the dependency is declared as a peer dependency. */
  peer: boolean
}

/**
 * Declared support for each runtime environment, null where nothing is declared.
 */
export interface MatrixEnvironments {
  /** Node.js support. */
  node: SupportLevel | null
  /** Browser support. */
  browser: SupportLevel | null
  /** Web Worker support. */
  webWorker: SupportLevel | null
}

/**
 * Output formats a package's build target produces.
 */
export interface MatrixFormats {
  /** Ships an ESM build. */
  esm: boolean
  /** Ships a CommonJS build. */
  cjs: boolean
  /** Ships an IIFE bundle. */
  iife: boolean
  /** Ships a UMD bundle. */
  umd: boolean
}

/**
 * Everything the generated document states about one publishable library.
 */
export interface MatrixLibrary {
  /** Published package name. */
  packageName: string
  /** Package name without its scope, used for diagram labels. */
  shortName: string
  /** Published version, null when package.json declares none. */
  version: string | null
  /** Supported Node.js range, null when package.json declares none. */
  nodeEngine: string | null
  /** Supported npm range, null when package.json declares none. */
  npmEngine: string | null
  /** Declared runtime support. */
  environments: MatrixEnvironments
  /** Caveat to render under the platform table, null when there is none. */
  note: string | null
  /** Output formats produced by the build target. */
  formats: MatrixFormats
  /** Global names the browser bundles assign themselves to. */
  globalNames: string[]
  /** First-party dependencies, sorted by package name. */
  dependencies: MatrixDependency[]
}

/**
 * Compares two package names by code point so table order never depends on the
 * host locale.
 *
 * @param left - First package name.
 * @param right - Second package name.
 * @returns A negative number, zero or a positive number for sorting.
 */
function comparePackageNames(left: string, right: string): number {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

/**
 * Strips the scope from a package name.
 *
 * @param packageName - The scoped package name.
 * @returns The part after the scope.
 */
function shortNameOf(packageName: string): string {
  return packageName.slice(packageName.lastIndexOf('/') + 1)
}

/**
 * Narrows an unknown project.json value to a declared support level.
 *
 * @param value - The raw value read from `metadata.compatibility.environments`.
 * @returns The support level, or null when the value declares nothing usable.
 */
function toSupportLevel(value: unknown): SupportLevel | null {
  if (value === 'full' || value === 'partial' || value === 'none') {
    return value
  }
  return null
}

/**
 * Normalises a bundle format option that may hold one configuration or several.
 *
 * @param value - The `iife` or `umd` value from the build options.
 * @returns The configurations, in declaration order.
 */
function toBundleConfigs(value: BundleFormatConfig | BundleFormatConfig[] | undefined): BundleFormatConfig[] {
  if (value === undefined) {
    return []
  }
  return isArray(value) ? value : [value]
}

/**
 * Collects the global variable names the browser bundles assign themselves to,
 * keeping the first occurrence of each.
 *
 * @param options - Build options of the package.
 * @returns The global names, in declaration order.
 */
function collectGlobalNames(options: MatrixBuildOptions): string[] {
  const globalNames: string[] = []

  for (const config of [...toBundleConfigs(options.iife), ...toBundleConfigs(options.umd)]) {
    const globalName = config.globalName
    if (typeof globalName === 'string' && globalName.length > 0 && !globalNames.includes(globalName)) {
      globalNames.push(globalName)
    }
  }

  return globalNames
}

/**
 * Collects the first-party dependencies of a package, peer dependencies included.
 *
 * @param packageJson - The package.json of the library.
 * @returns The dependencies, sorted by package name.
 */
function collectDependencies(packageJson: MatrixPackageJson): MatrixDependency[] {
  const dependencies: MatrixDependency[] = []

  for (const name of keys(packageJson.dependencies ?? {})) {
    if (name.startsWith(FIRST_PARTY_SCOPE)) {
      dependencies.push({ packageName: name, peer: false })
    }
  }

  for (const name of keys(packageJson.peerDependencies ?? {})) {
    if (name.startsWith(FIRST_PARTY_SCOPE)) {
      dependencies.push({ packageName: name, peer: true })
    }
  }

  dependencies.sort((left, right) => comparePackageNames(left.packageName, right.packageName))

  return dependencies
}

/**
 * Reads a string field, treating anything else as absent.
 *
 * @param value - The raw value read from package.json.
 * @returns The string, or null when the field is absent or not a string.
 */
function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Reads one directory into its matrix row.
 *
 * @param projectDir - Absolute path of the candidate library directory.
 * @returns The row, or null when the directory is not a publishable library with a package name.
 */
function readMatrixLibrary(projectDir: string): MatrixLibrary | null {
  const projectJson = readProjectJson(projectDir) as MatrixProjectJson | null

  if (!projectJson || !isPublishableProjectJson(projectJson)) {
    return null
  }

  const packageJson = readPackageJson(projectDir) as MatrixPackageJson | null
  const packageName = toOptionalString(packageJson?.name)

  if (!packageJson || !packageName) {
    return null
  }

  const compatibility = projectJson.metadata?.compatibility
  const environments = compatibility?.environments
  const options = projectJson.targets?.build?.options ?? {}

  return {
    packageName,
    shortName: shortNameOf(packageName),
    version: toOptionalString(packageJson.version),
    nodeEngine: toOptionalString(packageJson.engines?.node),
    npmEngine: toOptionalString(packageJson.engines?.npm),
    environments: {
      node: toSupportLevel(environments?.node),
      browser: toSupportLevel(environments?.browser),
      webWorker: toSupportLevel(environments?.webWorker),
    },
    note: toOptionalString(compatibility?.note),
    formats: {
      esm: options.esm !== undefined,
      cjs: options.cjs !== undefined,
      iife: options.iife !== undefined,
      umd: options.umd !== undefined,
    },
    globalNames: collectGlobalNames(options),
    dependencies: collectDependencies(packageJson),
  }
}

/**
 * Walks a directory tree, collecting every publishable library it holds.
 *
 * @param baseDir - Absolute path to walk.
 * @param results - Accumulator the rows are pushed onto.
 */
function collectFromDirectory(baseDir: string, results: MatrixLibrary[]): void {
  if (!exists(baseDir)) {
    return
  }

  const library = readMatrixLibrary(baseDir)

  if (library) {
    results.push(library)
  }

  for (const entry of readDirectory(baseDir)) {
    if (entry.startsWith('.') || SKIPPED_DIRECTORIES.includes(entry)) {
      continue
    }

    const entryPath = join(baseDir, entry)

    if (isDirectory(entryPath)) {
      collectFromDirectory(entryPath, results)
    }
  }
}

/**
 * Collects every publishable library the matrix documents.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @returns The rows, sorted by package name.
 */
export function collectMatrixLibraries(workspaceRoot: string): MatrixLibrary[] {
  const libraries: MatrixLibrary[] = []

  for (const folder of LIBRARY_FOLDERS) {
    collectFromDirectory(join(workspaceRoot, folder), libraries)
  }

  libraries.sort((left, right) => comparePackageNames(left.packageName, right.packageName))

  return libraries
}

/**
 * Escapes the characters that would break a markdown table cell: the pipe that
 * splits a cell in two, and the backslash that would otherwise swallow the
 * escape placed before that pipe.
 *
 * @param value - The cell text.
 * @returns The cell text, safe to place between pipes.
 */
function escapeCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

/**
 * Wraps a value in backticks so markdown renders it as code.
 *
 * @param value - The value to wrap.
 * @returns The value between backticks.
 */
function code(value: string): string {
  return `\`${value}\``
}

/**
 * Renders a GitHub-flavoured markdown table with unpadded cells.
 *
 * @param headers - Column headings.
 * @param rows - Cell values, one array per row.
 * @returns The table as markdown.
 */
function renderTable(headers: string[], rows: string[][]): string {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`]

  for (const row of rows) {
    lines.push(`| ${row.map(escapeCell).join(' | ')} |`)
  }

  return lines.join('\n')
}

/**
 * Renders the glyph for a declared support level.
 *
 * @param level - The declared level, or null when nothing is declared.
 * @returns The glyph for the platform table.
 */
function supportGlyph(level: SupportLevel | null): string {
  return level === null ? GLYPH.unknown : GLYPH[level]
}

/**
 * Renders the glyph for a format the package either ships or does not.
 *
 * @param present - Whether the format is configured.
 * @returns The glyph for the output format table.
 */
function presenceGlyph(present: boolean): string {
  return present ? GLYPH.full : GLYPH.none
}

/**
 * Renders the platform support section: the environment table, the glyph
 * legend, and the per-package caveats.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderPlatformSection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [
    code(library.packageName),
    supportGlyph(library.environments.node),
    supportGlyph(library.environments.browser),
    supportGlyph(library.environments.webWorker),
    presenceGlyph(library.formats.iife || library.formats.umd),
  ])

  const legend = [
    `Legend: ${GLYPH.full} full support, ${GLYPH.partial} partial support, ${GLYPH.none} no support,`,
    `${GLYPH.unknown} nothing declared. CDN Bundle marks the packages whose build produces an IIFE or UMD bundle.`,
  ].join(' ')

  const parts = ['## Platform Support', renderTable(['Library', 'Node.js', 'Browser', 'Web Worker', 'CDN Bundle'], rows), legend]
  const notes: string[] = []

  for (const library of libraries) {
    if (library.note !== null) {
      notes.push(`- ${code(library.packageName)}: ${library.note}`)
    }
  }

  if (notes.length > 0) {
    parts.push('**Notes**')
    parts.push(notes.join('\n'))
  }

  return parts.join('\n\n')
}

/**
 * Renders the output format section: which builds each package ships and the
 * global names its browser bundles claim.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderOutputFormatsSection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [
    code(library.packageName),
    presenceGlyph(library.formats.esm),
    presenceGlyph(library.formats.cjs),
    presenceGlyph(library.formats.iife),
    presenceGlyph(library.formats.umd),
    library.globalNames.length > 0 ? library.globalNames.map(code).join(', ') : EMPTY_CELL,
  ])

  return ['## Output Formats', renderTable(['Library', 'ESM', 'CJS', 'IIFE', 'UMD', 'Global name'], rows)].join('\n\n')
}

/**
 * Renders the engine requirement section from each package's `engines` block.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderEngineSection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [
    code(library.packageName),
    library.nodeEngine === null ? EMPTY_CELL : code(library.nodeEngine),
    library.npmEngine === null ? EMPTY_CELL : code(library.npmEngine),
  ])

  return ['## Engine Requirements', renderTable(['Library', 'Node.js', 'npm'], rows)].join('\n\n')
}

/**
 * Turns a package's short name into an identifier Mermaid parses unambiguously.
 *
 * @param shortName - Package name without its scope.
 * @returns The node identifier.
 */
function mermaidId(shortName: string): string {
  return shortName.replace(/[^a-zA-Z0-9]/g, '_')
}

/**
 * Renders the Mermaid flowchart of first-party dependency edges.
 *
 * @param libraries - The rows to draw.
 * @returns The fenced Mermaid block.
 */
function renderDependencyDiagram(libraries: MatrixLibrary[]): string {
  const documented = createSet(libraries.map((library) => library.packageName))
  const lines = ['flowchart TB']

  for (const library of libraries) {
    lines.push(`    ${mermaidId(library.shortName)}["${library.shortName}"]`)
  }

  for (const library of libraries) {
    for (const dependency of library.dependencies) {
      if (!documented.has(dependency.packageName)) {
        continue
      }

      const arrow = dependency.peer ? '-.->' : '-->'
      lines.push(`    ${mermaidId(library.shortName)} ${arrow} ${mermaidId(shortNameOf(dependency.packageName))}`)
    }
  }

  return ['```mermaid', '---', 'config:', '  theme: base', '  themeVariables:', '    fontSize: 12px', '---', ...lines, '```'].join('\n')
}

/**
 * Renders the dependency section: the table of first-party edges and the
 * diagram drawing the same edges.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderDependencySection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [
    code(library.packageName),
    library.dependencies.length > 0
      ? library.dependencies.map((dependency) => `${code(dependency.packageName)}${dependency.peer ? ' (peer)' : ''}`).join(', ')
      : EMPTY_CELL,
  ])

  return [
    '## Dependency Graph',
    renderTable(['Library', 'Depends on'], rows),
    'Solid edges are runtime dependencies; dotted edges are peer dependencies.',
    renderDependencyDiagram(libraries),
  ].join('\n\n')
}

/**
 * Renders the published version section from each package's `version` field.
 *
 * @param libraries - The rows to render.
 * @returns The section as markdown.
 */
function renderVersionSection(libraries: MatrixLibrary[]): string {
  const rows = libraries.map((library) => [code(library.packageName), library.version === null ? EMPTY_CELL : code(library.version)])

  return ['## Published Versions', renderTable(['Library', 'Version'], rows)].join('\n\n')
}

/**
 * Renders the whole document from already collected rows.
 *
 * @param libraries - The rows to render, sorted by package name.
 * @returns The document text, ending in exactly one newline.
 */
export function renderCompatibilityDocument(libraries: MatrixLibrary[]): string {
  const sections = [
    '# Library Compatibility Matrix',
    `> Generated from each package's ${code('project.json')} and ${code('package.json')}. Regenerate it with ${code('npx nx lint:all')} rather than editing it by hand.`,
    renderPlatformSection(libraries),
    renderOutputFormatsSection(libraries),
    renderEngineSection(libraries),
    renderDependencySection(libraries),
    renderVersionSection(libraries),
  ]

  return `${sections.join('\n\n')}\n`
}

/**
 * Derives the document the workspace should hold right now.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @returns The document text, ending in exactly one newline.
 */
export function buildCompatibilityDocument(workspaceRoot: string): string {
  return renderCompatibilityDocument(collectMatrixLibraries(workspaceRoot))
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Generate the root LIBRARY_COMPATIBILITY.md from each package project.json and package.json',
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    fixable: 'code',
    schema: [],
    messages: {
      staleMatrix:
        'LIBRARY_COMPATIBILITY.md is generated from each package project.json and package.json, and no longer matches them. Run `npx nx lint:all` (or `nx lint @hyperfrontend/workspace --fix`) to regenerate it.',
    },
  },

  create(context) {
    const filePath = context.filename

    if (basename(filePath) !== DOCUMENT_NAME) {
      return {}
    }

    const fileDir = dirname(filePath)
    const workspaceRoot = findNxWorkspaceRoot(fileDir)

    if (!workspaceRoot || fileDir !== workspaceRoot) {
      return {}
    }

    return {
      root(node: Rule.Node) {
        const content = context.sourceCode.getText()
        const expected = buildCompatibilityDocument(workspaceRoot)

        if (content === expected) {
          return
        }

        context.report({
          node,
          messageId: 'staleMatrix',
          fix(fixer) {
            return fixer.replaceTextRange([0, content.length], expected)
          },
        })
      },
    }
  },
}

export default rule
