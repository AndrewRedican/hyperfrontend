/**
 * Opt-in third-party license collection that writes `THIRD_PARTY_LICENSES.md`
 * to the dist root.
 *
 * @module @hyperfrontend/builder/package/licenses
 */
export type { ThirdPartyLicenseEntry } from './types'
export { collectThirdPartyLicenses } from './collect'
export { generateThirdPartyLicensesContent } from './generate-content'
export { writeThirdPartyLicensesFile } from './write'
