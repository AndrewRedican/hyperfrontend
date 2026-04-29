/**
 * Opt-in third-party license collection: scan workspace `node_modules` for the
 * external dependencies of a build, render the markdown table, and write the
 * resulting `THIRD_PARTY_LICENSES.md` to the dist root.
 *
 * @module @hyperfrontend/builder/package/licenses
 */
export type { ThirdPartyLicenseEntry } from './types'
export { collectThirdPartyLicenses } from './collect'
export { generateThirdPartyLicensesContent } from './generate-content'
export { writeThirdPartyLicensesFile } from './write'
