import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * The line width the workspace's formatter wraps at. A transform that writes a
 * line longer than this would be rewritten by the next format pass, so the
 * transforms break such a line themselves and running them twice changes nothing.
 */
export const PRINT_WIDTH = 140

/**
 * A text split into lines, remembering the line ending it was written with so
 * it can be joined back without changing a single byte it did not mean to.
 */
export interface TextLines {
  /** The lines, without their endings */
  lines: string[]
  /** The ending every line was separated by */
  eol: string
}

/**
 * The first and last line of a bracketed block.
 */
export interface BlockBounds {
  /** Index of the line that opens the block */
  open: number
  /** Index of the line that closes the block */
  close: number
}

/**
 * Split a text into lines, keeping the line ending it uses.
 *
 * @param content - The text to split
 * @returns The lines and their ending
 */
export function splitLines(content: string): TextLines {
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  return { lines: content.split(eol), eol }
}

/**
 * Join lines back into a text with the ending they were split from.
 *
 * @param text - The lines and their ending
 * @returns The text
 */
export function joinLines(text: TextLines): string {
  return text.lines.join(text.eol)
}

/**
 * The leading whitespace of a line.
 *
 * @param line - One line of the file
 * @returns Its indentation, empty for a line that starts at the margin
 */
export function indentOf(line: string): string {
  return line.slice(0, line.length - line.trimStart().length)
}

/**
 * Find the first line a predicate accepts.
 *
 * @param lines - The lines to search
 * @param matches - The predicate
 * @param from - The index to start searching at
 * @returns The index of the first matching line, or -1 when none matches
 */
export function findLine(lines: readonly string[], matches: (line: string) => boolean, from: number): number {
  for (let index = from; index < lines.length; index++) {
    if (matches(lines[index] as string)) return index
  }
  return -1
}

/**
 * Locate a block by the line that opens it and the first later line that closes it.
 *
 * @param lines - The lines to search
 * @param opens - Recognises the opening line
 * @param closes - Recognises the closing line
 * @param what - Names the block in the error raised when it is not there
 * @returns The indices of the opening and closing lines
 * @throws {Error} When the block does not open, or opens and never closes
 */
export function blockBounds(
  lines: readonly string[],
  opens: (line: string) => boolean,
  closes: (line: string) => boolean,
  what: string
): BlockBounds {
  const open = findLine(lines, opens, 0)
  if (open === -1) throw createError(`${what}: the block that opens it was not found`)
  const close = findLine(lines, closes, open + 1)
  if (close === -1) throw createError(`${what}: the block opens on line ${open + 1} and never closes`)
  return { open, close }
}

/**
 * Write a value as a single-quoted TypeScript string literal.
 *
 * @param value - The text
 * @returns The literal, with backslashes and quotes escaped
 */
export function quote(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}
