/**
 * Multi-select prompt with optional search/filter.
 *
 * @module @hyperfrontend/questions/prompts/multiselect
 */
import type { Terminal } from '../terminal'
import type { PromptOutcome, MultiselectConfig, Choice } from '../types'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { firstPasteLine } from '../paste'
import { renderMessage, renderSubmitted, renderCancelled, style, Symbol } from '../render'
import { createScreen } from '../screen'
import { createTerminal, Ansi, Key } from '../terminal'
import { TokenType } from '../token-parser'
import { PromptResult } from '../types'

/**
 * Checks if an array includes a value.
 *
 * @internal
 * @param arr - Array to search
 * @param value - Value to find
 * @returns True if value is in array
 */
function arrayIncludes<T>(arr: ReadonlyArray<T>, value: T): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === value) return true
  }
  return false
}

/**
 * Internal state for multiselect prompt.
 *
 * @internal
 */
interface MultiselectState<T> {
  /** Current cursor position */
  readonly cursor: number
  /** Indices of selected choices */
  readonly selected: ReadonlyArray<number>
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
 * Creates initial state for multiselect prompt.
 *
 * @internal
 * @param config - Prompt configuration
 * @returns Initial multiselect state
 */
function createInitialState<T>(config: MultiselectConfig<T>): MultiselectState<T> {
  return freeze({
    cursor: 0,
    selected: config.initial ? [...config.initial] : [],
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
function getVisibleChoices<T>(state: MultiselectState<T>, maxVisible: number): VisibleIndicesResult {
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
 * Renders a single choice line for multiselect.
 *
 * @internal
 * @param choice - The choice to render
 * @param isSelected - Whether this choice is selected
 * @param isFocused - Whether cursor is on this choice
 * @returns Formatted choice string
 */
function renderChoice<T>(choice: Choice<T>, isSelected: boolean, isFocused: boolean): string {
  const pointer = isFocused ? style.cyan(Symbol.Pointer) : ' '
  const checkbox = isSelected ? style.green(Symbol.CheckboxSelected) : style.dim(Symbol.Checkbox)

  let label = choice.label
  if (choice.disabled) {
    label = style.dim(label + ' (disabled)')
  } else if (isFocused) {
    label = isSelected ? style.green(label) : style.cyan(label)
  } else if (isSelected) {
    label = style.green(label)
  }

  const hint = choice.hint ? style.dim(` — ${choice.hint}`) : ''

  return `${pointer} ${checkbox} ${label}${hint}`
}

/**
 * Builds the frame lines for the multiselect prompt.
 *
 * @internal
 * @param config - Prompt configuration
 * @param state - Current prompt state
 * @param maxVisible - Maximum number of visible choices
 * @returns Logical lines describing the prompt
 */
function buildLines<T>(config: MultiselectConfig<T>, state: MultiselectState<T>, maxVisible: number): ReadonlyArray<string> {
  const { indices: visibleIndices, startIndex } = getVisibleChoices(state, maxVisible)
  const lines: string[] = []

  let header = renderMessage(config.message)
  if (config.searchable && state.searchQuery) {
    header += style.cyan(state.searchQuery) + style.dim(' (type to filter)')
  } else if (config.searchable) {
    header += style.dim('(type to filter, space to toggle, enter to submit)')
  } else {
    header += style.dim('(space to toggle, enter to submit)')
  }
  lines.push(header)

  const minMax: string[] = []
  if (config.min !== undefined) minMax.push(`min: ${config.min}`)
  if (config.max !== undefined) minMax.push(`max: ${config.max}`)
  const countHint = minMax.length > 0 ? ` (${minMax.join(', ')})` : ''
  lines.push(style.dim(`  ${state.selected.length} selected${countHint}`))

  if (startIndex > 0) {
    lines.push(style.dim(`  ${Symbol.Ellipsis} (${startIndex} more above)`))
  }

  visibleIndices.forEach((actualIndex, i) => {
    const choice = state.choices[actualIndex]
    // why: actualIndex always comes from filteredIndices, so this guard is defensive and never taken.
    if (!choice) return

    const isFocused = startIndex + i === state.cursor
    const isSelected = arrayIncludes(state.selected, actualIndex)
    lines.push(renderChoice(choice, isSelected, isFocused))
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
function appendSearch<T>(query: string, state: MultiselectState<T>): MultiselectState<T> {
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
function processKey<T>(key: string, state: MultiselectState<T>, config: MultiselectConfig<T>, maxVisible: number): MultiselectState<T> {
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

  if (key === Key.Space) {
    const actualIndex = state.filteredIndices[state.cursor]
    if (actualIndex === undefined) return state

    const choice = state.choices[actualIndex]
    // why: actualIndex is validated above, so this guard is defensive and never taken.
    if (!choice || choice.disabled) return state

    const isSelected = arrayIncludes(state.selected, actualIndex)

    if (isSelected) {
      const newSelected = state.selected.filter((i) => i !== actualIndex)
      return freeze({ ...state, selected: newSelected })
    } else {
      if (config.max !== undefined && state.selected.length >= config.max) {
        return state
      }
      const newSelected = [...state.selected, actualIndex]
      return freeze({ ...state, selected: newSelected })
    }
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

    if (key.length === 1 && key >= ' ' && key !== Key.Space) {
      return appendSearch(key, state)
    }
  }

  return state
}

/**
 * Validates selection count against min/max constraints.
 *
 * @internal
 * @param state - Current prompt state
 * @param config - Prompt configuration with min/max constraints
 * @returns Error message string if validation fails, undefined if valid
 */
function validateSelection<T>(state: MultiselectState<T>, config: MultiselectConfig<T>): string | undefined {
  if (config.min !== undefined && state.selected.length < config.min) {
    return `Select at least ${config.min} option${config.min === 1 ? '' : 's'}`
  }
  if (config.max !== undefined && state.selected.length > config.max) {
    return `Select at most ${config.max} option${config.max === 1 ? '' : 's'}`
  }
  return undefined
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

/**
 * Prompts for multiple selections from a list of choices.
 *
 * Pure functional prompt with arrow key navigation, space to toggle,
 * scrolling support, min/max constraints, and optional type-to-filter
 * search. In searchable mode, pasted text appends its first line to the
 * filter query; pasting never toggles or submits. The prompt repaints on
 * terminal resize, preserving cursor, selection, and scroll state.
 *
 * @param config - Multiselect prompt configuration
 * @returns Promise resolving to array of selected values or cancellation
 *
 * @example Basic multiselect
 * ```typescript
 * const outcome = await multiselect({
 *   message: 'Select toppings:',
 *   choices: [
 *     { label: 'Cheese', value: 'cheese' },
 *     { label: 'Pepperoni', value: 'pepperoni' },
 *     { label: 'Mushrooms', value: 'mushrooms' },
 *   ],
 * })
 * if (outcome.result === 'submitted') {
 *   console.log(`You selected: ${outcome.value.join(', ')}`)
 * }
 * ```
 *
 * @example With search and constraints
 * ```typescript
 * const outcome = await multiselect({
 *   message: 'Select features:',
 *   choices: features.map((f) => ({ label: f.name, value: f.id })),
 *   searchable: true,
 *   min: 1,
 *   max: 5,
 * })
 * ```
 *
 * @example Pre-selected values
 * ```typescript
 * const outcome = await multiselect({
 *   message: 'Select permissions:',
 *   choices: permissions,
 *   initial: [0, 2], // First and third choices pre-selected
 * })
 * ```
 */
export async function multiselect<T = string>(config: MultiselectConfig<T>): Promise<PromptOutcome<ReadonlyArray<T>>> {
  const term = createTerminal({ input: config.input, output: config.output })
  const screen = createScreen(term)
  let state = createInitialState(config)
  let errorMessage: string | undefined

  term.write(Ansi.HideCursor)

  const redraw = (): void => {
    const lines = [...buildLines(config, state, effectiveMaxVisible(term, config.maxVisible))]
    if (errorMessage) {
      lines.push(style.yellow(`  ${errorMessage}`))
    }
    screen.render(freeze({ lines: freeze(lines) }))
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
          errorMessage = undefined
          state = appendSearch(firstPasteLine(token.value), state)
          redraw()
        }
        continue
      }

      if (token.value === Key.Enter) {
        const validationError = validateSelection(state, config)
        if (validationError) {
          errorMessage = validationError
          redraw()
          continue
        }

        const selectedValues = state.selected.map((i) => state.choices[i]?.value).filter((v): v is T => v !== undefined)
        const selectedLabels = state.selected.map((i) => state.choices[i]?.label ?? '').join(', ')
        const submittedLine = renderMessage(config.message) + renderSubmitted(selectedLabels || 'none')
        screen.render(freeze({ lines: freeze([submittedLine]) }))
        term.write('\n' + Ansi.ShowCursor)
        return freeze({ result: PromptResult.Submitted, value: freeze(selectedValues) })
      }

      errorMessage = undefined
      state = processKey(token.value, state, config, effectiveMaxVisible(term, config.maxVisible))
      redraw()
    }
  } finally {
    term.close()
  }
}
