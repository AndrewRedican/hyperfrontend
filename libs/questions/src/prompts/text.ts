/**
 * Text input prompt.
 *
 * @module @hyperfrontend/questions/prompts/text
 */
import type { Terminal } from '../terminal'
import type { PromptOutcome, TextConfig } from '../types'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { renderMessage, renderSubmitted, renderCancelled, style } from '../render'
import { createTerminal, Ansi, Key } from '../terminal'
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
 * Renders the text prompt to the terminal.
 *
 * @internal
 * @param term - Terminal interface for output
 * @param config - Prompt configuration
 * @param state - Current prompt state
 * @param submitted - Whether the prompt has been submitted
 * @returns Number of lines rendered
 */
function render(term: Terminal, config: TextConfig, state: TextState, submitted: boolean): number {
  const displayValue = config.format ? config.format(state.value) : state.value
  const messageText = config.renderMessage ? config.renderMessage(state.value) : config.message

  let output = renderMessage(messageText)
  let trailingChars = 0

  if (submitted) {
    output += renderSubmitted(displayValue || config.initial || '')
  } else {
    output += displayValue
    trailingChars = displayValue.length - state.cursorPos
    if (config.initial && !state.value) {
      output += style.dim(config.initial)
      trailingChars += config.initial.length
    }
  }

  term.write(Ansi.CursorStart + Ansi.ClearLine + output)

  if (state.error) {
    term.write('\n' + style.yellow(`  ${state.error}`))
    return 2
  }

  if (!submitted && trailingChars > 0) {
    term.write(Ansi.cursorLeft(trailingChars))
  }

  return 1
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
    const before = state.value.slice(0, state.cursorPos)
    const after = state.value.slice(state.cursorPos)
    return {
      ...state,
      value: before + key + after,
      cursorPos: state.cursorPos + 1,
      error: undefined,
    }
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
 * default values, input validation, and display formatting.
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
  let state = createInitialState(config)
  let lineCount = 0

  const redraw = (submitted = false): void => {
    if (lineCount > 0) {
      term.clearLines(lineCount)
    }
    lineCount = render(term, config, state, submitted)
  }

  redraw()

  while (true) {
    const key = await term.readKey()

    if (term.isCancelled()) {
      redraw()
      term.write(renderCancelled() + '\n')
      term.close()
      return freeze({ result: PromptResult.Cancelled, value: undefined })
    }

    if (key === Key.Enter) {
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
      term.close()
      return freeze({ result: PromptResult.Submitted, value })
    }

    state = processKey(key, state)
    redraw()
  }
}
