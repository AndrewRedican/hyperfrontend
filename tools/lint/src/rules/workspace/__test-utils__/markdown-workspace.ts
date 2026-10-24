/**
 * A disposable workspace for the Markdown rule specs: a root, a publishable library with a
 * nested README, an internal library, an application and a documentation directory.
 *
 * @module rules/workspace/__test-utils__/markdown-workspace
 */

import { join } from 'node:path'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The paths the specs lint as. */
export interface MarkdownWorkspace {
  /** The workspace root. */
  readonly root: string
  /** A file directly in the root. */
  readonly rootFile: (name: string) => string
  /** A file in the publishable library's directory. */
  readonly libraryFile: (name: string) => string
  /** A file nested under the publishable library's sources. */
  readonly nestedFile: (name: string) => string
  /** A file in the internal library. */
  readonly internalFile: (name: string) => string
  /** A file in the application. */
  readonly appFile: (name: string) => string
  /** A file in the documentation directory. */
  readonly docsFile: (name: string) => string
  /** Adds a file, directories created as needed. */
  readonly write: (path: string, text: string) => void
  /** Removes the workspace. */
  readonly remove: () => void
}

const PUBLISHABLE = '{ "name": "lib-pub", "projectType": "library", "targets": { "build": {}, "publish": {} } }'
const INTERNAL = '{ "name": "lib-internal", "projectType": "library", "targets": { "build": {} } }'

/**
 * Creates the workspace in the temporary directory.
 *
 * @returns Its paths
 */
export function createMarkdownWorkspace(): MarkdownWorkspace {
  const directory = createTempDir({
    prefix: 'lint-md-',
    tree: {
      'nx.json': '{}',
      'libs/pub/project.json': PUBLISHABLE,
      'libs/pub/src/host/.keep': '',
      'libs/internal/project.json': INTERNAL,
      'apps/site/project.json': '{ "name": "site", "projectType": "application" }',
      'docs/.keep': '',
    },
  })
  const root = directory.path
  return {
    root,
    rootFile: (name) => join(root, name),
    libraryFile: (name) => join(root, 'libs', 'pub', name),
    nestedFile: (name) => join(root, 'libs', 'pub', 'src', 'host', name),
    internalFile: (name) => join(root, 'libs', 'internal', name),
    appFile: (name) => join(root, 'apps', 'site', name),
    docsFile: (name) => join(root, 'docs', name),
    write: (path, text) => {
      directory.write(path, text)
    },
    remove: directory.remove,
  }
}
