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
  // Skip blank lines to find body start
  let pos = startIndex
  while (pos < lines.length && lines[pos].trim() === '') {
    pos++
  }

  if (pos >= lines.length) {
    return undefined
  }

  // If the first non-blank line is a footer, there's no body
  if (isFooterLine(lines[pos])) {
    return undefined
  }

  const bodyLines: string[] = []

  // Collect body lines until we hit a footer or end
  while (pos < lines.length) {
    const line = lines[pos]

    // Check if this line looks like a footer
    if (isFooterLine(line)) {
      break
    }

    // Check for blank line followed by a footer
    if (line.trim() === '' && pos + 1 < lines.length && isFooterLine(lines[pos + 1])) {
      break
    }

    bodyLines.push(line)
    pos++
  }

  // Trim trailing blank lines from body
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
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

  // Check for BREAKING CHANGE or BREAKING-CHANGE
  if (trimmed.startsWith('BREAKING CHANGE:') || trimmed.startsWith('BREAKING-CHANGE:')) {
    return true
  }

  // Check for token: value or token #value pattern
  let pos = 0

  // Skip leading whitespace
  while (pos < trimmed.length && trimmed[pos] === ' ') {
    pos++
  }

  // Read token (alphanumeric and hyphens)
  const tokenStart = pos
  while (pos < trimmed.length) {
    const char = trimmed[pos]
    const code = char.charCodeAt(0)

    if (
      (code >= 97 && code <= 122) || // a-z
      (code >= 65 && code <= 90) || // A-Z
      (code >= 48 && code <= 57) || // 0-9
      code === 45 // -
    ) {
      pos++
    } else {
      break
    }
  }

  // Must have at least one character in token
  if (pos === tokenStart) return false

  // Must be followed by : or space-#
  if (trimmed[pos] === ':') {
    return true
  }

  if (trimmed[pos] === ' ' && trimmed[pos + 1] === '#') {
    return true
  }

  return false
}
