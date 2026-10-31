/**
 * Opt-in third-party license collection that writes `THIRD_PARTY_LICENSES.md`
 * to the dist root.
 *
 * @module @hyperfrontend/builder/package/licenses
 */
export type { CollectBundledThirdPartyLicensesOptions } from './collect-bundled'
export type { LicenseText, ThirdPartyLicenseEntry } from './types'
export { collectThirdPartyLicenses } from './collect'
export { collectBundledThirdPartyLicenses } from './collect-bundled'
export { generateThirdPartyLicensesContent } from './generate-content'
export { writeThirdPartyLicensesFile } from './write'
