import type { LicenseText, ThirdPartyLicenseEntry } from './types'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

// why: a license text may itself contain backtick runs, so the fence is always one tick longer than the longest of them
const fenceFor = (content: string): string => '`'.repeat(max(3, ...(content.match(/`+/g) ?? []).map((run) => run.length + 1)))

const renderText = (text: LicenseText): string[] => {
  const fence = fenceFor(text.content)
  return [`#### ${text.fileName}`, '', `${fence}text`, text.content.trimEnd(), fence, '']
}

/**
 * Renders the markdown body for `THIRD_PARTY_LICENSES.md` from a collected list
 * of license entries.
 *
 * The output is a top-level heading followed by a two-column table mapping each
 * dependency to a markdown link pointing at the upstream license file (or the
 * raw license type when no URL is available). When any entry carries license
 * texts, a "License texts" section follows the table with each package's
 * license and notice files reproduced verbatim in fenced blocks. The body
 * always ends with a trailing newline.
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
  const textLines = entries.flatMap((entry) => {
    const texts = entry.licenseTexts ?? []
    return texts.length === 0 ? [] : [`### \`${entry.name}\``, '', ...texts.flatMap(renderText)]
  })
  if (textLines.length > 0) lines.push('', '## License texts', '', ...textLines)
  return lines.join('\n').trimEnd() + '\n'
}
