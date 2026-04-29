import type { PackageJson } from '../../models'
import { join, readJsonFile } from '@hyperfrontend/project-scope/core'

/**
 * Reads and parses the project's `package.json` from the given project root.
 *
 * The file is required to exist; missing files surface as the standard
 * `FS_NOT_FOUND` filesystem error from project-scope.
 *
 * @param projectRoot - Absolute path to the project root containing `package.json`.
 * @returns Parsed `package.json` contents typed as `PackageJson`.
 *
 * @example Reading the source package.json before synthesizing the dist version
 * ```typescript
 * const srcPkg = readProjectPackageJson('/abs/libs/foo')
 * console.log(srcPkg.name)
 * ```
 */
export const readProjectPackageJson = (projectRoot: string): PackageJson => readJsonFile<PackageJson>(join(projectRoot, 'package.json'))
