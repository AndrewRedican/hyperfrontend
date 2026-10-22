/**
 * Offsets to lines and columns, the way every report names a position: 1-based line, 1-based
 * column, computed from a table of line starts built once per file.
 *
 * @module text/lines
 */

/** A position in a text as reports name it. */
export interface Position {
  /** The 1-based line. */
  readonly line: number
  /** The 1-based column. */
  readonly column: number
}

/** The line structure of one text. */
export interface LineMap {
  /** The offset of each line's first character; the first entry is 0. */
  readonly starts: readonly number[]
  /** The text the map was built from. */
  readonly text: string
}

/** Every line break code knows: `\r\n`, a lone `\r` or `\n`, and the line and paragraph separators. */
const CODE_BREAK = /\r\n?|[\n\u2028\u2029]/g

/**
 * Builds the line map of a text. A line ends at `\n`, and a `\r` before it belongs to the line;
 * for code, a lone `\r` and the line and paragraph separators end a line too.
 *
 * @param text - A file's content, line breaks included
 * @param code - Whether the text is code, which breaks lines at every line terminator
 * @returns The offsets where its lines start
 */
export function lineMap(text: string, code = false): LineMap {
  const starts = [0]
  if (code) {
    for (const match of text.matchAll(CODE_BREAK)) starts.push(match.index + match[0].length)
    return { starts, text }
  }
  let at = text.indexOf('\n')
  while (at !== -1) {
    starts.push(at + 1)
    at = text.indexOf('\n', at + 1)
  }
  return { starts, text }
}

/**
 * The line and column of an offset.
 *
 * @param map - The text's line map
 * @param offset - An offset into the text, up to and including its length
 * @returns The 1-based position
 */
export function positionAt(map: LineMap, offset: number): Position {
  let low = 0
  let high = map.starts.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (map.starts[middle] <= offset) low = middle
    else high = middle - 1
  }
  return { line: low + 1, column: offset - map.starts[low] + 1 }
}

/**
 * The text of a line.
 *
 * @param map - The table `lineMap` built for the file
 * @param line - Which line, counted from 1
 * @returns That line's characters without the break that ends it
 */
export function lineText(map: LineMap, line: number): string {
  const start = map.starts[line - 1]
  const end = line < map.starts.length ? map.starts[line] : map.text.length
  return map.text.slice(start, end).replace(/\r?\n$/, '')
}
