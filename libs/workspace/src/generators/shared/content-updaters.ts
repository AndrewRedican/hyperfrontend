/**
 * The package name a project's README and `@module` header mention, rewritten when the package is
 * renamed.
 *
 * @module generators/shared/content-updaters
 */

import type { Tree } from './tree'
import { replacePackageMentions } from './package-mentions'
import { joinPathFragments } from './paths'

/**
 * Options for updating content references.
 */
export interface UpdateContentOptions {
  /** Project root path */
  projectRoot: string
  /** Current npm package name */
  currentPackageName: string
  /** New npm package name */
  newPackageName: string
}

/**
 * Rewrites the whole mentions of a name in one file, and leaves a file that is missing, empty or
 * without a mention unwritten.
 *
 * @param tree - The tree the file lives in
 * @param path - The file, relative to the root
 * @param current - The name to replace
 * @param replacement - The name written in its place
 */
function rewriteMentions(tree: Tree, path: string, current: string, replacement: string): void {
  const content = tree.read(path, 'utf-8')
  if (!content) return
  const rewritten = replacePackageMentions(content, current, replacement)
  if (rewritten !== content) tree.write(path, rewritten)
}

/**
 * Update README.md with new package name references.
 * A longer name that starts with the package's, such as `@acme/core-ui` beside `@acme/core`, is left alone.
 * The addresses that name the package, such as the image and the link of a badge, follow it.
 *
 * @param tree - The virtual file system tree
 * @param options - Options containing project root and package names
 *
 * @example Every mention in the README follows the package
 * ```typescript
 * updateReadmeReferences(tree, { projectRoot: 'libs/core', currentPackageName: '@acme/core', newPackageName: '@acme/kernel' })
 * // "npm install @acme/core @acme/core-ui" in libs/core/README.md now reads "npm install @acme/kernel @acme/core-ui"
 * // "https://img.shields.io/npm/v/@acme/core.svg" now reads "https://img.shields.io/npm/v/@acme/kernel.svg"
 * // a project without a README is left alone
 * ```
 */
export function updateReadmeReferences(tree: Tree, options: UpdateContentOptions): void {
  if (options.currentPackageName === options.newPackageName) {
    return
  }

  rewriteMentions(tree, joinPathFragments(options.projectRoot, 'README.md'), options.currentPackageName, options.newPackageName)
}

/**
 * Update `@module` JSDoc tags in source files.
 * The tag of an entry of the package follows; the tag of a longer name that starts with the package's is left alone.
 *
 * @param tree - The virtual file system tree
 * @param options - Options containing project root and package names
 *
 * @example Only the entry's `@module` tag is rewritten
 * ```typescript
 * updateModuleJSDoc(tree, { projectRoot: 'libs/core', currentPackageName: '@acme/core', newPackageName: '@acme/kernel' })
 * // "@module @acme/core" in libs/core/src/index.ts now reads "@module @acme/kernel"; other mentions of the name stay
 * // "@module @acme/core/testing" follows as "@module @acme/kernel/testing"; "@module @acme/core-ui" stays
 * ```
 */
export function updateModuleJSDoc(tree: Tree, options: UpdateContentOptions): void {
  if (options.currentPackageName === options.newPackageName) {
    return
  }

  rewriteMentions(
    tree,
    joinPathFragments(options.projectRoot, 'src/index.ts'),
    `@module ${options.currentPackageName}`,
    `@module ${options.newPackageName}`
  )
}

/**
 * Update all content references (README + JSDoc).
 * Convenience function combining updateReadmeReferences and updateModuleJSDoc.
 *
 * @param tree - The virtual file system tree
 * @param options - Options containing project root and package names
 *
 * @example Carrying a package's new name into its prose
 * ```typescript
 * import { updateContentReferences } from '@hyperfrontend/workspace/generators'
 *
 * updateContentReferences(tree, { projectRoot: 'libs/core', currentPackageName: '@acme/core', newPackageName: '@acme/kernel' })
 * // libs/core/README.md and the @module header of libs/core/src/index.ts now say @acme/kernel
 * ```
 */
export function updateContentReferences(tree: Tree, options: UpdateContentOptions): void {
  updateReadmeReferences(tree, options)
  updateModuleJSDoc(tree, options)
}
