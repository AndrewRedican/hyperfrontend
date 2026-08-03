/**
 * Text input prompt.
 *
 * @module @hyperfrontend/questions/prompts/text
 */
import type { ScreenFrame } from '../screen'
import type { PromptOutcome, TextConfig } from '../types'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { displayWidth } from '../ansi-text'
import { sanitizePasteText } from '../paste'
import { renderMessage, renderSubmitted, renderCancelled, style } from '../render'
import { createScreen } from '../screen'
import { createTerminal, Key } from '../terminal'
import { TokenType } from '../token-parser'
import { PromptResult } from '../types'

/**
 * Internal state for text prompt.
 *
 * @internal
 */
interface TextState {
  /** Current input value */
  value: string
  /** Cursor position within the input */
  cursorPos: number
  /** Current validation error message if any */
  error: string | undefined
}

/**
 * Creates initial state for text prompt.
 *
 * @internal
 * @param config - Prompt configuration containing initial value
 * @returns Initial text state object
 */
function createInitialState(config: TextConfig): TextState {
  return {
    value: config.initial ?? '',
    cursorPos: (config.initial ?? '').length,
    error: undefined,
  }
}

/**
 * Builds the current prompt message text.
 *
 * @internal
 * @param config - Prompt configuration
 * @param value - Current input value
 * @returns Message text for the current value
 */
function messageText(config: TextConfig, value: string): string {
  return config.renderMessage ? config.renderMessage(value) : config.message
}

/**
 * Builds the frame for the text prompt.
 *
 * @internal
 * @param config - Prompt configuration
 * @param state - Current prompt state
 * @param submitted - Whether the prompt has been submitted
 * @returns Frame describing lines and cursor position
 */
function buildFrame(config: TextConfig, state: TextState, submitted: boolean): ScreenFrame {
  const displayValue = config.format ? config.format(state.value) : state.value

  let line = renderMessage(messageText(config, state.value))

  if (submitted) {
    line += renderSubmitted(displayValue || config.initial || '')
    return freeze({ lines: freeze([line]) })
  }

  line += displayValue
  let trailingWidth = displayWidth(state.value.slice(state.cursorPos))
  if (config.initial && !state.value) {
    line += style.dim(config.initial)
    trailingWidth += displayWidth(config.initial)
  }

  const cursor = freeze({ line: 0, col: displayWidth(line) - trailingWidth })
  if (state.error) {
    return freeze({ lines: freeze([line, style.yellow(`  ${state.error}`)]), cursor })
  }
  return freeze({ lines: freeze([line]), cursor })
}

/**
 * Inserts text at the cursor position, moving the cursor past it.
 *
 * @internal
 * @param insert - Text to insert (already sanitized for pastes)
 * @param state - Current prompt state
 * @returns Updated state after insertion
 */
function insertText(insert: string, state: TextState): TextState {
  if (insert === '') return state
  const before = state.value.slice(0, state.cursorPos)
  const after = state.value.slice(state.cursorPos)
  return {
    ...state,
    value: before + insert + after,
    cursorPos: state.cursorPos + insert.length,
    error: undefined,
  }
}

/**
 * Processes a keypress and returns updated state.
 *
 * @internal
 * @param key - The key that was pressed
 * @param state - Current prompt state
 * @returns Updated state after processing the key
 */
function processKey(key: string, state: TextState): TextState {
  if (key.length === 1 && key >= ' ' && key !== Key.Backspace) {
    return insertText(key, state)
  }

  if (key === Key.Backspace || key === '\b') {
    if (state.cursorPos > 0) {
      const before = state.value.slice(0, state.cursorPos - 1)
      const after = state.value.slice(state.cursorPos)
      return {
        ...state,
        value: before + after,
        cursorPos: state.cursorPos - 1,
        error: undefined,
      }
    }
  }

  if (key === Key.Left) {
    return {
      ...state,
      cursorPos: max(0, state.cursorPos - 1),
    }
  }

  if (key === Key.Right) {
    return {
      ...state,
      cursorPos: min(state.value.length, state.cursorPos + 1),
    }
  }

  return state
}

/**
 * Prompts for text input with optional validation.
 *
 * Pure functional prompt that reads text from the user with support for
 * default values, input validation, and display formatting. Pasted text is
 * sanitized (newlines collapse to spaces, control characters are removed)
 * and inserted at the cursor without ever auto-submitting. The prompt
 * repaints on terminal resize, preserving value, cursor, and any
 * validation error.
 *
 * @param config - Text prompt configuration
 * @returns Promise resolving to submitted value or cancellation
 *
 * @example Basic text input
 * ```typescript
 * const outcome = await text({ message: 'What is your name?' })
 * if (outcome.result === 'submitted') {
 *   console.log(`Hello, ${outcome.value}!`)
 * }
 * ```
 *
 * @example With validation
 * ```typescript
 * const outcome = await text({
 *   message: 'Enter email:',
 *   validate: (value) => {
 *     if (!value.includes('@')) return 'Must be a valid email'
 *     return undefined
 *   },
 * })
 * ```
 *
 * @example Password input with masking
 * ```typescript
 * const outcome = await text({
 *   message: 'Password:',
 *   format: (value) => '*'.repeat(value.length),
 * })
 * ```
 */
export async function text(config: TextConfig): Promise<PromptOutcome<string>> {
  const term = createTerminal({ input: config.input, output: config.output })
  const screen = createScreen(term)
  let state = createInitialState(config)

  const redraw = (submitted = false): void => {
    screen.render(buildFrame(config, state, submitted))
  }

  try {
    redraw()

    while (true) {
      const token = await term.readToken()

      if (term.isCancelled()) {
        screen.render(freeze({ lines: freeze([renderMessage(messageText(config, state.value)) + renderCancelled()]) }))
        term.write('\n')
        return freeze({ result: PromptResult.Cancelled, value: undefined })
      }

      if (token.type === TokenType.Resize) {
        redraw()
        continue
      }

      if (token.type === TokenType.Paste) {
        state = insertText(sanitizePasteText(token.value), state)
        redraw()
        continue
      }

      if (token.value === Key.Enter) {
        const value = state.value || config.initial || ''

        if (config.validate) {
          const errorMessage = config.validate(value)
          if (errorMessage) {
            state = { ...state, error: errorMessage }
            redraw()
            continue
          }
        }

        redraw(true)
        term.write('\n')
        return freeze({ result: PromptResult.Submitted, value })
      }

      state = processKey(token.value, state)
      redraw()
    }
  } finally {
    term.close()
  }
}
