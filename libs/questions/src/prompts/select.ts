/**
 * Single-select prompt with optional search/filter.
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
  /** Current cursor position within filtered choices */
  readonly cursor: number
  /** All available choices */
  readonly choices: ReadonlyArray<Choice<T>>
  /** Filtered indices based on search query */
  readonly filteredIndices: ReadonlyArray<number>
  /** Current search query */
  readonly searchQuery: string
  /** Scroll offset for long lists */
  readonly scrollOffset: number
}

/**
 * Filters choices based on search query.
 *
 * @internal
 * @param choices - All available choices
 * @param query - Search query string
 * @returns Array of indices matching the query
 */
function filterChoices<T>(choices: ReadonlyArray<Choice<T>>, query: string): ReadonlyArray<number> {
  if (!query) {
    return choices.map((_, i) => i)
  }

  const lowerQuery = query.toLowerCase()
  const indices: number[] = []
  choices.forEach((choice, i) => {
    if (choice.label.toLowerCase().includes(lowerQuery)) {
      indices.push(i)
    }
  })
  return freeze(indices)
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
    filteredIndices: config.choices.map((_, i) => i),
    searchQuery: '',
    scrollOffset: 0,
  })
}

/**
 * Result of calculating the visible window of choices.
 *
 * @internal
 */
interface VisibleIndicesResult {
  /** Indices of visible choices in current scroll window */
  readonly indices: ReadonlyArray<number>
  /** Index of first visible choice */
  readonly startIndex: number
}

/**
 * Calculates the visible window of choices for scrolling.
 *
 * @internal
 * @param state - Current prompt state
 * @param maxVisible - Maximum number of visible choices
 * @returns Object containing visible indices and start index
 */
function getVisibleChoices<T>(state: SelectState<T>, maxVisible: number): VisibleIndicesResult {
  const total = state.filteredIndices.length
  if (total <= maxVisible) {
    return { indices: state.filteredIndices, startIndex: 0 }
  }

  let startIndex = state.scrollOffset
  if (state.cursor < startIndex) {
    startIndex = state.cursor
  } else if (state.cursor >= startIndex + maxVisible) {
    startIndex = state.cursor - maxVisible + 1
  }

  return {
    indices: state.filteredIndices.slice(startIndex, startIndex + maxVisible),
    startIndex,
  }
}

/**
 * Renders a single choice line with selection styling.
 *
 * @internal
 * @param choice - The choice to render
 * @param isFocused - Whether cursor is on this choice
 * @returns Formatted choice string
 */
