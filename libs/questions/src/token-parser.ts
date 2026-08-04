/**
 * Incremental parser turning raw terminal input chunks into input tokens.
 *
 * Handles bracketed paste bodies (accumulated across chunks between
 * `ESC[200~` and `ESC[201~`), escape-sequence keys, and printable runs.
 * A multi-character printable run outside bracketed paste is treated as a
 * paste from a terminal without bracketed-paste support.
 *
 * @internal
 */
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { Esc, matchAnsiSequence } from './ansi-text'

/** Control character sent by Ctrl+C in raw mode. */
const CtrlC = '\x03'

/** Sequence a bracketed-paste-aware terminal sends before pasted content. */
const PasteStart = '\x1B[200~'

/** Sequence a bracketed-paste-aware terminal sends after pasted content. */
const PasteEnd = '\x1B[201~'

/**
 * Kinds of tokens produced while reading terminal input.
 */
export const TokenType = freeze(<const>{
  /** A single keypress (character or escape sequence) */
  Key: 'key',
  /** A block of pasted text */
  Paste: 'paste',
  /** The output terminal was resized */
  Resize: 'resize',
})

/** Kind of an input token. */
export type TokenType = (typeof TokenType)[keyof typeof TokenType]

/**
 * A single keypress: one printable character or one escape sequence.
 */
export interface KeyToken {
  /** Token discriminator */
  readonly type: typeof TokenType.Key
  /** The key's character or escape sequence */
  readonly value: string
}

/**
 * A block of pasted text. The value is raw: it may contain newlines and
 * control characters that prompts sanitize before use.
 */
export interface PasteToken {
  /** Token discriminator */
  readonly type: typeof TokenType.Paste
  /** Raw pasted text */
  readonly value: string
}

/**
 * Notification that the output terminal was resized.
 */
export interface ResizeToken {
  /** Token discriminator */
  readonly type: typeof TokenType.Resize
}

/** Token produced while reading terminal input. */
export type InputToken = KeyToken | PasteToken | ResizeToken

/**
 * Stateful chunk-to-token parser. State (partial escape sequences and open
 * bracketed-paste bodies) carries across `feed` calls.
 */
export interface TokenParser {
  /**
   * Parses one raw input chunk into zero or more tokens.
   *
   * @param chunk - Raw text received from the input stream
   * @returns Tokens completed by this chunk
   */
  readonly feed: (chunk: string) => ReadonlyArray<InputToken>
}

/**
 * Builds a key token.
 *
 * @param value - Key character or escape sequence
 * @returns Frozen key token
 */
function keyToken(value: string): KeyToken {
  return freeze({ type: TokenType.Key, value })
}

/**
 * Builds a paste token.
 *
 * @param value - Raw pasted text
 * @returns Frozen paste token
 */
function pasteToken(value: string): PasteToken {
  return freeze({ type: TokenType.Paste, value })
}

/**
 * Finds where a trailing partial occurrence of `marker` starts in `data`,
 * scanning no earlier than `from`. Used to hold back a possible split
 * bracketed-paste end marker until the next chunk arrives.
 *
 * @param data - Buffered input text
 * @param from - First position that may be held back
 * @param marker - Marker whose prefix may be split across chunks
 * @returns Index where the partial marker starts, or `data.length` when the
 *   text does not end with a marker prefix
 */
function partialMarkerStart(data: string, from: number, marker: string): number {
  const maxLength = min(marker.length - 1, data.length - from)
  for (let k = maxLength; k >= 1; k--) {
    if (data.endsWith(marker.slice(0, k))) {
      return data.length - k
    }
  }
  return data.length
}

/**
 * Creates an incremental input tokenizer.
 *
 * Escape sequences split across chunks are buffered until complete; a lone
 * trailing escape is likewise buffered (prompts do not act on a bare Escape
 * key, so delaying it until the next chunk is unobservable). Ctrl+C outside
 * a bracketed paste is always its own key token; inside a paste body it is
 * plain data.
 *
 * @returns Stateful token parser
 *
 * @example Parsing a paste split across two chunks
 * ```typescript
 * const parser = createTokenParser()
 * parser.feed('\x1B[200~hello ')
 * // => []
 * parser.feed('world\x1B[201~')
 * // => [{ type: 'paste', value: 'hello world' }]
 * ```
 */
export function createTokenParser(): TokenParser {
  let carry = ''
  let pasteBuffer: string | undefined

  const feed = (chunk: string): ReadonlyArray<InputToken> => {
    const data = carry + chunk
    carry = ''
    const tokens: InputToken[] = []
    let pos = 0

    while (pos < data.length) {
      if (pasteBuffer !== undefined) {
        const endIndex = data.indexOf(PasteEnd, pos)
        if (endIndex >= 0) {
          tokens.push(pasteToken(pasteBuffer + data.slice(pos, endIndex)))
          pasteBuffer = undefined
          pos = endIndex + PasteEnd.length
          continue
        }
        const holdFrom = partialMarkerStart(data, pos, PasteEnd)
        pasteBuffer += data.slice(pos, holdFrom)
        carry = data.slice(holdFrom)
        break
      }

      const char = data.charAt(pos)

      if (char === Esc) {
        const match = matchAnsiSequence(data, pos)
        if (!match.complete) {
          carry = data.slice(pos)
          break
        }
        const sequence = data.slice(pos, pos + match.length)
        pos += match.length
        if (sequence === PasteStart) {
          pasteBuffer = ''
          continue
        }
        // why: a stray end marker without a matching start carries no content
        if (sequence === PasteEnd) continue
        tokens.push(keyToken(sequence))
        continue
      }

      if (char === CtrlC) {
        tokens.push(keyToken(char))
        pos++
        continue
      }

      let end = pos + 1
      while (end < data.length && data.charAt(end) !== Esc && data.charAt(end) !== CtrlC) {
        end++
      }
      const run = data.slice(pos, end)
      // why: raw mode delivers one keystroke per chunk, so a longer run means the terminal pasted without bracketed-paste support
      tokens.push(run.length === 1 ? keyToken(run) : pasteToken(run))
      pos = end
    }

    return freeze(tokens)
  }

  return freeze({ feed })
}
