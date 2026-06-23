/**
 * License entry for a single third-party dependency.
 */
export type ThirdPartyLicenseEntry = {
  /** Package name. */
  name: string
  /** Detected SPDX-style license identifier (or `Unknown`). */
  licenseType: string
  /** URL to the license file in the upstream repository, when known. */
  licenseUrl: string | null
}
