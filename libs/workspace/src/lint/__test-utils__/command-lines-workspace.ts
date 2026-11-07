/**
 * Disposable projects for the command-lines rule, one per kind of project the default
 * selection treats differently: a publishable library in a workspace, a library that is not
 * published, and an application under `tools/` in a workspace.
 *
 * @module lint/__test-utils__/command-lines-workspace
 */

import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The project file of a publishable library. */
const PUBLISHABLE = stringify({ projectType: 'library', targets: { build: {}, publish: {} } })

/** The files of the fixture, by path below its root. */
const FILES: Readonly<Record<string, string>> = {
  'node/hf.json': '{}',
  'node/project.json': PUBLISHABLE,
  'node/src/runtime.ts': "import { join } from 'node:path'\n",
  'unpublished/project.json': stringify({ projectType: 'library', targets: { build: {} } }),
  'unpublished/src/runtime.ts': 'export {}\n',
  'tool/hf.json': '{}',
  'tool/tools/app/project.json': stringify({ projectType: 'application', targets: { build: {}, serve: {} } }),
  'tool/tools/app/src/runtime.ts': 'export {}\n',
}

/** The roots of the fixture's projects. */
export interface CommandLinesWorkspace {
  /** The directory holding them all. */
  readonly root: string
  /** The publishable library in a workspace. */
  readonly node: string
  /** The library that is not published, with no workspace root above it. */
  readonly unpublished: string
  /** The workspace whose application sits at `tools/app`. */
  readonly tool: string
}

/**
 * Creates the projects in a temporary directory.
 *
 * @returns Their roots
 */
export function createCommandLinesWorkspace(): CommandLinesWorkspace {
  const root = createTempDir({ prefix: 'lint-command-lines-', tree: FILES }).path
  return { root, node: join(root, 'node'), unpublished: join(root, 'unpublished'), tool: join(root, 'tool') }
}
