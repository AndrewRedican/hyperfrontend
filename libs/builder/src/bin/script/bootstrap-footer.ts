import type { BinScriptFormat } from '../../models'

/**
 * Inputs to {@link defaultBootstrap}.
 */
export interface DefaultBootstrapOptions {
  /** Runner export name to invoke. Use `'default'` to target the file's default export. */
  runner: string
  /** Output format the bootstrap will be appended to. */
  format: BinScriptFormat
}

const resolveRunnerExpression = (runner: string, format: BinScriptFormat): string => {
  if (runner !== 'default') return runner
  return format === 'cjs' ? 'module.exports.default' : '(await import(import.meta.url)).default'
}

/**
 * Builds the standard bootstrap footer appended to a JS bin's bundle output.
 *
 * The footer wires the resolved runner export to `process.argv` / `process.cwd()` /
 * `process.stderr` / `process.stdout`, maps the returned exit code to `process.exit`,
 * and surfaces unexpected rejections by writing to stderr and exiting `1`.
 *
 * When `runner === 'default'`, the runner reference is resolved differently per format:
 * - CJS uses `module.exports.default`, available as a top-level reference inside the
 *   compiled CommonJS bundle.
 * - ESM uses `(await import(import.meta.url)).default`, which re-imports the bundle's
 *   own module record to retrieve the default export. ESM top-level `await` is required.
 *
 * Otherwise the supplied named runner is referenced directly, which works for both
 * formats because Rollup preserves the local function name at the file scope.
 *
 * @param options - Runner name + target format.
 * @returns Bootstrap snippet suitable for `output.footer`.
 *
 * @example Default-export runner for an ESM bin
 * ```typescript
 * const footer = defaultBootstrap({ runner: 'default', format: 'esm' })
 * ```
 *
 * @example Named runner shared between CJS and ESM outputs
 * ```typescript
 * const footer = defaultBootstrap({ runner: 'runCz', format: 'cjs' })
 * ```
 */
export const defaultBootstrap = (options: DefaultBootstrapOptions): string => {
  const runnerExpr = resolveRunnerExpression(options.runner, options.format)
  return [
    `${runnerExpr}({ argv: process.argv.slice(2), cwd: process.cwd(), stderr: process.stderr, stdout: process.stdout }).then(`,
    '  (code) => { process.exit(code) },',
    '  (error) => {',
    `    process.stderr.write((error instanceof Error ? error.message : String(error)) + '\\n')`,
    '    process.exit(1)',
    '  }',
    ')',
  ].join('\n')
}
