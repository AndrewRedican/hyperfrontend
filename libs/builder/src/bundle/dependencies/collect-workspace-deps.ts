import type { BuildContext } from '../../models'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Collects the distinct `whole-surface` workspace package names from the build
 * context — the packages whose entire import surface is hoisted into
 * `_dependencies/<packageName>/`.
 *
 * Drives the `otherDeps` prefix list every pre-pass / per-entry job passes to
 * the externalize plugin, so the JS pre-pass, the d.ts pre-pass, and the
 * per-entry d.ts pass all agree on the same workspace prefix set.
 *
 * @param context - Build context supplying `workspaceBundledDeps`.
 * @returns De-duplicated `whole-surface` package names.
 *
 * @example Collecting whole-surface prefixes for a job's `otherDeps`
 * ```typescript
 * otherDeps: [...context.bundledDeps, ...collectWorkspacePrefixDeps(context)]
 * ```
 */
export const collectWorkspacePrefixDeps = (context: BuildContext): string[] => {
  const set = createSet<string>([])
  for (const entry of context.workspaceBundledDeps) {
    if (entry.policy === 'whole-surface') set.add(entry.packageName)
  }
  return from(set)
}

/**
 * Collects the distinct `sub-path` workspace specifiers from the build context —
 * the exact `@scope/pkg/sub` imports that are hoisted individually rather than
 * across the whole package surface.
 *
 * Feeds the `otherWorkspaceSpecifiers` list each job hands the externalize
 * plugin, keeping the three job-building sites in agreement on the exact-match
 * specifier set.
 *
 * @param context - Build context supplying `workspaceBundledDeps`.
 * @returns De-duplicated `sub-path` specifiers.
 *
 * @example Collecting sub-path specifiers for a job's `otherWorkspaceSpecifiers`
 * ```typescript
 * otherWorkspaceSpecifiers: collectWorkspaceExactSpecifiers(context)
 * ```
 */
export const collectWorkspaceExactSpecifiers = (context: BuildContext): string[] => {
  const set = createSet<string>([])
  for (const entry of context.workspaceBundledDeps) {
    if (entry.policy === 'sub-path') set.add(entry.specifier)
  }
  return from(set)
}
