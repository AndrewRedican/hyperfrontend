import type { TSESTree } from '@typescript-eslint/utils'
import { join } from 'node:path'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { isDirectory, readDirectory, readFileIfExists } from '../../utils/fs'

/**
 * Directory names that never hold the project's own runtime sources.
 */
const SKIPPED_DIRECTORIES: readonly string[] = ['node_modules', '__fixtures__']

/**
 * Whether each project root's sources import a `node:` module, computed once per process.
 */
const nodeCapableByRoot = createMap<string, boolean>()

/**
 * Tests whether a file is runtime source rather than a test or test setup.
 *
 * @param name - The file name.
 * @returns True for `.ts` sources that ship.
 */
function isRuntimeSource(name: string): boolean {
  return name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.endsWith('.d.ts') && name !== 'test.setup.ts'
}

/**
 * Searches a directory tree for a runtime source that imports a `node:` module.
 *
 * @param dir - The directory to search.
 * @returns True when any runtime source under it imports from `node:`.
 */
function containsNodeImport(dir: string): boolean {
  for (const name of readDirectory(dir)) {
    const path = join(dir, name)
    if (isDirectory(path)) {
      if (!SKIPPED_DIRECTORIES.includes(name) && containsNodeImport(path)) return true
    } else if (isRuntimeSource(name) && readFileIfExists(path)?.includes("from 'node:")) {
      return true
    }
  }
  return false
}

/**
 * Tests whether a project runs on Node: some runtime source under its `src/` imports a
 * `node:` module. Only such projects get name-based (tier 2) path findings.
 *
 * @param projectRoot - Absolute project root.
 * @returns True when the project's sources import from `node:`.
 */
export function isNodeCapableProject(projectRoot: string): boolean {
  const cached = nodeCapableByRoot.get(projectRoot)
  if (cached !== undefined) return cached
  const capable = containsNodeImport(join(projectRoot, 'src'))
  nodeCapableByRoot.set(projectRoot, capable)
  return capable
}

/**
 * Tests whether a file imports any `node:` module.
 *
 * @param program - The file's AST.
 * @returns True when an import declaration names a `node:` specifier.
 */
export function importsNodeModule(program: TSESTree.Program): boolean {
  return program.body.some((statement) => statement.type === AST_NODE_TYPES.ImportDeclaration && statement.source.value.startsWith('node:'))
}
