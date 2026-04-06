import type { FileStats, LegendEntry } from './types'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Merge consecutive integers into ranges.
 *
 * @example toRanges([4,5,6,9]) returns "L4-6, L9"
 * @param nums - Array of line numbers
 * @returns Formatted range string
 */
function toRanges(nums: number[]): string {
  const sorted = [...createSet(nums)].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let end = sorted[0]

  if (start === undefined || end === undefined) {
    return ''
  }

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    if (current === undefined) continue

    if (current === end + 1) {
      end = current
    } else {
      ranges.push(start === end ? `L${start}` : `L${start}-${end}`)
      start = end = current
    }
  }
  ranges.push(start === end ? `L${start}` : `L${start}-${end}`)

  return ranges.join(', ')
}

/**
 * Sort files: errors-only first, then by error count (ascending for quick wins).
 *
 * @param files - Array of FileStats
 * @returns Sorted array
 */
function sortFilesForQuickWins(files: FileStats[]): FileStats[] {
  return files.sort((a, b) => {
    const aHasErrors = a.errorCount > 0
    const bHasErrors = b.errorCount > 0

    if (aHasErrors !== bHasErrors) return aHasErrors ? -1 : 1
    if (a.errorCount !== b.errorCount) return a.errorCount - b.errorCount
    if (a.lineCount !== b.lineCount) return a.lineCount - b.lineCount

    return a.file.localeCompare(b.file)
  })
}

/**
 * Find relevant skill files in the workspace.
 *
 * @param workspaceRoot - Workspace root path
 * @returns Array of skill file paths
 */
function findRelevantSkills(workspaceRoot: string): string[] {
  const skills: string[] = []
  const codingSkill = join(workspaceRoot, '.github/skills/coding/SKILL.md')
  const eslintSkill = join(workspaceRoot, '.github/skills/eslint-rules/SKILL.md')

  if (existsSync(codingSkill)) skills.push('.github/skills/coding/SKILL.md')
  if (existsSync(eslintSkill)) skills.push('.github/skills/eslint-rules/SKILL.md')

  return skills
}

/**
 * Find documentation for a specific rule.
 *
 * @param rule - ESLint rule name
 * @param workspaceRoot - Workspace root path
 * @returns Path to documentation or null
 */
function findRuleDoc(rule: string, workspaceRoot: string): string | null {
  if (rule.startsWith('workspace/')) {
    const ruleName = rule.replace('workspace/', '')
    const docPath = join(workspaceRoot, 'tools/eslint-rules/docs', `${ruleName}.md`)
    if (existsSync(docPath)) return `tools/eslint-rules/docs/${ruleName}.md`
  }
  return null
}

/**
 * Render a single file's issues to the output.
 *
 * @param out - Output array to append to
 * @param stats - File statistics and code groups
 */
function renderFile(out: string[], stats: FileStats): void {
  out.push(`**${stats.file}**`)

  const sortedCodes = [...stats.codeGroups.entries()].sort(([a], [b]) => {
    const aIsError = a.startsWith('E')
    const bIsError = b.startsWith('E')
    if (aIsError !== bIsError) return aIsError ? -1 : 1
    return a.localeCompare(b)
  })

  for (const [code, lines] of sortedCodes) {
    out.push(`- ${toRanges(lines)} [${code}]`)
  }
  out.push('')
}

/**
 * Configuration for report generation.
 */
export interface ReportConfig {
  /**
   * Number of quick-win files to highlight.
   */
  maxFixes: number

  /**
   * Workspace root path.
   */
  workspaceRoot: string
}

/**
 * Generate LLM-optimized report content.
 *
 * @param legendList - Legend entries
 * @param fileMap - Map of file to stats
 * @param config - Report configuration
 * @returns Report content as string
 */
export function generateReport(legendList: LegendEntry[], fileMap: Map<string, FileStats>, config: ReportConfig): string {
  const out: string[] = []
  const files = sortFilesForQuickWins([...fileMap.values()])
  const skills = findRelevantSkills(config.workspaceRoot)

  const errorLegend = legendList.filter((l) => l.severity === 'error')
  const warnLegend = legendList.filter((l) => l.severity === 'warning')

  const totalErrors = files.reduce((sum, f) => sum + f.errorCount, 0)
  const totalWarnings = files.reduce((sum, f) => sum + f.warningCount, 0)
  const filesWithErrors = files.filter((f) => f.errorCount > 0).length

  out.push('# Lint Report')
  out.push('')
  out.push(`**Summary:** ${totalErrors} errors across ${filesWithErrors} files, ${totalWarnings} warnings.`)
  out.push('')

  out.push('## Instructions')
  out.push('')
  out.push('1. Fix ERRORS only (ignore warnings for now)')
  out.push(`2. Start with the first ${min(config.maxFixes, filesWithErrors)} files below to establish fix patterns`)
  out.push('3. Apply discovered patterns to remaining files')
  out.push('4. Re-run `nx run @hyperfrontend/workspace:lint:all` to verify progress')
  out.push('')

  if (skills.length > 0) {
    out.push('## Reference Skills')
    out.push('')
    out.push('Read these before fixing:')
    for (const skill of skills) {
      out.push(`- [${skill}](${skill})`)
    }
    out.push('')
  }

  out.push('## Legend')
  out.push('')

  if (errorLegend.length > 0) {
    out.push('### Errors')
    out.push('')
    for (const { code, rule, message } of errorLegend) {
      const doc = findRuleDoc(rule, config.workspaceRoot)
      const docLink = doc ? ` ([docs](${doc}))` : ''
      out.push(`- **${code}** \`${rule}\`${docLink}: "${message}"`)
    }
    out.push('')
  }

  if (warnLegend.length > 0) {
    out.push('### Warnings')
    out.push('')
    for (const { code, rule, message } of warnLegend) {
      const doc = findRuleDoc(rule, config.workspaceRoot)
      const docLink = doc ? ` ([docs](${doc}))` : ''
      out.push(`- **${code}** \`${rule}\`${docLink}: "${message}"`)
    }
    out.push('')
  }

  const errorFiles = files.filter((f) => f.errorCount > 0)
  const warningOnlyFiles = files.filter((f) => f.errorCount === 0 && f.warningCount > 0)

  if (errorFiles.length > 0) {
    out.push('## Files with Errors')
    out.push('')
    out.push('Sorted by quick wins (fewest errors first):')
    out.push('')

    const quickWins = errorFiles.slice(0, config.maxFixes)
    const remaining = errorFiles.slice(config.maxFixes)

    if (quickWins.length > 0) {
      out.push('### Priority (fix these first)')
      out.push('')
      for (const stats of quickWins) {
        renderFile(out, stats)
      }
    }

    if (remaining.length > 0) {
      out.push('### Remaining')
      out.push('')
      for (const stats of remaining) {
        renderFile(out, stats)
      }
    }
  }

  if (warningOnlyFiles.length > 0) {
    out.push('## Files with Warnings Only')
    out.push('')
    out.push('*(Do not fix these now — focus on errors first)*')
    out.push('')
    for (const stats of warningOnlyFiles) {
      renderFile(out, stats)
    }
  }

  return out.join('\n')
}
