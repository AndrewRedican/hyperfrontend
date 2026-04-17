/**
 * Single-select prompt.
 *
 * @module @hyperfrontend/questions/prompts/select
 */
import type { Terminal } from '../terminal'
import type { PromptOutcome, SelectConfig, Choice } from '../types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { renderMessage, renderSubmitted, renderCancelled, style, Symbol } from '../render'
import { createTerminal, Ansi, Key } from '../terminal'
import { PromptResult } from '../types'

/**
 * Internal state for select prompt.
 *
 * @internal
 */
interface SelectState<T> {
  /** Current cursor position */
  readonly cursor: number
  /** Available choices */
  readonly choices: ReadonlyArray<Choice<T>>
  /** Scroll offset for long lists */
  readonly scrollOffset: number
}

/**
 * Creates initial state for select prompt.
 *
 * @internal
 * @param config - Prompt configuration
 * @returns Initial select state
 */
function createInitialState<T>(config: SelectConfig<T>): SelectState<T> {
  return freeze({
    cursor: config.initial ?? 0,
    choices: config.choices,
    scrollOffset: 0,
  })
}

/**
 * Result of calculating the visible window of choices.
 *
 * @internal
 */
interface VisibleChoicesResult<T> {
  /** Visible choices in current scroll window */
  readonly choices: ReadonlyArray<Choice<T>>
  /** Index of first visible choice */
  readonly startIndex: number
}

/**
 * Calculates the visible window of choices for scrolling.
 *
 * @internal
 * @param state - Current prompt state
 * @param maxVisible - Maximum number of visible choices
 * @returns Visible choices and their start index
 */
function getVisibleChoices<T>(state: SelectState<T>, maxVisible: number): VisibleChoicesResult<T> {
  const total = state.choices.length
  if (total <= maxVisible) {
    return { choices: state.choices, startIndex: 0 }
  }

  let startIndex = state.scrollOffset
  if (state.cursor < startIndex) {
    startIndex = state.cursor
  } else if (state.cursor >= startIndex + maxVisible) {
    startIndex = state.cursor - maxVisible + 1
  }

  return {
    choices: state.choices.slice(startIndex, startIndex + maxVisible),
    startIndex,
  }
}

/**
 * Renders a single choice line with selection styling.
 *
 * @internal
 * @param choice - The choice to render
 * @param isSelected - Whether this choice is selected
 * @param isFocused - Whether cursor is on this choice
 * @returns Formatted choice string
 */
function renderChoice<T>(choice: Choice<T>, isSelected: boolean, isFocused: boolean): string {
  const pointer = isFocused ? style.cyan(Symbol.Pointer) : ' '
  const radio = isSelected ? style.green(Symbol.RadioSelected) : style.dim(Symbol.Radio)

  let label = choice.label
  if (choice.disabled) {
    label = style.dim(label + ' (disabled)')
  } else if (isFocused) {
    label = style.cyan(label)
  }

  const hint = choice.hint ? style.dim(` — ${choice.hint}`) : ''

  return `${pointer} ${radio} ${label}${hint}`
}

/**
 * Renders the select prompt to the terminal.
 *
 * @internal
 * @param term - Terminal interface
 * @param config - Prompt configuration
 * @param state - Current prompt state
 * @param submitted - Whether the prompt has been submitted
 * @returns Number of lines rendered
 */
function render<T>(term: Terminal, config: SelectConfig<T>, state: SelectState<T>, submitted: boolean): number {
  const maxVisible = config.maxVisible ?? 10
  const { choices: visibleChoices, startIndex } = getVisibleChoices(state, maxVisible)

  let output = Ansi.CursorStart + Ansi.ClearLine + renderMessage(config.message)

  if (submitted) {
    const selectedChoice = state.choices[state.cursor]
    /* istanbul ignore next -- @preserve defensive: cursor always within bounds */
    output += renderSubmitted(selectedChoice?.label ?? '')
    term.write(output)
    return 1
  }

  output += style.dim('(use arrows, enter to select)')
  term.write(output + '\n')

  let lineCount = 1
  const showScrollUp = startIndex > 0
  const showScrollDown = startIndex + maxVisible < state.choices.length

  if (showScrollUp) {
    term.write(Ansi.ClearLine + style.dim(`  ${Symbol.Ellipsis} (${startIndex} more above)`) + '\n')
    lineCount++
  }

  visibleChoices.forEach((choice, i) => {
    const actualIndex = startIndex + i
    const isFocused = actualIndex === state.cursor
    const line = renderChoice(choice, isFocused, isFocused)
    term.write(Ansi.ClearLine + line + '\n')
    lineCount++
  })

  if (showScrollDown) {
    const remaining = state.choices.length - (startIndex + maxVisible)
    term.write(Ansi.ClearLine + style.dim(`  ${Symbol.Ellipsis} (${remaining} more below)`) + '\n')
    lineCount++
  }

  return lineCount
}

