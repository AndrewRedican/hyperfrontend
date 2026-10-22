/**
 * The `project.json` of a directory, read once per process, and the facts the manifest rules
 * take from it: whether the project is a publishable library, and its declared name.
 *
 * @module rules/workspace/shared/project-file
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/** The fields of `project.json` the rules read. */
export interface ProjectFile {
  /** The Nx project name. */
  readonly name?: unknown
  /** `library` or `application`. */
  readonly projectType?: unknown
  /** The targets by name. */
  readonly targets?: Readonly<Record<string, unknown>>
  /** Free-form metadata: compatibility, deploy, lifecycle. */
  readonly metadata?: Readonly<Record<string, unknown>>
}

/** The fields of `package.json` the rules read from disk. */
export interface PackageFile {
  /** The package name. */
  readonly name?: unknown
  /** The engines the package declares. */
  readonly engines?: Readonly<Record<string, unknown>>
  /** The exports map. */
  readonly exports?: unknown
  /** The description. */
  readonly description?: unknown
}

const files = createMap<string, ProjectFile | null>()
const manifests = createMap<string, PackageFile | null>()

/**
 * Reads a JSON file as an object.
 *
 * @param path - The absolute path
 * @returns The parsed object, or null when the file is missing or holds no object
 */
function readObject(path: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = parse(readFileSync(path, 'utf8'))
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Reads a directory's `project.json`.
 *
 * @param directory - The absolute directory
 * @returns The parsed file, or null when there is none or it is not an object
 */
export function readProjectFile(directory: string): ProjectFile | null {
  const known = files.get(directory)
  if (known !== undefined) return known
  const project = readObject(join(directory, 'project.json')) as ProjectFile | null
  files.set(directory, project)
  return project
}

/**
 * Reads a directory's `package.json`.
 *
 * @param directory - The absolute directory
 * @returns The parsed manifest, or null when there is none or it is not an object
 */
export function readPackageFile(directory: string): PackageFile | null {
  const known = manifests.get(directory)
  if (known !== undefined) return known
  const manifest = readObject(join(directory, 'package.json')) as PackageFile | null
  manifests.set(directory, manifest)
  return manifest
}

/**
 * Whether a project file describes a publishable library: a library with `build` and `publish`
 * targets.
 *
 * @param project - The parsed file
 * @returns True for a publishable library
 */
export function isPublishableProject(project: ProjectFile | null): boolean {
  return (
    project !== null &&
    project.projectType === 'library' &&
    project.targets?.['build'] !== undefined &&
    project.targets['publish'] !== undefined
  )
}

/**
 * Whether a directory holds a publishable library.
 *
 * @param directory - The absolute directory that would hold `project.json`
 * @returns True when the project is a library with `build` and `publish` targets
 */
export function isPublishableLibrary(directory: string): boolean {
  return isPublishableProject(readProjectFile(directory))
}
