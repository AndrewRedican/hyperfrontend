import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'
import { ACTUAL_QUERY, MOCK_SCHEME, isMocked, mockedSource, registerSpecMocks } from './mock-registry.ts'
import { loadAliases } from './paths.ts'
import { compileModuleMappings, resolveSpecifier } from './resolver.ts'

/**
 * Environment variable naming the workspace root. The runner always sets it; the fallback
 * keeps a hand-run `node --import` usable from inside a project directory.
 */
const WORKSPACE_ROOT_VAR = 'HF_TEST_WORKSPACE_ROOT'

/**
 * Environment variable holding a JSON array of `[pattern, replacement]` pairs, the
 * equivalent of Jest's `moduleNameMapper`. `<rootDir>` in a replacement is substituted
 * with the project root the runner was invoked from.
 */
const MODULE_MAP_VAR = 'HF_TEST_MODULE_MAP'

/**
 * Installs the synchronous resolution hooks the workspace's tests rely on: workspace path
 * aliases, `moduleNameMapper` redirects, extensionless TypeScript specifiers, and the
 * module generation that backs `jest.resetModules`. Node resolves none of these itself.
 *
 * This module is the `--import` entry, so it runs before any test code and imports its
 * own dependencies by explicit path: the hooks it is about to install are not available
 * to it yet.
 */
export function registerResolutionHooks(): void {
  const workspaceRoot = process.env[WORKSPACE_ROOT_VAR] ?? process.cwd()
  const context = {
    workspaceRoot,
    aliases: loadAliases(workspaceRoot),
    mappings: compileModuleMappings(process.env[MODULE_MAP_VAR], process.cwd()),
    entryDirectory: process.cwd(),
  }

  const runtimeUrl = new URL('../mock/jest-api.ts', import.meta.url).href

  registerHooks({
    resolve(specifier, resolveContext, nextResolve) {
      // how: the query names the module a mock stands in for, so it resolves to itself and stays a distinct module.
      if (specifier.endsWith(`?${ACTUAL_QUERY}`)) {
        const bare = specifier.slice(0, -(ACTUAL_QUERY.length + 1))
        const resolved = resolveSpecifier(bare, resolveContext.parentURL, context) ?? nextResolve(bare, resolveContext).url
        return { url: `${resolved}${resolved.includes('?') ? '&' : '?'}${ACTUAL_QUERY}`, shortCircuit: true }
      }

      const url = resolveSpecifier(specifier, resolveContext.parentURL, context) ?? nextResolve(specifier, resolveContext).url

      // why: substituting here rather than at load is what lets a built-in be replaced at all, since one this loader has already imported would never be loaded again.
      if (isMocked(url)) return { url: `${MOCK_SCHEME}${encodeURIComponent(url)}`, shortCircuit: true }

      return { url, shortCircuit: true }
    },

    load(url, loadContext, nextLoad) {
      if (url.startsWith(MOCK_SCHEME)) {
        return { format: 'module', source: mockedSource(decodeURIComponent(url.slice(MOCK_SCHEME.length)), runtimeUrl), shortCircuit: true }
      }

      if (url.endsWith(`?${ACTUAL_QUERY}`) || url.endsWith(`&${ACTUAL_QUERY}`)) {
        return nextLoad(url.slice(0, -(ACTUAL_QUERY.length + 1)), loadContext)
      }

      const result = nextLoad(url, loadContext)
      // how: a spec's own load runs before Node resolves the spec's imports, so declarations read here are registered before any mocked module is asked for.
      if (isSpecFile(url)) {
        registerSpecMocks(url, readFileSync(fileURLToPath(url.split('?')[0] ?? url), 'utf8'), (specifier, parent) =>
          resolveSpecifier(specifier, parent, context)
        )
      }
      return result
    },
  })
}

/**
 * Reports whether a URL names a spec file, the only place `jest.mock` is read from.
 *
 * @param url - The URL being loaded.
 * @returns True when the file is a spec.
 */
function isSpecFile(url: string): boolean {
  const path = url.split('?')[0] ?? url
  return path.endsWith('.spec.ts') || path.endsWith('.spec.tsx')
}

registerResolutionHooks()
