/**
 * JS bin synthesis primitives: rollup-driven bundling with shebang + bootstrap footer
 * + chmod, plus the package.json#bin wiring helper.
 *
 * @module @hyperfrontend/builder/bin/script
 */
export type { DefaultBootstrapOptions } from './bootstrap-footer'
export { defaultBootstrap } from './bootstrap-footer'
export { buildJsBin } from './build-bin'
export { wireBinFieldInPackageJson } from './wire-package-bin'
