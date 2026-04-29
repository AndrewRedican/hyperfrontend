/**
 * Generic asset-copy primitive consumed by the package phase. Asset selection
 * is data-driven: callers describe which files / globs to materialize and the
 * target subdirectory, and {@link copyAssets} resolves them against the build
 * output path.
 *
 * @module @hyperfrontend/builder/package/assets
 */
export { copyAssets } from './copy-assets'
