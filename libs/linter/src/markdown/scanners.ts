/**
 * Hand-written scanners for the grammar fragments a regular expression would express with
 * nested repetition: HTML tags, domains and email addresses. Each reads from an offset and
 * answers with the offset after what it matched, or -1.
 *
 * @module markdown/scanners
 */

// why: the character classes the HTML and address grammars are built from.
const isLetter = (char: string | undefined): boolean => char !== undefined && /[A-Za-z]/.test(char)

const isAlphanumeric = (char: string | undefined): boolean => char !== undefined && /[A-Za-z0-9]/.test(char)

const isWhitespace = (char: string | undefined): boolean => char !== undefined && /\s/.test(char)

const isOneOf = (set: string, char: string | undefined): boolean => char !== undefined && set.includes(char)

/**
 * The end of a tag name at an offset: a letter, then letters, digits and hyphens.
 *
 * @param text - The text being scanned
 * @param at - Where the name would start
 * @returns The offset after the name, or -1
 */
function tagNameEnd(text: string, at: number): number {
  if (!isLetter(text[at])) return -1
  let index = at + 1
  while (isAlphanumeric(text[index]) || text[index] === '-') index += 1
  return index
}

/**
 * The end of an open tag at an offset: `<`, a name, attributes, optional `/`, then `>`.
 *
 * @param text - The text being scanned
 * @param at - The offset of the opening angle bracket, which the caller has seen
 * @returns The offset after the `>`, or -1
 *
 * @example Measure a self-closing tag with quoted attributes
 * ```ts
 * openTagEnd('<img src="logo.png" alt="Logo"/> after', 0) // => 32
 * openTagEnd('<a href="x"class="y">', 0) // => -1 (attributes need a space)
 * ```
 */
export function openTagEnd(text: string, at: number): number {
  let index = tagNameEnd(text, at + 1)
  if (index === -1) return -1
  for (;;) {
    const beforeSpace = index
    while (isWhitespace(text[index])) index += 1
    const char = text[index]
    if (char === '/' && text[index + 1] === '>') return index + 2
    if (char === '>') return index + 1
    if (index === beforeSpace || char === undefined || !(isLetter(char) || char === '_' || char === ':')) return -1
    index += 1
    while (isAlphanumeric(text[index]) || isOneOf('_.:-', text[index])) index += 1
    let valueAt = index
    while (isWhitespace(text[valueAt])) valueAt += 1
    if (text[valueAt] !== '=') continue
    valueAt += 1
    while (isWhitespace(text[valueAt])) valueAt += 1
    const quote = text[valueAt]
    if (quote === '"' || quote === "'") {
      const close = text.indexOf(quote, valueAt + 1)
      if (close === -1) return -1
      index = close + 1
    } else {
      const start = valueAt
      while (text[valueAt] !== undefined && !isWhitespace(text[valueAt]) && !isOneOf('"\'=<>`', text[valueAt])) valueAt += 1
      if (valueAt === start) return -1
      index = valueAt
    }
  }
}

/**
 * The end of a closing tag at an offset: `</`, a name, whitespace, `>`.
 *
 * @param text - The text being scanned
 * @param at - The offset of the opening angle bracket, which the caller has seen with its slash
 * @returns The offset after the `>`, or -1
 *
 * @example Allow whitespace before the bracket but not after the slash
 * ```ts
 * closingTagEnd('</details  > more', 0) // => 12
 * closingTagEnd('</ details>', 0) // => -1
 * ```
 */
export function closingTagEnd(text: string, at: number): number {
  let index = tagNameEnd(text, at + 2)
  if (index === -1) return -1
  while (isWhitespace(text[index])) index += 1
  return text[index] === '>' ? index + 1 : -1
}

/**
 * The end of a domain at an offset: labels of letters, digits, hyphens and underscores joined
 * by dots, a dot never last.
 *
 * @param text - The text being scanned
 * @param at - Where the domain would start
 * @returns The offset after the domain, or -1 when no label starts there
 *
 * @example Stop before a sentence's final dot
 * ```ts
 * domainEnd('docs.example.com. Next', 0) // => 16
 * domainEnd('.com', 0) // => -1
 * ```
 */
export function domainEnd(text: string, at: number): number {
  const isLabel = (char: string | undefined): boolean => isAlphanumeric(char) || char === '-' || char === '_'
  if (!isLabel(text[at])) return -1
  let index = at
  for (;;) {
    while (isLabel(text[index])) index += 1
    if (text[index] !== '.' || !isLabel(text[index + 1])) return index
    index += 1
  }
}

/**
 * The end of the local part of an email address at an offset: letters, digits and `._+-`.
 *
 * @param text - The text being scanned
 * @param at - Where it would start
 * @returns The offset after it, or -1 when it is empty
 *
 * @example Find the local part ahead of the at sign
 * ```ts
 * localPartEnd('jane.doe+news@example.com', 0) // => 13
 * localPartEnd('@example.com', 0) // => -1
 * ```
 */
export function localPartEnd(text: string, at: number): number {
  let index = at
  while (isAlphanumeric(text[index]) || isOneOf('._+-', text[index])) index += 1
  return index === at ? -1 : index
}
