import { readFileSync } from 'node:fs'
import { relative, resolve, sep, posix } from 'node:path'
import { readDirectoryRecursive } from '@hyperfrontend/project-scope/core'
import { describe, expect, it } from '@hyperfrontend/testing'
import { importsOfText } from './imports'

/** Workspace packages the graph may import, by alias prefix; `@hyperfrontend/testing` is for specs alone. */
const ALLOWED_WORKSPACE_PREFIXES = ['@hyperfrontend/project-scope/', '@hyperfrontend/immutable-api-utils/', '@hyperfrontend/linter']

/** Specifiers the graph must never import: Nx itself and the Nx-facing adapters. */
const FORBIDDEN_PREFIXES = ['nx', '@nx/', '@hyperfrontend/integration-nx']

/** The modules exporting `createRequire`, whose loads the parser does not report as imports. */
const MODULE_BUILTINS = ['node:module', 'module']

/**
 * Whether a specifier is one the boundary allows for a file.
 *
 * @param specifier - The import specifier
 * @param spec - Whether the importing file is a spec
 * @returns True when the boundary allows it
 */
function allowed(specifier: string, spec: boolean): boolean {
  if (FORBIDDEN_PREFIXES.some((prefix) => specifier === prefix || specifier.startsWith(prefix))) return false
  if (specifier.startsWith('node:') || specifier.startsWith('.') || specifier === 'typescript') return true
  if (specifier === '@hyperfrontend/testing' || specifier.startsWith('@hyperfrontend/testing/')) return spec
  return ALLOWED_WORKSPACE_PREFIXES.some((prefix) => specifier.startsWith(prefix))
}

/**
 * The boundary violations of one file's text.
 *
 * @param text - The file's text
 * @param file - Its path under the graph, POSIX
 * @param spec - Whether the file is a spec or a test utility
 * @returns One line per violation
 */
function violationsOf(text: string, file: string, spec = false): string[] {
  const imports = importsOfText(text, file)
  if (imports === null) return [`${file}: does not parse`]
  const violations: string[] = []
  for (const load of imports) {
    if (load.kind === 'unresolved') continue
    if (!allowed(load.specifier, spec)) violations.push(`${file}: ${load.specifier}`)
    if (MODULE_BUILTINS.includes(load.specifier) && (load.names.includes('createRequire') || load.names.includes('*'))) {
      violations.push(`${file}: createRequire`)
    }
  }
  return violations
}

describe('the graph boundary', () => {
  it('imports only node, typescript, project-scope, immutable-api-utils, the linter and relative modules', () => {
    const graphRoot = import.meta.dirname
    const violations: string[] = []
    for (const entry of readDirectoryRecursive(graphRoot)) {
      if (!entry.isFile || !entry.name.endsWith('.ts')) continue
      const file = relative(graphRoot, entry.path).split(sep).join(posix.sep)
      const spec = file.endsWith('.spec.ts') || file.includes('__test-utils__/')
      violations.push(...violationsOf(readFileSync(resolve(graphRoot, entry.path), 'utf8'), file, spec))
    }
    expect(violations).toEqual([])
  })

  it('sees a wrapped import of the Nx adapters', () => {
    const text = "import type {\n  ProjectGraph,\n  ProjectGraphProjectNode,\n} from '@hyperfrontend/integration-nx/compat'\n"
    expect(violationsOf(text, 'a.ts')).toEqual(['a.ts: @hyperfrontend/integration-nx/compat'])
  })

  it('sees an import() of Nx', () => {
    expect(violationsOf("export async function load() {\n  return await import('nx/src/devkit-exports')\n}\n", 'a.ts')).toEqual([
      'a.ts: nx/src/devkit-exports',
    ])
  })

  it('sees a require of Nx', () => {
    expect(violationsOf("const devkit = require('@nx/devkit')\n", 'a.ts')).toEqual(['a.ts: @nx/devkit'])
  })

  it('sees an import type of Nx', () => {
    expect(violationsOf("type Graph = import('@nx/devkit').ProjectGraph\n", 'a.ts')).toEqual(['a.ts: @nx/devkit'])
  })

  it('refuses createRequire', () => {
    expect(violationsOf("import { createRequire } from 'node:module'\n", 'a.ts')).toEqual(['a.ts: createRequire'])
  })

  it('ignores quoted fixture source', () => {
    expect(violationsOf('const fixture = "import { x } from \'nx\'"\n', 'a.spec.ts', true)).toEqual([])
  })
})