/**
 * Processes a keypress and returns updated state.
 *
 * @internal
 * @param key - The key that was pressed
 * @param state - Current prompt state
 * @param maxVisible - Maximum visible choices for scroll calculation
 * @returns Updated state after processing the key
 */
function processKey<T>(key: string, state: SelectState<T>, maxVisible: number): SelectState<T> {
  const total = state.choices.length
  if (total === 0) return state

  if (key === Key.Up) {
    let newCursor = state.cursor - 1
    while (newCursor >= 0 && state.choices[newCursor]?.disabled) {
      newCursor--
    }
    if (newCursor < 0) return state

    let newScrollOffset = state.scrollOffset
    if (newCursor < state.scrollOffset) {
      newScrollOffset = newCursor
    }

    return freeze({ ...state, cursor: newCursor, scrollOffset: newScrollOffset })
  }

  if (key === Key.Down) {
    let newCursor = state.cursor + 1
    while (newCursor < total && state.choices[newCursor]?.disabled) {
      newCursor++
    }
    if (newCursor >= total) return state

    let newScrollOffset = state.scrollOffset
    if (newCursor >= state.scrollOffset + maxVisible) {
      newScrollOffset = newCursor - maxVisible + 1
    }

    return freeze({ ...state, cursor: newCursor, scrollOffset: newScrollOffset })
  }

  return state
}

/**
 * Prompts for single selection from a list of choices.
 *
 * Pure functional prompt with arrow key navigation, scrolling support,
 * and optional disabled choices.
 *
 * @param config - Select prompt configuration
 * @returns Promise resolving to selected value or cancellation
 *
 * @example Basic select
 * ```typescript
 * const outcome = await select({
 *   message: 'Choose a color:',
 *   choices: [
 *     { label: 'Red', value: 'red' },
 *     { label: 'Green', value: 'green' },
 *     { label: 'Blue', value: 'blue' },
 *   ],
 * })
 * if (outcome.result === 'submitted') {
 *   console.log(`You chose: ${outcome.value}`)
 * }
 * ```
 *
 * @example With hints and disabled options
 * ```typescript
 * const outcome = await select({
 *   message: 'Select plan:',
 *   choices: [
 *     { label: 'Free', value: 'free', hint: '$0/month' },
 *     { label: 'Pro', value: 'pro', hint: '$10/month' },
 *     { label: 'Enterprise', value: 'enterprise', disabled: true },
 *   ],
 *   initial: 1, // Start on Pro
 * })
 * ```
 */
export async function select<T = string>(config: SelectConfig<T>): Promise<PromptOutcome<T>> {
  const term = createTerminal({ input: config.input, output: config.output })
  const maxVisible = config.maxVisible ?? 10
  let state = createInitialState(config)
  let lineCount = 0

  term.write(Ansi.HideCursor)

  const redraw = (submitted = false): void => {
    if (lineCount > 0) {
      term.write(Ansi.cursorUp(lineCount - 1) + Ansi.CursorStart)
    }
    lineCount = render(term, config, state, submitted)
  }

  redraw()

  while (true) {
    const key = await term.readKey()

    if (term.isCancelled()) {
      if (lineCount > 0) {
        term.write(Ansi.cursorUp(lineCount - 1) + Ansi.CursorStart)
      }
      term.write(Ansi.ClearToEnd)
      term.write(renderMessage(config.message) + renderCancelled() + '\n')
      term.write(Ansi.ShowCursor)
      term.close()
      return freeze({ result: PromptResult.Cancelled, value: undefined })
    }

    if (key === Key.Enter) {
      const selectedChoice = state.choices[state.cursor]
      if (!selectedChoice || selectedChoice.disabled) {
        continue
      }

      if (lineCount > 0) {
        term.write(Ansi.cursorUp(lineCount - 1) + Ansi.CursorStart)
      }
      term.write(Ansi.ClearToEnd)
      render(term, config, state, true)
      term.write('\n')
      term.write(Ansi.ShowCursor)
      term.close()
      return freeze({ result: PromptResult.Submitted, value: selectedChoice.value })
    }

    state = processKey(key, state, maxVisible)
    redraw()
  }
}
