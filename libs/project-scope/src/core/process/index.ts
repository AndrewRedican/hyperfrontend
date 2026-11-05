/**
 * Starting `npm`, `npx` and the other commands that are `.cmd` shims on Windows, with arguments quoted for `cmd.exe`.
 *
 * @module @hyperfrontend/project-scope/core/process
 */
export type { ShimCommand } from './shim'
export { quoteForCmd, shimCommand } from './shim'
