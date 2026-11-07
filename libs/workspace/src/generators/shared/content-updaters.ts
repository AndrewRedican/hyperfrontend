/**
 * The package name a project's README and `@module` header mention, rewritten when the package is
 * renamed.
 *
 * @module generators/shared/content-updaters
 */

import type { Tree } from './tree'
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
 * Update README.md with new package name references.
 *
 * @param tree - The virtual file system tree
 * @param options - Options containing project root and package names
 *
 * @example Every mention in the README follows the package
 * ```typescript
 * updateReadmeReferences(tree, { projectRoot: 'libs/core', currentPackageName: '@acme/core', newPackageName: '@acme/kernel' })
 * // "npm install @acme/core" in libs/core/README.md now reads "npm install @acme/kernel"; a project without a README is left alone
 * ```
 */
export function updateReadmeReferences(tree: Tree, options: UpdateContentOptions): void {
  if (options.currentPackageName === options.newPackageName) {
    return
  }

  const readmePath = joinPathFragments(options.projectRoot, 'README.md')

  if (!tree.exists(readmePath)) {
    return
  }

  let content = tree.read(readmePath, 'utf-8')
  if (content) {
    content = content.replaceAll(options.currentPackageName, options.newPackageName)
    tree.write(readmePath, content)
  }
}

/**
 * Update `@module` JSDoc tags in source files.
 *
 * @param tree - The virtual file system tree
 * @param options - Options containing project root and package names
 *
 * @example Only the entry's `@module` tag is rewritten
 * ```typescript
 * updateModuleJSDoc(tree, { projectRoot: 'libs/core', currentPackageName: '@acme/core', newPackageName: '@acme/kernel' })
 * // "@module @acme/core" in libs/core/src/index.ts now reads "@module @acme/kernel"; other mentions of the name stay
 * ```
 */
export function updateModuleJSDoc(tree: Tree, options: UpdateContentOptions): void {
  if (options.currentPackageName === options.newPackageName) {
    return
  }

  const indexPath = joinPathFragments(options.projectRoot, 'src/index.ts')

  if (!tree.exists(indexPath)) {
    return
  }

  let content = tree.read(indexPath, 'utf-8')
  if (content) {
    content = content.replaceAll(`@module ${options.currentPackageName}`, `@module ${options.newPackageName}`)
    tree.write(indexPath, content)
  }
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
