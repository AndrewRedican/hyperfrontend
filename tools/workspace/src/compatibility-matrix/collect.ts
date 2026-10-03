import type {
  BundleFormatConfig,
  MatrixBuildOptions,
  MatrixDependency,
  MatrixLibrary,
  MatrixPackageJson,
  MatrixProjectJson,
  SupportLevel,
} from './models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists, isDirectory, join, readDirectory, readJsonFileIfExists } from '@hyperfrontend/project-scope/core'

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
 * Reports whether a project.json describes a publishable library: a library
 * project carrying both a build and a publish target.
 *
 * @param projectJson - The parsed project.json content.
 * @returns True for a publishable library.
 */
function isPublishableProject(projectJson: MatrixProjectJson): boolean {
  return projectJson.projectType === 'library' && projectJson.targets?.build !== undefined && projectJson.targets?.publish !== undefined
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
export function shortNameOf(packageName: string): string {
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
  const projectJson = readJsonFileIfExists<MatrixProjectJson>(join(projectDir, 'project.json'))

  if (!projectJson || !isPublishableProject(projectJson)) {
    return null
  }

  const packageJson = readJsonFileIfExists<MatrixPackageJson>(join(projectDir, 'package.json'))
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

  for (const { name: entry } of readDirectory(baseDir)) {
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
