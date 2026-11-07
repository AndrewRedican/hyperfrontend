import { join, readFileIfExists, writeFileContent } from '@hyperfrontend/project-scope/core'
import { collectMatrixLibraries } from './collect'
import { renderCompatibilityDocument } from './render'

/**
 * Name of the generated document, at the workspace root.
 */
export const COMPATIBILITY_DOCUMENT_NAME = 'LIBRARY_COMPATIBILITY.md'

/**
 * Derives the document the workspace should hold right now.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @returns The document text, ending in exactly one newline.
 *
 * @example Checking a committed document against the packages
 * ```typescript
 * const stale = readFileSync('LIBRARY_COMPATIBILITY.md', 'utf-8') !== buildCompatibilityDocument(workspaceRoot)
 * ```
 */
export function buildCompatibilityDocument(workspaceRoot: string): string {
  return renderCompatibilityDocument(collectMatrixLibraries(workspaceRoot))
}

/**
 * Brings the committed document in line with what the packages declare,
 * writing it only when its content would change.
 *
 * Every step that edits a package manifest, a version bump above all, owes
 * the document this call before it commits, so the tree never holds a
 * document one bump behind its sources.
 *
 * @param workspaceRoot - Absolute path to the Nx workspace root.
 * @returns The document's workspace-relative path when it was written, or `null` when it was already current.
 *
 * @example Folding the document into a version commit
 * ```typescript
 * const refreshed = refreshCompatibilityDocument(workspaceRoot)
 * if (refreshed !== null) filesToCommit.push(refreshed)
 * ```
 */
export function refreshCompatibilityDocument(workspaceRoot: string): string | null {
  const path = join(workspaceRoot, COMPATIBILITY_DOCUMENT_NAME)
  const expected = buildCompatibilityDocument(workspaceRoot)
  if (readFileIfExists(path) === expected) {
    return null
  }
  writeFileContent(path, expected)
  return COMPATIBILITY_DOCUMENT_NAME
}