function renderChoice<T>(choice: Choice<T>, isFocused: boolean): string {
  const pointer = isFocused ? style.cyan(Symbol.Pointer) : ' '
  const radio = isFocused ? style.green(Symbol.RadioSelected) : style.dim(Symbol.Radio)

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
  const { indices: visibleIndices, startIndex } = getVisibleChoices(state, maxVisible)

  let output = Ansi.CursorStart + Ansi.ClearLine + renderMessage(config.message)

  if (submitted) {
    const actualIndex = state.filteredIndices[state.cursor]
    const selectedChoice = actualIndex !== undefined ? state.choices[actualIndex] : undefined
    /* istanbul ignore next -- @preserve defensive: cursor always within bounds */
    output += renderSubmitted(selectedChoice?.label ?? '')
    term.write(output)
    return 1
  }

  if (config.searchable && state.searchQuery) {
    output += style.cyan(state.searchQuery) + style.dim(' (type to filter)')
  } else if (config.searchable) {
    output += style.dim('(type to filter, enter to select)')
  } else {
    output += style.dim('(use arrows, enter to select)')
  }
  term.write(output + '\n')

  let lineCount = 1
  const showScrollUp = startIndex > 0
  const showScrollDown = startIndex + maxVisible < state.filteredIndices.length

  if (showScrollUp) {
    term.write(Ansi.ClearLine + style.dim(`  ${Symbol.Ellipsis} (${startIndex} more above)`) + '\n')
    lineCount++
  }

  visibleIndices.forEach((actualIndex, i) => {
    const choice = state.choices[actualIndex]
    /* istanbul ignore if -- @preserve defensive: actualIndex always valid from filteredIndices */
    if (!choice) return

    const viewIndex = startIndex + i
    const isFocused = viewIndex === state.cursor
    const line = renderChoice(choice, isFocused)
    term.write(Ansi.ClearLine + line + '\n')
    lineCount++
  })

  if (showScrollDown) {
    const remaining = state.filteredIndices.length - (startIndex + maxVisible)
    term.write(Ansi.ClearLine + style.dim(`  ${Symbol.Ellipsis} (${remaining} more below)`) + '\n')
    lineCount++
  }

  if (state.filteredIndices.length === 0 && config.searchable) {
    term.write(Ansi.ClearLine + style.dim('  No matches found') + '\n')
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
 * @param config - Prompt configuration
 * @returns Updated state after processing the key
 */
function processKey<T>(key: string, state: SelectState<T>, config: SelectConfig<T>): SelectState<T> {
  const maxVisible = config.maxVisible ?? 10
  const total = state.filteredIndices.length
  if (total === 0 && key !== Key.Backspace && key !== '\b') return state

  if (key === Key.Up) {
    let newCursor = state.cursor - 1
    while (newCursor >= 0 && state.choices[state.filteredIndices[newCursor] ?? -1]?.disabled) {
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
    while (newCursor < total && state.choices[state.filteredIndices[newCursor] ?? -1]?.disabled) {
      newCursor++
    }
    if (newCursor >= total) return state

    let newScrollOffset = state.scrollOffset
    if (newCursor >= state.scrollOffset + maxVisible) {
      newScrollOffset = newCursor - maxVisible + 1
    }

    return freeze({ ...state, cursor: newCursor, scrollOffset: newScrollOffset })
  }

  if (config.searchable) {
    if (key === Key.Backspace || key === '\b') {
      if (state.searchQuery.length > 0) {
        const newQuery = state.searchQuery.slice(0, -1)
        const newFiltered = filterChoices(state.choices, newQuery)
        return freeze({
          ...state,
          searchQuery: newQuery,
          filteredIndices: newFiltered,
          cursor: 0,
          scrollOffset: 0,
        })
      }
      return state
    }

    if (key.length === 1 && key >= ' ') {
      const newQuery = state.searchQuery + key
      const newFiltered = filterChoices(state.choices, newQuery)
      return freeze({
        ...state,
        searchQuery: newQuery,
        filteredIndices: newFiltered,
        cursor: 0,
        scrollOffset: 0,
      })
    }
  }

  return state
}

/**
 * Prompts for single selection from a list of choices.
 *
 * Pure functional prompt with arrow key navigation, scrolling support,
 * optional disabled choices, and optional type-to-filter search.
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
 *
 * @example With search
 * ```typescript
 * const outcome = await select({
 *   message: 'Pick a project:',
 *   choices: projects.map((p) => ({ label: p.name, value: p.id })),
 *   searchable: true,
 * })
 * ```
 */
export async function select<T = string>(config: SelectConfig<T>): Promise<PromptOutcome<T>> {
  const term = createTerminal({ input: config.input, output: config.output })
  let state = createInitialState(config)
  let lineCount = 0

  term.write(Ansi.HideCursor)

  const redraw = (submitted = false): void => {
    if (lineCount > 0) {
      term.write(Ansi.cursorUp(lineCount - 1) + Ansi.CursorStart)
    }
    term.write(Ansi.ClearToEnd)
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
      const actualIndex = state.filteredIndices[state.cursor]
      if (actualIndex === undefined) {
        continue
      }
      const selectedChoice = state.choices[actualIndex]
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

    state = processKey(key, state, config)
    redraw()
  }
}
