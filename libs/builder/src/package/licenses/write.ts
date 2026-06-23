import { join, writeFileContent } from '@hyperfrontend/project-scope/core'

/**
 * Writes the rendered third-party-licenses content as
 * `<outputPath>/THIRD_PARTY_LICENSES.md`. Parent directories are created if
 * necessary by the underlying project-scope writer.
 *
 * @param outputPath - Absolute path to the build output directory (the dist root).
 * @param content - Rendered markdown body produced by
 * {@link generateThirdPartyLicensesContent}.
 *
 * @example Writing the file at the dist root
 * ```typescript
 * writeThirdPartyLicensesFile(ctx.outputPath, content)
 * ```
 */
export const writeThirdPartyLicensesFile = (outputPath: string, content: string): void => {
  writeFileContent(join(outputPath, 'THIRD_PARTY_LICENSES.md'), content)
}
