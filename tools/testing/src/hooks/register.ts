import { registerHooks } from 'node:module'
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

  registerHooks({
    resolve(specifier, resolveContext, nextResolve) {
      const url = resolveSpecifier(specifier, resolveContext.parentURL, context)
      return url ? { url, shortCircuit: true } : nextResolve(specifier, resolveContext)
    },
  })
}

registerResolutionHooks()
