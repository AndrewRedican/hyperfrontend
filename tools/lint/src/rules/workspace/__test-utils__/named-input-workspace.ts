/**
 * A disposable workspace for the named input coverage rule: a project whose sources sit beside
 * the directories, in a partly read directory with a spec, a document, a test helper and an asset,
 * in a nested directory and in a directory named as build output is; a project that keeps a
 * manifest, a compiler configuration and documents in one directory of its sources, beside a
 * test setup module; a project whose directory name a glob reads as a character class; and a
 * project that has no sources at all.
 *
 * @module rules/workspace/__test-utils__/named-input-workspace
 */

import { createTempDir } from '@hyperfrontend/testing/fs'

/** The files of the workspace, by path below its root. */
const FILES: Readonly<Record<string, string>> = {
  'libs/tool/src/index.ts': "export { write } from './emit/write.ts'\n",
  'libs/tool/src/emit/README.md': '# emit\n',
  'libs/tool/src/emit/__test-utils__/tree.ts': 'export const TREE = {}\n',
  'libs/tool/src/emit/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>\n',
  'libs/tool/src/emit/out/bundle.ts': 'export const bundle = (): void => undefined\n',
  'libs/tool/src/emit/skip.ts': 'export const skip = (): void => undefined\n',
  'libs/tool/src/emit/write.spec.ts': 'export {}\n',
  'libs/tool/src/emit/write.ts': 'export const write = (): void => undefined\n',
  'libs/tool/src/watch/deep/loop.ts': 'export const loop = (): void => undefined\n',
  'libs/tool/src/watch/poll.ts': 'export const poll = (): void => undefined\n',
  'libs/kit/src/index.ts': 'export const kit = (): void => undefined\n',
  'libs/kit/src/templates/NOTES.md': '# notes\n',
  'libs/kit/src/templates/README.md': '# templates\n',
  'libs/kit/src/templates/package.json': '{ "name": "template" }\n',
  'libs/kit/src/templates/tsconfig.emit.json': '{ "compilerOptions": {} }\n',
  'libs/kit/src/test-setup.ts': 'export {}\n',
  'libs/[beta]/src/index.ts': 'export const beta = (): void => undefined\n',
  'libs/bare/package.json': '{ "name": "bare" }\n',
}

/** The paths the specs lint as. */
export interface NamedInputWorkspace {
  /** The workspace root. */
  readonly root: string
  /** A file of the workspace, whether or not it exists. */
  readonly file: (path: string) => string
  /** Removes the workspace. */
  readonly remove: () => void
}

/**
 * Writes the workspace to a temporary directory.
 *
 * @returns Its paths
 *
 * @example Linting a text as the workspace's own `hf.json`
 * ```typescript
 * const workspace = createNamedInputWorkspace()
 * workspace.file('hf.json') // => '<temporary directory>/hf.json'
 * workspace.remove()
 * ```
 */
export function createNamedInputWorkspace(): NamedInputWorkspace {
  const directory = createTempDir({ prefix: 'lint-named-input-', tree: FILES })
  return {
    root: directory.path,
    file: (path) => directory.resolve(path),
    remove: directory.remove,
  }
}
