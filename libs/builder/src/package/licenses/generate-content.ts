import type { ThirdPartyLicenseEntry } from './types'

/**
 * Renders the markdown body for `THIRD_PARTY_LICENSES.md` from a collected list
 * of license entries.
 *
 * The output is a top-level heading followed by a two-column table mapping each
 * dependency to a markdown link pointing at the upstream license file (or the
 * raw license type when no URL is available). The body always ends with a
 * trailing newline.
 *
 * @param entries - License entries produced by {@link collectThirdPartyLicenses}.
 * @returns Markdown content suitable for writing to disk.
 *
 * @example Generating the markdown body from a license collection
 * ```typescript
 * const md = generateThirdPartyLicensesContent(entries)
 * ```
 */
export const generateThirdPartyLicensesContent = (entries: ThirdPartyLicenseEntry[]): string => {
  const lines: string[] = [
    '# Third-Party Licenses',
    '',
    '| Dependency       | Link                                                                 |',
    '| :--------------- | :------------------------------------------------------------------- |',
  ]
  for (const entry of entries) {
    const linkCell = entry.licenseUrl ? `[${entry.licenseType}](${entry.licenseUrl})` : entry.licenseType
    lines.push(`| \`${entry.name}\`     | ${linkCell} |`)
  }
  return lines.join('\n') + '\n'
}
