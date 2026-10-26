import { readFileSync } from 'node:fs'
import { relative, resolve, sep, posix } from 'node:path'
import { readDirectoryRecursive } from '@hyperfrontend/project-scope/core'
import { describe, expect, it } from '@hyperfrontend/testing'

/** Workspace packages the graph may import, by alias prefix; `@hyperfrontend/testing` is for specs alone. */
const ALLOWED_WORKSPACE_PREFIXES = ['@hyperfrontend/project-scope/', '@hyperfrontend/immutable-api-utils/', '@hyperfrontend/linter/']

/** Specifiers the graph must never import: Nx itself and the Nx-facing adapters. */
const FORBIDDEN_PREFIXES = ['nx', '@nx/', '@hyperfrontend/integration-nx']

/** The specifier of an import or re-export statement; only a statement's own line counts, so quoted source inside a fixture does not. */
const SPECIFIER = /^(?:import|export)\b[^'\n]*'([^']+)'/gm

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

describe('the graph boundary', () => {
  it('imports only node, typescript, project-scope, immutable-api-utils, the linter and relative modules', () => {
    const graphRoot = import.meta.dirname
    const violations: string[] = []
    for (const entry of readDirectoryRecursive(graphRoot)) {
      if (!entry.isFile || !entry.name.endsWith('.ts')) continue
      const file = relative(graphRoot, entry.path).split(sep).join(posix.sep)
      const spec = file.endsWith('.spec.ts') || file.includes('__test-utils__/')
      for (const match of readFileSync(resolve(graphRoot, entry.path), 'utf8').matchAll(SPECIFIER)) {
        const specifier = match[1] ?? ''
        if (!allowed(specifier, spec)) violations.push(`${file}: ${specifier}`)
      }
    }
    expect(violations).toEqual([])
  })
})
