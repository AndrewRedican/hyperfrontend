import type { EcosystemTierId } from './library-facts'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { PRINT_WIDTH, blockBounds, indentOf, joinLines, quote, splitLines } from './lines'

/** The line that opens the hierarchy. */
const TIERS_OPENER = 'export const ECOSYSTEM_TIERS: readonly EcosystemTier[] = ['

/**
 * One level of the hierarchy as written in the module.
 */
interface TierSpan {
  /** The level's identifier */
  id: string
  /** The packages on it, in order */
  packages: string[]
  /** Index of the line that opens the packages array */
  packagesOpen: number
  /** Index of the line that closes it, the same line when the array is written inline */
  packagesClose: number
}

/**
 * The result of placing a package.
 */
export interface EcosystemPlacement {
  /** The module with the package placed */
  content: string
  /** The package that now precedes this one in the flattened hierarchy, or null when it leads */
  precededBy: string | null
}

/**
 * The quoted package names a run of lines carries.
 *
 * @param lines - The lines of a packages array
 * @returns The names in order
 */
function packageNamesIn(lines: readonly string[]): string[] {
  const names: string[] = []
  for (const line of lines) {
    for (const piece of line.split("'").slice(1)) {
      if (piece.startsWith('@')) names.push(piece)
    }
  }
  return names
}

/**
 * Read the levels of the hierarchy.
 *
 * @param lines - The module's lines
 * @param open - Index of the line that opens the hierarchy
 * @param close - Index of the line that closes it
 * @returns The levels in order
 * @throws {Error} When a packages array appears before any level is named
 */
function tiersOf(lines: readonly string[], open: number, close: number): TierSpan[] {
  const tiers: TierSpan[] = []
  for (let index = open + 1; index < close; index++) {
    const trimmed = (lines[index] as string).trim()
    if (trimmed.startsWith("id: '")) {
      tiers.push({
        id: trimmed.slice("id: '".length, trimmed.indexOf("'", "id: '".length)),
        packages: [],
        packagesOpen: -1,
        packagesClose: -1,
      })
      continue
    }
    if (!trimmed.startsWith('packages: [')) continue
    const tier = tiers[tiers.length - 1]
    if (tier === undefined) throw createError(`ecosystem.ts lists packages on line ${index + 1} before naming a level`)
    tier.packagesOpen = index
    tier.packagesClose = index
    while (!(lines[tier.packagesClose] as string).trim().endsWith('],')) tier.packagesClose++
    tier.packages = packageNamesIn(lines.slice(index, tier.packagesClose + 1))
  }
  return tiers
}

/**
 * Place a package on a level of the docs-site ecosystem hierarchy, after the
 * packages already on it.
 *
 * A package the hierarchy already places is left where it is. Either way the
 * package that precedes it in the flattened order is reported, which is the
 * order the root README's table follows.
 *
 * @param content - `apps/docs-site/src/lib/ecosystem.ts`
 * @param packageName - npm package name
 * @param tierId - The level to place the package on
 * @returns The module and the package's predecessor
 * @throws {Error} When the hierarchy or the level cannot be found
 *
 * @example
 * ```typescript
 * const { content, precededBy } = placeLibraryInEcosystem(source, '@hyperfrontend/testing', 'tooling')
 * precededBy // '@hyperfrontend/questions'
 * ```
 */
export function placeLibraryInEcosystem(content: string, packageName: string, tierId: EcosystemTierId): EcosystemPlacement {
  const text = splitLines(content)
  const { open, close } = blockBounds(
    text.lines,
    (line) => line === TIERS_OPENER,
    (line) => line === ']',
    'ecosystem.ts ECOSYSTEM_TIERS'
  )
  const tiers = tiersOf(text.lines, open, close)
  const order = tiers.flatMap((tier) => tier.packages)
  const placed = order.indexOf(packageName)
  if (placed !== -1) return { content, precededBy: placed === 0 ? null : (order[placed - 1] as string) }
  const tierIndex = tiers.findIndex((tier) => tier.id === tierId)
  if (tierIndex === -1) throw createError(`ecosystem.ts has no level named "${tierId}"`)
  const tier = tiers[tierIndex] as TierSpan
  const before = tiers.slice(0, tierIndex + 1).flatMap((candidate) => candidate.packages)
  const indent = indentOf(text.lines[tier.packagesOpen] as string)
  if (tier.packagesOpen === tier.packagesClose) {
    const names = [...tier.packages, packageName].map(quote)
    const inline = `${indent}packages: [${names.join(', ')}],`
    text.lines.splice(
      tier.packagesOpen,
      1,
      ...(inline.length <= PRINT_WIDTH ? [inline] : [`${indent}packages: [`, ...names.map((name) => `${indent}  ${name},`), `${indent}],`])
    )
  } else {
    text.lines.splice(tier.packagesClose, 0, `${indent}  ${quote(packageName)},`)
  }
  return { content: joinLines(text), precededBy: before.length === 0 ? null : (before[before.length - 1] as string) }
}
