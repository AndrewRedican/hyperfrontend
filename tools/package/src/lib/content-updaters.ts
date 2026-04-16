import type { Tree } from '@nx/devkit'
import { joinPathFragments } from '@nx/devkit'

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
 */
export function updateContentReferences(tree: Tree, options: UpdateContentOptions): void {
  updateReadmeReferences(tree, options)
  updateModuleJSDoc(tree, options)
}
