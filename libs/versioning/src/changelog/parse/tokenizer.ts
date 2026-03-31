import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Token Types
 */
export type TokenType =
  | 'heading-1' // #
  | 'heading-2' // ##
  | 'heading-3' // ###
  | 'heading-4' // ####
  | 'list-item' // - or *
  | 'link-text' // [text]
  | 'link-url' // (url)
  | 'text' // Plain text
  | 'newline' // \n
  | 'blank-line' // Empty line
  | 'bold' // **text**
  | 'code' // `code`
  | 'eof' // End of file

/**
 * Represents a single parsed token from the changelog markdown.
 */
export interface Token {
  readonly type: TokenType
  readonly value: string
  readonly line: number
  readonly column: number
}

/**
 * Internal state used during tokenization to track position and collect tokens.
 */
interface TokenizerState {
  pos: number
  line: number
  column: number
  input: string
  tokens: Token[]
}

/**
 * Maximum input length to prevent memory exhaustion (1MB)
 */
const MAX_INPUT_LENGTH = 1024 * 1024

/**
 * Tokenizes a changelog markdown string into tokens.
 *
 * @param input - The markdown content to tokenize
 * @returns Array of tokens
 * @throws {Error} If input exceeds maximum length
 */
export function tokenize(input: string): Token[] {
  if (input.length > MAX_INPUT_LENGTH) {
    throw createError(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`)
  }

  const state: TokenizerState = {
    pos: 0,
    line: 1,
    column: 1,
    input,
    tokens: [],
  }

  while (state.pos < state.input.length) {
    const char = state.input[state.pos]

    // Check for newline
    if (char === '\n') {
      consumeNewline(state)
      continue
    }

    // Check for carriage return (handle \r\n)
    if (char === '\r') {
      state.pos++
      if (state.input[state.pos] === '\n') {
        consumeNewline(state)
      }
      continue
    }

    // At start of line, check for special markers
    if (state.column === 1) {
      // Check for heading
      if (char === '#') {
        consumeHeading(state)
        continue
      }

      // Check for list item
      if ((char === '-' || char === '*') && isWhitespace(state.input[state.pos + 1])) {
        consumeListItem(state)
        continue
      }
    }

    // Check for inline markdown elements
    if (char === '[') {
      consumeLink(state)
      continue
    }

    if (char === '`') {
      consumeCode(state)
      continue
    }

    if (char === '*' && state.input[state.pos + 1] === '*') {
      consumeBold(state)
      continue
    }

    // Default: consume as text
    consumeText(state)
  }

  // Add EOF token
  pushToken(state, 'eof', '')

  return state.tokens
}

/**
 * Consumes a newline character.
 *
 * @param state - The tokenizer state to update
 */
function consumeNewline(state: TokenizerState): void {
  // Check if this is a blank line (previous token was also newline or at start)
  const prevToken = state.tokens[state.tokens.length - 1]
  const isBlank = prevToken?.type === 'newline' || prevToken?.type === 'blank-line' || state.tokens.length === 0

  pushToken(state, isBlank ? 'blank-line' : 'newline', '\n')
  state.pos++
  state.line++
  state.column = 1
}

/**
 * Consumes a heading (# through ####).
 *
 * @param state - The tokenizer state to update
 */
function consumeHeading(state: TokenizerState): void {
  const startColumn = state.column
  let level = 0

  // Count # characters
  while (state.input[state.pos] === '#' && level < 4) {
    state.pos++
    state.column++
    level++
  }

  // Skip whitespace after #
  while (isWhitespace(state.input[state.pos]) && state.input[state.pos] !== '\n') {
    state.pos++
    state.column++
  }

  // Consume the rest of the line as heading content
  const contentStart = state.pos
  while (state.pos < state.input.length && state.input[state.pos] !== '\n') {
    state.pos++
    state.column++
  }

  const content = state.input.slice(contentStart, state.pos)
  const type = <TokenType>`heading-${level}`

  state.tokens.push({
    type,
    value: content.trim(),
    line: state.line,
    column: startColumn,
  })
}

/**
 * Consumes a list item (- or *).
 *
 * @param state - The tokenizer state to update
 */
function consumeListItem(state: TokenizerState): void {
  const startColumn = state.column

  // Skip the marker and whitespace
  state.pos++ // skip - or *
  state.column++

  while (isWhitespace(state.input[state.pos]) && state.input[state.pos] !== '\n') {
    state.pos++
    state.column++
  }

  // Consume the rest of the line as list item content
  const contentStart = state.pos
  while (state.pos < state.input.length && state.input[state.pos] !== '\n') {
    state.pos++
    state.column++
  }

  const content = state.input.slice(contentStart, state.pos)

  state.tokens.push({
    type: 'list-item',
    value: content,
    line: state.line,
    column: startColumn,
  })
}

/**
 * Consumes a markdown link [text](url).
 *
 * @param state - The tokenizer state to update
 */
