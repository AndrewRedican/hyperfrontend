/**
 * Predicate factories for the {@link IsWorkspacePackagePredicate} slot on
 * {@link BuildConfig}. Use these to opt a build into workspace-aware behavior
 * (inlining, dependency filtering) without hand-rolling the predicate.
 *
 * @module @hyperfrontend/builder/presets
 */
export { byNames } from './by-names'
export { byPrefix } from './by-prefix'
