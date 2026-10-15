import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** The package every project's suites run on. */
export const TESTING_PACKAGE = '@hyperfrontend/testing'

/** The file the workspace maps package names to source files in. */
const ALIAS_FILE = 'tsconfig.base.json'

/**
 * The entries of the test runtime a Node process is handed by path.
 */
export type TestingEntry = 'hooks' | 'dom'

/**
 * The compiler options the lookup reads.
 */
interface AliasCompilerOptions {
  /** Package names mapped to the source files that serve them. */
  paths?: Record<string, string[]>
}

/**
 * The slice of a tsconfig the lookup reads.
 */
interface AliasConfig {
  /** Compiler options, of which only the path aliases matter here. */
  compilerOptions?: AliasCompilerOptions
}

/**
 * Reads the workspace path aliases.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @returns Every alias the workspace declares.
 */
function readAliases(workspaceRoot: string): Record<string, string[]> {
  const config = parse(readFileSync(join(workspaceRoot, ALIAS_FILE), 'utf-8')) as AliasConfig
  return config.compilerOptions?.paths ?? {}
}

/**
 * Finds the source file the workspace serves one entry of the test runtime from.
 *
 * The runtime is a workspace library, consumed from source like every other, and the
 * aliases are the one place the workspace says where that source is. Reading them here
 * keeps the executors indifferent to where the library lives: moving it updates the
 * aliases, and nothing else has to know.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @param entry - The entry wanted.
 * @returns The absolute path of the entry's source file.
 * @throws {Error} When the workspace declares no alias for the entry.
 */
export function resolveTestingEntry(workspaceRoot: string, entry: TestingEntry): string {
  const alias = `${TESTING_PACKAGE}/${entry}`
  const target = readAliases(workspaceRoot)[alias]?.[0]
  if (target === undefined) {
    throw createError(`${ALIAS_FILE} maps no source file to ${alias}; the test runtime cannot be located`)
  }
  return join(workspaceRoot, target)
}

/**
 * Every alias of the test runtime, as the workspace declares them.
 *
 * A run that replaces the workspace aliases outright, so a packed tarball resolves from a
 * test project's `node_modules`, still has to reach the runtime by name.
 *
 * @param workspaceRoot - Absolute path to the workspace root.
 * @returns The runtime's aliases, and nothing else.
 */
export function testingAliases(workspaceRoot: string): Record<string, string[]> {
  const kept: Record<string, string[]> = {}
  for (const [alias, targets] of entries(readAliases(workspaceRoot))) {
    if (alias === TESTING_PACKAGE || alias.startsWith(`${TESTING_PACKAGE}/`)) kept[alias] = targets
  }
  return kept
}
