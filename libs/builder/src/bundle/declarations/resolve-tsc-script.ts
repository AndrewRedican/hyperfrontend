import { createRequire } from 'node:module'
import { join } from '@hyperfrontend/project-scope/core/path'

/**
 * Resolves the entry script of the TypeScript compiler a workspace depends on.
 *
 * Resolution starts at the workspace root and follows Node's own module lookup, so the
 * result is the JavaScript file itself rather than the platform-specific launcher npm
 * writes into `node_modules/.bin`. Running that file with the Node binary works the same
 * way on every operating system and needs no shell.
 *
 * @param workspaceRoot - Absolute path of the workspace whose TypeScript install should be used.
 * @returns Absolute path of the `tsc` entry script.
 * @throws {Error} When TypeScript cannot be resolved from the workspace root.
 *
 * @example Running the workspace compiler without a shell
 * ```typescript
 * const tscScript = resolveTscScript('/abs/repo')
 * spawn(process.execPath, [tscScript, '--version'])
 * ```
 */
export const resolveTscScript = (workspaceRoot: string): string =>
  createRequire(join(workspaceRoot, 'package.json')).resolve('typescript/bin/tsc')
