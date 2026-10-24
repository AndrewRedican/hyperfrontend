import { after } from 'node:test'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The workspace's files, keyed by path relative to its root. */
const FILES: Readonly<Record<string, string>> = {
  'alpha/project.json': '{\n  "name": "alpha"\n}\n',
  'alpha/src/index.ts': 'export {}\n',
  'beta/project.json': '{\n  "name": "beta"\n}\n',
  'beta/src/index.ts': 'export {}\n',
  'nested/package.json': '{\n  "name": "nested-pkg"\n}\n',
  'nested/src/index.ts': 'export {}\n',
}

/**
 * Writes a throwaway workspace for scope discovery: projects `alpha` and `beta`, named by
 * their `project.json`, and `nested`, named only by its `package.json`.
 *
 * @returns Absolute path of the workspace root, symbolic links resolved, deleted when the calling spec file finishes
 *
 * @example Discovering the scope of a staged file
 * ```typescript
 * const root = writeScopeWorkspace()
 * discoverScopes(['alpha/src/index.ts'], { cwd: root }) // [{ name: 'alpha', path: join(root, 'alpha') }]
 * ```
 */
export function writeScopeWorkspace(): string {
  const dir = createTempDir({ prefix: 'scope-discovery-', tree: FILES })
  after(() => dir.remove())
  return dir.path
}
