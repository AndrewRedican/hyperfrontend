export interface ParsedBody {
  /** The body text (may be multiline) */
  body: string
  /** Index where the body ends (start of footers or end of message) */
  endIndex: number
}

/**
 * Parses the body section of a commit message.
 *
 * The body starts after the first blank line and continues until
 * we encounter a footer (key: value or key #value pattern) or end of message.
 *
 * @param lines - All lines of the commit message
 * @param startIndex - Index to start looking for body (after header)
 * @returns Parsed body or undefined if no body
 */
export function parseBody(lines: string[], startIndex: number): ParsedBody | undefined {
  let pos = startIndex
  while (pos < lines.length) {
    const currentLine = lines[pos]
    if (currentLine === undefined || currentLine.trim() !== '') break
    pos++
  }

  if (pos >= lines.length) {
    return undefined
  }

  const firstLine = lines[pos]
  if (firstLine === undefined || isFooterLine(firstLine)) {
    return undefined
  }

  const bodyLines: string[] = []

  while (pos < lines.length) {
    const line = lines[pos]
    if (line === undefined) break

    if (isFooterLine(line)) {
      break
    }

    const nextLine = lines[pos + 1]
    if (line.trim() === '' && pos + 1 < lines.length && nextLine !== undefined && isFooterLine(nextLine)) {
      break
    }

    bodyLines.push(line)
    pos++
  }

  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1]?.trim() === '') {
    bodyLines.pop()
  }

  if (bodyLines.length === 0) {
    return undefined
  }

  return {
    body: bodyLines.join('\n'),
    endIndex: pos,
  }
}

/**
 * Checks if a line looks like a footer.
 *
 * Footer format:
 * - key: value
 * - key #value (for issue references)
 * - BREAKING CHANGE: description
 * - BREAKING-CHANGE: description
 *
 * @param line - The line to check
 * @returns True if the line looks like a footer
 */
function isFooterLine(line: string): boolean {
  if (!line) return false

  const trimmed = line.trim()
  if (trimmed === '') return false

  if (trimmed.startsWith('BREAKING CHANGE:') || trimmed.startsWith('BREAKING-CHANGE:')) {
    return true
  }

  let pos = 0

  while (pos < trimmed.length && trimmed[pos] === ' ') {
    pos++
  }

  const tokenStart = pos
  while (pos < trimmed.length) {
    const code = trimmed.charCodeAt(pos)

    if ((code >= 97 && code <= 122) || (code >= 65 && code <= 90) || (code >= 48 && code <= 57) || code === 45) {
      pos++
    } else {
      break
    }
  }

  if (pos === tokenStart) return false

  if (trimmed[pos] === ':') {
    return true
  }

  if (trimmed[pos] === ' ' && trimmed[pos + 1] === '#') {
    return true
  }

  return false
}
