import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SWC_NODE_REGISTER = '@swc-node/register'

/**
 * Resolved worker invocation: an absolute script path plus any extra Node args
 * prepended to the spawned child's argv (the `@swc-node/register` loader when the
 * worker is reached as TypeScript source rather than a compiled artifact).
 */
export interface WorkerInvocation {
  /** Absolute path to the resolved worker entry script. */
  path: string
  /** Extra args prepended to the spawned child's argv. */
  execArgv: string[]
}

const probeDir = (dir: string, offset: readonly string[]): WorkerInvocation | undefined => {
  const compiled = join(dir, ...offset, 'index.cjs.js')
  if (existsSync(compiled)) return { path: compiled, execArgv: [] }
  const source = join(dir, ...offset, 'index.ts')
  if (existsSync(source)) return { path: source, execArgv: ['--require', SWC_NODE_REGISTER] }
  return undefined
}

/**
 * Directory of the currently-executing builder module, under either module system.
 *
 * The shipped CommonJS build and the `@swc-node/register` source bootstrap expose
 * `__dirname`; the ES-module build derives the same directory from `import.meta.url`.
 * Callers get their own on-disk location either way, and can find the worker beside them
 * however the builder was packaged.
 *
 * @returns Absolute directory path of the running module.
 *
 * @example Anchoring a lookup beside the running builder
 * ```typescript
 * const invocation = ascendForWorker(['bundle', 'rollup', 'worker'], currentModuleDir())
 * ```
 */
export const currentModuleDir = (): string => {
  // why: `typeof` guards the CommonJS-only global so the ES-module build falls through to `import.meta.url` instead of crashing on an undefined identifier.
  if (typeof __dirname !== 'undefined') {
    return __dirname
  }
  return dirname(fileURLToPath(import.meta.url))
}

/**
 * Locate a builder worker entry by ascending from a start directory toward the
 * filesystem root, returning the first ancestor at which the worker exists at the
 * given in-package offset. The compiled `index.cjs.js` is preferred; an `index.ts`
 * sibling (source-mode bootstrap) resolves with the swc loader attached.
 *
 * The worker ships inside the builder's own package, so resolving relative to the
 * running module finds it wherever the package lives: built dist, an installed
 * `node_modules` copy, or melded into a host bundle under `_dependencies/`.
 *
 * @param offset - In-package path segments to the worker directory (e.g. `['bundle', 'rollup', 'worker']`).
 * @param startDir - Directory to begin the ascent from. Defaults to the running module's directory; pass an explicit value to resolve from another anchor or under test.
 * @returns The resolved worker invocation, or `undefined` if no worker exists at the offset under any ancestor.
 *
 * @example Resolving the rollup worker from the running module
 * ```typescript
 * const invocation = ascendForWorker(['bundle', 'rollup', 'worker'])
 * if (!invocation) throw new Error('builder rollup worker not found beside the builder module')
 * ```
 */
export const ascendForWorker = (offset: readonly string[], startDir: string = currentModuleDir()): WorkerInvocation | undefined => {
  let dir = startDir
  let parent = dirname(dir)
  // how: probe each level then step up; the final probe covers the filesystem root, where parent === dir
  while (parent !== dir) {
    const found = probeDir(dir, offset)
    if (found) return found
    dir = parent
    parent = dirname(dir)
  }
  return probeDir(dir, offset)
}
