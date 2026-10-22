/**
 * The parts of a library README several rules read: the centred badge block it opens with and
 * the one-line description that follows it.
 *
 * @module rules/workspace/shared/readme
 */

/** A run of centred paragraphs. */
export interface CentredBlock {
  /** The lines of the block, joined. */
  readonly text: string
  /** The 1-based line the block opens on. */
  readonly startLine: number
  /** The 1-based line it closes on. */
  readonly endLine: number
}

/** A line of the README with its position. */
export interface ReadmeLine {
  /** The line, trimmed. */
  readonly text: string
  /** Its 1-based line number. */
  readonly line: number
}

/** What marks a badge, wherever it sits in the block. */
export const BADGE_PATTERNS: readonly RegExp[] = [
  /\/github\/actions\/workflow\/status/i,
  /:\/\/codecov\.io/i,
  /\/npm\/v\//i,
  /:\/\/bundlephobia\.com/i,
  /\/all-contributors/i,
  /\/license-MIT/i,
  /\/npm\/dm\//i,
  /\/github\/stars/i,
  /[/=]node-%3E%3D/i,
  /[/=]tree%20shakeable/i,
]

/**
 * Whether a line opens a centred paragraph.
 *
 * @param line - The line, trimmed and lower-cased
 * @returns True for `<p align="center">`
 */
function opensCentred(line: string): boolean {
  return line.startsWith('<p') && line.includes('align="center"')
}

/**
 * The centred blocks of a README: each run of adjacent `<p align="center">` paragraphs.
 *
 * @param content - The README
 * @returns The blocks in order
 */
export function centredBlocks(content: string): CentredBlock[] {
  const lines = content.split(/\r?\n/)
  const blocks: CentredBlock[] = []
  let startLine = -1
  let collected: string[] = []
  lines.forEach((line, index) => {
    const trimmed = line.trim().toLowerCase()
    if (startLine === -1 && opensCentred(trimmed)) {
      startLine = index + 1
      collected = []
    }
    if (startLine === -1) return
    collected.push(line)
    if (!trimmed.includes('</p>') || (index + 1 < lines.length && opensCentred(lines[index + 1].trim().toLowerCase()))) return
    blocks.push({ text: collected.join('\n'), startLine, endLine: index + 1 })
    startLine = -1
  })
  return blocks
}

/**
 * The badge block of a README: the first centred block carrying a badge, else the first block.
 *
 * @param content - The README
 * @returns The block, or null when the README has no centred block
 */
export function badgeBlock(content: string): CentredBlock | null {
  const blocks = centredBlocks(content)
  return blocks.find((block) => BADGE_PATTERNS.some((pattern) => pattern.test(block.text))) ?? blocks[0] ?? null
}

/**
 * The description a README opens with: the first prose line after the badge block, images and
 * HTML skipped, nothing when a heading comes first.
 *
 * @param content - The README
 * @param afterLine - The 1-based line the badge block closes on
 * @returns The line, or null
 */
export function shortDescription(content: string, afterLine: number): ReadmeLine | null {
  const lines = content.split(/\r?\n/)
  for (let index = afterLine; index < lines.length; index += 1) {
    const text = lines[index].trim()
    if (text === '' || text.startsWith('![') || text.startsWith('<')) continue
    return text.startsWith('#') ? null : { text, line: index + 1 }
  }
  return null
}
