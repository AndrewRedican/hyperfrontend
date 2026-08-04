/**
 * Single-select prompt with optional search/filter.
 *
 * @module @hyperfrontend/questions/prompts/select
 */
import type { Terminal } from '../terminal'
import type { PromptOutcome, SelectConfig, Choice } from '../types'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { firstPasteLine } from '../paste'
import { renderMessage, renderSubmitted, renderCancelled, style, Symbol } from '../render'
import { createScreen } from '../screen'
import { createTerminal, Ansi, Key } from '../terminal'
import { TokenType } from '../token-parser'
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

  let label = choice.label
  if (choice.disabled) {
    label = style.dim(label + ' (disabled)')
  } else if (isFocused) {
    label = style.cyan(label)
  }

  const hint = choice.hint ? style.dim(` — ${choice.hint}`) : ''

  return `${pointer} ${label}${hint}`
}

/**
 * Builds the frame lines for the select prompt.
 *
 * @internal
 * @param config - Prompt configuration
 * @param state - Current prompt state
 * @param maxVisible - Maximum number of visible choices
 * @returns Logical lines describing the prompt
 */
function buildLines<T>(config: SelectConfig<T>, state: SelectState<T>, maxVisible: number): ReadonlyArray<string> {
  const { indices: visibleIndices, startIndex } = getVisibleChoices(state, maxVisible)
  const lines: string[] = []

  let header = renderMessage(config.message)
  if (config.searchable && state.searchQuery) {
    header += style.cyan(state.searchQuery) + style.dim(' (type to filter)')
  } else if (config.searchable) {
    header += style.dim('(type to filter, enter to select)')
  } else {
    header += style.dim('(use arrows, enter to select)')
  }
  lines.push(header)

  if (startIndex > 0) {
    lines.push(style.dim(`  ${Symbol.Ellipsis} (${startIndex} more above)`))
  }

  visibleIndices.forEach((actualIndex, i) => {
    const choice = state.choices[actualIndex]
    /* istanbul ignore if -- @preserve defensive: actualIndex always valid from filteredIndices */
    if (!choice) return

    lines.push(renderChoice(choice, startIndex + i === state.cursor))
  })

  if (startIndex + maxVisible < state.filteredIndices.length) {
    const remaining = state.filteredIndices.length - (startIndex + maxVisible)
    lines.push(style.dim(`  ${Symbol.Ellipsis} (${remaining} more below)`))
  }

  if (state.filteredIndices.length === 0 && config.searchable) {
    lines.push(style.dim('  No matches found'))
  }

  return freeze(lines)
}

/**
 * Appends text to the search query, re-filtering choices.
 *
 * @internal
 * @param query - Text to append (a typed character or pasted line)
 * @param state - Current prompt state
 * @returns Updated state with the new query applied
 */
function appendSearch<T>(query: string, state: SelectState<T>): SelectState<T> {
  if (query === '') return state
  const newQuery = state.searchQuery + query
  return freeze({
    ...state,
    searchQuery: newQuery,
    filteredIndices: filterChoices(state.choices, newQuery),
    cursor: 0,
    scrollOffset: 0,
  })
}

/**
 * Processes a keypress and returns updated state.
 *
 * @internal
 * @param key - The key that was pressed
 * @param state - Current prompt state
 * @param config - Prompt configuration
 * @param maxVisible - Maximum number of visible choices
 * @returns Updated state after processing the key
 */
function processKey<T>(key: string, state: SelectState<T>, config: SelectConfig<T>, maxVisible: number): SelectState<T> {
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
      return appendSearch(key, state)
    }
  }

  return state
}

/**
 * Prompts for single selection from a list of choices.
 *
 * Pure functional prompt with arrow key navigation, scrolling support,
 * optional disabled choices, and optional type-to-filter search. In
 * searchable mode, pasted text appends its first line to the filter query.
 * The prompt repaints on terminal resize, preserving cursor and scroll
 * state.
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
  const screen = createScreen(term)
  let state = createInitialState(config)

  term.write(Ansi.HideCursor)

  const redraw = (): void => {
    screen.render(freeze({ lines: buildLines(config, state, effectiveMaxVisible(term, config.maxVisible)) }))
  }

  try {
    redraw()

    while (true) {
      const token = await term.readToken()

      if (term.isCancelled()) {
        screen.render(freeze({ lines: freeze([renderMessage(config.message) + renderCancelled()]) }))
        term.write('\n' + Ansi.ShowCursor)
        return freeze({ result: PromptResult.Cancelled, value: undefined })
      }

      if (token.type === TokenType.Resize) {
        redraw()
        continue
      }

      if (token.type === TokenType.Paste) {
        if (config.searchable) {
          state = appendSearch(firstPasteLine(token.value), state)
          redraw()
        }
        continue
      }

      if (token.value === Key.Enter) {
        const actualIndex = state.filteredIndices[state.cursor]
        if (actualIndex === undefined) {
          continue
        }
        const selectedChoice = state.choices[actualIndex]
        if (!selectedChoice || selectedChoice.disabled) {
          continue
        }

        const submittedLine = renderMessage(config.message) + renderSubmitted(selectedChoice.label)
        screen.render(freeze({ lines: freeze([submittedLine]) }))
        term.write('\n' + Ansi.ShowCursor)
        return freeze({ result: PromptResult.Submitted, value: selectedChoice.value })
      }

      state = processKey(token.value, state, config, effectiveMaxVisible(term, config.maxVisible))
      redraw()
    }
  } finally {
    term.close()
  }
}

/**
 * Resolves the visible-window size, capped so the frame fits the terminal
 * height (header and scroll-indicator rows reserved).
 *
 * @internal
 * @param term - Terminal used for size queries
 * @param configured - Configured maximum visible choices
 * @returns Effective maximum visible choices (at least 1)
 */
function effectiveMaxVisible(term: Terminal, configured: number | undefined): number {
  return max(1, min(configured ?? 10, term.getSize().rows - 4))
}
