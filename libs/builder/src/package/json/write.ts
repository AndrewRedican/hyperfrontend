import type { PackageJson } from '../../models'
import { join, writeJsonFile } from '@hyperfrontend/project-scope/core'

/**
 * Writes the synthesized `package.json` to the build output directory.
 *
 * The file is emitted with two-space indentation (project-scope's default) and
 * a trailing newline so the published artifact diffs cleanly against
 * formatter-managed source files.
 *
 * @param outputPath - Absolute path to the output directory (the dist root).
 * @param packageJson - Fully assembled `PackageJson` to serialize.
 *
 * @example Writing the dist package.json
 * ```typescript
 * writeOutputPackageJson(ctx.outputPath, distPkg)
 * ```
 */
export const writeOutputPackageJson = (outputPath: string, packageJson: PackageJson): void => {
  writeJsonFile(join(outputPath, 'package.json'), packageJson)
}
