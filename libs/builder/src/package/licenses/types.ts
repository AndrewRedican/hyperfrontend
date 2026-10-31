/**
 * Verbatim content of one license or notice file shipped by a dependency.
 */
export type LicenseText = {
  /** File name inside the package directory, e.g. `LICENSE` or `COPYING.LESSER`. */
  fileName: string
  /** File content, unmodified. */
  content: string
}

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
  /** License and notice files the package ships (`LICENSE*`, `LICENCE*`, `COPYING*`, `NOTICE*`), sorted by file name. */
  licenseTexts?: LicenseText[]
}
