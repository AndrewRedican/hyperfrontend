/**
 * Package subdomain facade: package.json synthesis + write, generic asset copy,
 * and opt-in third-party license collection composed via {@link runPackagePhase},
 * plus the post-emit `files` allowlist reflection ({@link finalizeFilesAllowlist}).
 *
 * @module @hyperfrontend/builder/package
 */
export { finalizeFilesAllowlist } from './finalize-files'
export { runPackagePhase } from './run-package-phase'
