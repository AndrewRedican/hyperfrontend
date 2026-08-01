import { format } from '@hyperfrontend/versioning/semver/format'
import { parseVersionStrict } from '@hyperfrontend/versioning/semver/parse'

/**
 * Canonicalizes a version string into its strict semver form.
 *
 * Every version a build stamps into its output (shell contract, scaffold,
 * `metadata.json`) passes through here, so equivalent spellings such as
 * `v1.2.0` and `1.2.0` always land as one canonical string.
 *
 * @param version - The authored version string.
 * @returns The canonical semver string.
 * @throws {Error} When the version is not valid semver.
 *
 * @example Canonicalizing an authored version
 * ```typescript
 * canonicalVersion('v1.2.0') // => '1.2.0'
 * ```
 */
export function canonicalVersion(version: string): string {
  return format(parseVersionStrict(version))
}