function consumeLink(state: TokenizerState): void {
  const startColumn = state.column
  const startLine = state.line

  // Skip opening [
  state.pos++
  state.column++

  // Find closing ]
  const textStart = state.pos
  let depth = 1
  while (state.pos < state.input.length && depth > 0) {
    const char = state.input[state.pos]
    if (char === '[') depth++
    else if (char === ']') depth--
    else if (char === '\n') {
      // Link text shouldn't span lines; emit '[' as text and reset
      state.tokens.push({
        type: 'text',
        value: '[',
        line: startLine,
        column: startColumn,
      })
      state.pos = textStart
      state.column = startColumn + 1
      return
    }
    if (depth > 0) {
      state.pos++
      state.column++
    }
  }

  if (depth !== 0) {
    // No closing ], emit '[' as text and reset
    state.tokens.push({
      type: 'text',
      value: '[',
      line: startLine,
      column: startColumn,
    })
    state.pos = textStart
    state.column = startColumn + 1
    return
  }

  const linkText = state.input.slice(textStart, state.pos)
  state.pos++ // skip ]
  state.column++

  // Check for (url)
  if (state.input[state.pos] === '(') {
    state.pos++ // skip (
    state.column++

    const urlStart = state.pos
    depth = 1
    while (state.pos < state.input.length && depth > 0) {
      const char = state.input[state.pos]
      if (char === '(') depth++
      else if (char === ')') depth--
      else if (char === '\n') {
        // URL shouldn't span lines
        break
      }
      if (depth > 0) {
        state.pos++
        state.column++
      }
    }

    if (depth === 0) {
      const linkUrl = state.input.slice(urlStart, state.pos)
      state.pos++ // skip )
      state.column++

      // Emit link-text token
      state.tokens.push({
        type: 'link-text',
        value: linkText,
        line: startLine,
        column: startColumn,
      })

      // Emit link-url token
      state.tokens.push({
        type: 'link-url',
        value: linkUrl,
        line: startLine,
        column: startColumn + linkText.length + 3,
      })
      return
    }
  }

  // No URL part, emit as text
  state.tokens.push({
    type: 'text',
    value: `[${linkText}]`,
    line: startLine,
    column: startColumn,
  })
}

/**
 * Consumes a code span `code`.
 *
 * @param state - The tokenizer state to update
 */
function consumeCode(state: TokenizerState): void {
  const startColumn = state.column
  const startLine = state.line

  state.pos++ // skip opening `
  state.column++

  const contentStart = state.pos
  while (state.pos < state.input.length && state.input[state.pos] !== '`' && state.input[state.pos] !== '\n') {
    state.pos++
    state.column++
  }

  if (state.input[state.pos] === '`') {
    const content = state.input.slice(contentStart, state.pos)
    state.pos++ // skip closing `
    state.column++

    state.tokens.push({
      type: 'code',
      value: content,
      line: startLine,
      column: startColumn,
    })
  } else {
    // No closing `, emit as text
    state.tokens.push({
      type: 'text',
      value: '`' + state.input.slice(contentStart, state.pos),
      line: startLine,
      column: startColumn,
    })
  }
}

/**
 * Consumes bold text **text**.
 *
 * @param state - The tokenizer state to update
 */
function consumeBold(state: TokenizerState): void {
  const startColumn = state.column
  const startLine = state.line

  state.pos += 2 // skip opening **
  state.column += 2

  const contentStart = state.pos
  while (state.pos < state.input.length) {
    // Check for closing **
    if (state.input[state.pos] === '*' && state.input[state.pos + 1] === '*') {
      break
    }
    if (state.input[state.pos] === '\n') {
      state.line++
      state.column = 0
    }
    state.pos++
    state.column++
  }

  if (state.input[state.pos] === '*' && state.input[state.pos + 1] === '*') {
    const content = state.input.slice(contentStart, state.pos)
    state.pos += 2 // skip closing **
    state.column += 2

    state.tokens.push({
      type: 'bold',
      value: content,
      line: startLine,
      column: startColumn,
    })
  } else {
    // No closing **, emit as text
    state.tokens.push({
      type: 'text',
      value: '**' + state.input.slice(contentStart, state.pos),
      line: startLine,
      column: startColumn,
    })
  }
}

/**
 * Consumes plain text until a special character or end of line.
 *
 * @param state - The tokenizer state to update
 */
function consumeText(state: TokenizerState): void {
  const startColumn = state.column
  const startLine = state.line
  const startPos = state.pos

  while (state.pos < state.input.length) {
    const char = state.input[state.pos]

    // Stop at newline
    if (char === '\n' || char === '\r') {
      break
    }

    // Stop at special characters (but only if they start a pattern)
    if (char === '[') break
    if (char === '`') break
    if (char === '*' && state.input[state.pos + 1] === '*') break

    state.pos++
    state.column++
  }

  const content = state.input.slice(startPos, state.pos)
  if (content.length > 0) {
    state.tokens.push({
      type: 'text',
      value: content,
      line: startLine,
      column: startColumn,
    })
  }
}

/**
 * Pushes a token to the state.
 *
 * @param state - The tokenizer state to update
 * @param type - Token classification (e.g., 'heading-1', 'text', 'link-url')
 * @param value - Text content associated with the token
 */
function pushToken(state: TokenizerState, type: TokenType, value: string): void {
  state.tokens.push({
    type,
    value,
    line: state.line,
    column: state.column,
  })
}

/**
 * Checks if a character is whitespace (but not newline).
 *
 * @param char - The character to check
 * @returns True if the character is whitespace (space or tab)
 */
function isWhitespace(char: string | undefined): boolean {
  return char === ' ' || char === '\t'
}

/**
 * Checks if a character is a letter (a-z, A-Z).
 *
 * @param char - The character to check
 * @returns True if the character is a letter
 */
export function isLetter(char: string | undefined): boolean {
  if (!char) return false
  const code = char.charCodeAt(0)
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122)
}

/**
 * Checks if a character is a digit (0-9).
 *
 * @param char - The character to check
 * @returns True if the character is a digit
 */
export function isDigit(char: string | undefined): boolean {
  if (!char) return false
  const code = char.charCodeAt(0)
  return code >= 48 && code <= 57
}

/**
 * Checks if a character is alphanumeric.
 *
 * @param char - The character to check
 * @returns True if the character is alphanumeric
 */
export function isAlphanumeric(char: string | undefined): boolean {
  return isLetter(char) || isDigit(char)
}
