/**
 * Declares the SDK in a consumer workspace's root `package.json`, which is
 * what `nx add` runs after installing it. Repeat runs are no-ops.
 *
 * @module @hyperfrontend/features/nx/generators/init
 */
export type { InitGeneratorSchema } from './generator'
export { default, initGenerator } from './generator'
