import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** The workspace root, which every path below is read against. */
export const WORKSPACE_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..')

/** The scope every package here is published under. */
export const SCOPE = '@hyperfrontend/'

/** The fields of a package manifest the scenes read. */
export interface Manifest {
  /** The registry name. */
  name: string
  /** The one-line description. */
  description?: string
  /** Whether the package is withheld from the registry. */
  private?: boolean
  /** The runtimes the package declares floors for. */
  engines?: Record<string, string>
}

/** The compatibility a project declares. */
export interface ProjectCompatibility {
  /** Support level by runtime, such as `full`, `partial` or `none`. */
  environments?: Record<string, string>
}

/** The metadata block of a project configuration. */
export interface ProjectMetadata {
  /** The runtimes the package supports. */
  compatibility?: ProjectCompatibility
}

/** The fields of a project configuration the scenes read. */
export interface ProjectConfig {
  /** Facts about the project that are not targets. */
  metadata?: ProjectMetadata
}

/** One publishable library, with the files the scenes draw facts from. */
export interface Library {
  /** Absolute path of the library's directory. */
  dir: string
  /** The package manifest. */
  manifest: Manifest
  /** The project configuration. */
  project: ProjectConfig
  /** The package's name without its scope, which names its scenes. */
  shortName: string
}

/**
 * Every publishable library in the workspace, in a stable order.
 *
 * Read from the workspace rather than listed by hand, so a package added to
 * `libs/` gets its banner and its compatibility strip on the next recording
 * without anyone remembering to add it here.
 *
 * @returns The libraries, sorted by directory.
 */
export function publishableLibraries(): readonly Library[] {
  const libs = join(WORKSPACE_ROOT, 'libs')
  const dirs: string[] = []
  for (const entry of readdirSync(libs, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) {
      continue
    }
    const dir = join(libs, entry.name)
    if (entry.name === 'utils') {
      for (const inner of readdirSync(dir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
        if (inner.isDirectory()) {
          dirs.push(join(dir, inner.name))
        }
      }
      continue
    }
    dirs.push(dir)
  }
  return dirs
    .map((dir) => {
      const manifest = parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest
      const project = parse(readFileSync(join(dir, 'project.json'), 'utf8')) as ProjectConfig
      const shortName = manifest.name.startsWith(SCOPE) ? manifest.name.slice(SCOPE.length) : manifest.name
      return { dir, manifest, project, shortName }
    })
    .filter((library) => library.manifest.private !== true)
}
