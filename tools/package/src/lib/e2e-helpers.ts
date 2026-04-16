import type { Tree } from '@nx/devkit'
import { joinPathFragments, updateJson } from '@nx/devkit'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { replaceDescriptionPackageName } from './json-updaters'
import { logger } from './logger'

/**
 * Options for E2E project checking.
 */
export interface E2ECheckOptions {
  /** Current npm package name */
  currentPackageName: string
  /** New npm package name */
  newPackageName: string
  /** Whether the name is being updated */
  updateName?: boolean
}

/**
 * Update E2E project files in-place and warn about the folder move.
 * Automatically updates:
 * - project.json: name and implicitDependencies
 * - package.json: name and dependency key
 * Warns about the folder rename which requires a separate move generator invocation.
 *
 * @param tree - The virtual file system tree
 * @param options - Options containing package names and update flag
 */
export function checkE2EProject(tree: Tree, options: E2ECheckOptions): void {
  const currentLibName = options.currentPackageName.replace('@hyperfrontend/', '')
  const currentE2ERoot = `apps/package-e2e/${currentLibName}`

  if (!tree.exists(joinPathFragments(currentE2ERoot, 'project.json'))) {
    return
  }

  // why: Skip update if name isn't being updated (move without rename)
  if (options.updateName === false) {
    return
  }

  const newLibName = options.newPackageName.replace('@hyperfrontend/', '')

  if (currentLibName === newLibName) {
    return
  }

  const newE2EProjectName = `e2e-lib-${newLibName}`
  const currentE2EProjectName = `e2e-lib-${currentLibName}`
  const newE2ERoot = `apps/package-e2e/${newLibName}`

  const projectJsonPath = joinPathFragments(currentE2ERoot, 'project.json')
  updateJson(tree, projectJsonPath, (json) => {
    if (json.name === currentE2EProjectName) {
      json.name = newE2EProjectName
    }
    replaceDescriptionPackageName(json, options.currentPackageName, options.newPackageName)
    if (isArray(json.implicitDependencies)) {
      json.implicitDependencies = (<string[]>json.implicitDependencies).map((dep) =>
        dep === `lib-${currentLibName}` ? `lib-${newLibName}` : dep
      )
    }
    return json
  })

  const packageJsonPath = joinPathFragments(currentE2ERoot, 'package.json')
  if (tree.exists(packageJsonPath)) {
    updateJson(tree, packageJsonPath, (json) => {
      json.name = `@hyperfrontend/e2e-${newLibName}`
      replaceDescriptionPackageName(json, options.currentPackageName, options.newPackageName)
      if (json.dependencies?.[options.currentPackageName]) {
        const oldTgzPath = <string>json.dependencies[options.currentPackageName]
        json.dependencies[options.newPackageName] = oldTgzPath.replace(`hyperfrontend-${currentLibName}-`, `hyperfrontend-${newLibName}-`)
        delete json.dependencies[options.currentPackageName]
      }
      if (json.scripts?.['pack-install'] && typeof json.scripts['pack-install'] === 'string') {
        json.scripts['pack-install'] = (<string>json.scripts['pack-install']).replaceAll(`/${currentLibName}`, `/${newLibName}`)
      }
      return json
    })
  }

  logger.warn('')
  logger.warn('=== E2E Project Folder Move Required ===')
  logger.warn(`E2E project files updated in: ${currentE2ERoot}`)
  logger.warn(`Please move the folder to match the new name:`)
  logger.warn(`  nx generate @hyperfrontend/package:move e2e-${currentLibName} ${newE2ERoot.replace(`/${newLibName}`, '')}`)
  logger.warn(`  (or manually: mv ${currentE2ERoot} ${newE2ERoot})`)
  logger.warn('')
}
