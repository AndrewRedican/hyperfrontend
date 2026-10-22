/**
 * The publishable libraries of the workspace, found by walking `libs/` and `plugins/`.
 *
 * @module rules/workspace/shared/libraries
 */

import { existsSync, readdirSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { isPublishableLibrary } from './project-file.ts'

/** A publishable library. */
export interface Library {
  /** Its absolute directory. */
  readonly directory: string
  /** Its workspace-relative path, with forward slashes. */
  readonly path: string
}

/** The folders libraries live under. */
const LIBRARY_FOLDERS = ['libs', 'plugins']

/**
 * The publishable libraries under a directory, in walk order.
 *
 * @param directory - Where to look
 * @param workspaceRoot - The root the paths are relative to
 * @param found - Where the libraries go
 */
function collect(directory: string, workspaceRoot: string, found: Library[]): void {
  if (isPublishableLibrary(directory)) found.push({ directory, path: relative(workspaceRoot, directory).split(sep).join(posix.sep) })
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.')) {
      collect(join(directory, entry.name), workspaceRoot, found)
    }
  }
}

/**
 * The publishable libraries of a workspace.
 *
 * @param workspaceRoot - The directory the paths are relative to
 * @returns The libraries under `libs/` then `plugins/`, each folder in walk order
 */
export function publishableLibraries(workspaceRoot: string): Library[] {
  const found: Library[] = []
  for (const folder of LIBRARY_FOLDERS) {
    const directory = join(workspaceRoot, folder)
    if (existsSync(directory)) collect(directory, workspaceRoot, found)
  }
  return found
}
