/**
 * CommonJS stand-in for the module locator: runtimes that execute this source
 * tree as CommonJS cannot parse the `import.meta` token in `module-dir.ts`,
 * and always define `__dirname`, which resolves to the same source directory
 * here.
 *
 * @returns Absolute directory path of the running module.
 *
 * @example Anchoring an asset lookup beside the running module
 * ```typescript
 * const assetDir = join(currentModuleDir(), 'debug-ui')
 * ```
 */
export function currentModuleDir(): string {
  return __dirname
}
