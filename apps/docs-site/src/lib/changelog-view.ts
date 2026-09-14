import type { ChangelogRelease } from './changelog-parse'
import { parseVersion } from './semver-range'

/** How big a step a release was from the one before it. */
export type ReleaseStep = 'initial' | 'major' | 'minor' | 'patch'

/** What a release's heading says about its contents at a glance. */
export interface ReleaseSummary {
  /** Whether any note in the release is marked breaking */
  breaking: boolean
  /** Notes filed under features */
  features: number
  /** Notes filed under fixes */
  fixes: number
  /** Notes filed anywhere else */
  other: number
}

/**
 * The id a release's section carries, so the document index and a link can reach it.
 *
 * @param version - The version as written in the changelog
 * @returns An id, `v0-10-0` for `0.10.0`
 *
 * @example
 * ```typescript
 * releaseAnchor('0.10.0') // 'v0-10-0'
 * ```
 */
export function releaseAnchor(version: string): string {
  return `v${version.replace(/[^0-9A-Za-z]+/g, '-')}`
}

/**
 * How big a step a release was, read against the release before it.
 *
 * A step is judged on the numbers alone, so the first release in a history
 * is `initial`, a change of major is `major` whatever else moved, and a
 * version that cannot be parsed is treated as a patch rather than made a
 * fuss of.
 *
 * @param release - The release being judged
 * @param previous - The release before it in time, or null for the first
 * @returns How big a step it took
 *
 * @example
 * ```typescript
 * releaseStep({ version: '1.0.0', ... }, { version: '0.9.0', ... }) // 'major'
 * releaseStep({ version: '0.10.0', ... }, { version: '0.9.1', ... }) // 'minor'
 * ```
 */
export function releaseStep(release: ChangelogRelease, previous: ChangelogRelease | null): ReleaseStep {
  if (previous === null) return 'initial'
  const current = parseVersion(release.version)
  const before = parseVersion(previous.version)
  if (current === null || before === null) return 'patch'
  if (current.major !== before.major) return 'major'
  if (current.minor !== before.minor) return 'minor'
  return 'patch'
}

/**
 * Count what a release holds, for its collapsed heading.
 *
 * @param release - The release being summarized
 * @returns The counts and whether anything breaks
 *
 * @example
 * ```typescript
 * summarizeRelease(release) // { breaking: true, features: 1, fixes: 0, other: 0 }
 * ```
 */
export function summarizeRelease(release: ChangelogRelease): ReleaseSummary {
  const summary: ReleaseSummary = { breaking: false, features: 0, fixes: 0, other: 0 }
  for (const section of release.sections) {
    for (const item of section.items) {
      if (item.breaking || section.kind === 'breaking') summary.breaking = true
      if (section.kind === 'features') summary.features += 1
      else if (section.kind === 'fixes') summary.fixes += 1
      else summary.other += 1
    }
  }
  return summary
}

/**
 * Words for a release's counts, `4 features · 2 fixes`.
 *
 * @param summary - The counts
 * @returns The parts, in the order they are shown; empty for a release with no notes
 *
 * @example
 * ```typescript
 * describeSummary({ breaking: false, features: 1, fixes: 2, other: 0 }) // ['1 feature', '2 fixes']
 * ```
 */
export function describeSummary(summary: ReleaseSummary): string[] {
  const parts: string[] = []
  if (summary.features > 0) parts.push(`${summary.features} ${summary.features === 1 ? 'feature' : 'features'}`)
  if (summary.fixes > 0) parts.push(`${summary.fixes} ${summary.fixes === 1 ? 'fix' : 'fixes'}`)
  if (summary.other > 0) parts.push(`${summary.other} ${summary.other === 1 ? 'other change' : 'other changes'}`)
  return parts
}
