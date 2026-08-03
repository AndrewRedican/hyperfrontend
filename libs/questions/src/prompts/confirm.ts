/**
 * Confirmation prompt.
 *
 * @module @hyperfrontend/questions/prompts/confirm
 */
import type { KeyToken, PasteToken } from '../token-parser'
import type { PromptOutcome, ConfirmConfig } from '../types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { renderMessage, renderSubmitted, renderCancelled, style } from '../render'
import { createScreen } from '../screen'
import { createTerminal, Key } from '../terminal'
import { TokenType } from '../token-parser'
import { PromptResult } from '../types'

/**
 * Renders the confirm prompt hint based on default value.
 *
 * @internal
 * @param initial - The default value for the confirmation
 * @returns Styled hint string showing Y/n options
 */
function renderOptions(initial: boolean | undefined): string {
  if (initial === true) {
    return style.dim('(Y/n)')
  }
  if (initial === false) {
    return style.dim('(y/N)')
  }
  return style.dim('(y/n)')
}

/**
 * Interprets a key or paste token as a yes/no answer. Keys accept `y`/`n`
 * (any case); pastes accept a trimmed, lowercased `y`/`yes`/`n`/`no`.
 *
 * @internal
 * @param token - Token to interpret
 * @returns The boolean answer, or undefined when the token is not one
 */
function parseAnswer(token: KeyToken | PasteToken): boolean | undefined {
  const normalized = token.value.trim().toLowerCase()
  if (token.type === TokenType.Paste) {
    if (normalized === 'y' || normalized === 'yes') return true
    if (normalized === 'n' || normalized === 'no') return false
    return undefined
  }
  if (normalized === 'y') return true
  if (normalized === 'n') return false
  return undefined
}

/**
 * Prompts for yes/no confirmation.
 *
 * Pure functional prompt that asks a yes/no question and returns a boolean.
 * Supports default values and responds to y/Y/n/N keys. A pasted
 * `y`/`yes`/`n`/`no` (trimmed, case-insensitive) is accepted; any other
 * paste is ignored. The prompt repaints on terminal resize.
 *
 * @param config - Confirm prompt configuration
 * @returns Promise resolving to boolean value or cancellation
 *
 * @example Basic confirmation
 * ```typescript
 * const outcome = await confirm({ message: 'Continue?' })
 * if (outcome.result === 'submitted' && outcome.value) {
 *   console.log('Proceeding...')
 * }
 * ```
 *
 * @example With default value
 * ```typescript
 * const outcome = await confirm({
 *   message: 'Enable feature?',
 *   initial: true, // Default to yes
 * })
 * ```
 */
export async function confirm(config: ConfirmConfig): Promise<PromptOutcome<boolean>> {
  const term = createTerminal({ input: config.input, output: config.output })
  const screen = createScreen(term)

  const finish = (value: boolean): PromptOutcome<boolean> => {
    screen.render(freeze({ lines: freeze([renderMessage(config.message) + renderSubmitted(value ? 'Yes' : 'No')]) }))
    term.write('\n')
    return freeze({ result: PromptResult.Submitted, value })
  }

  const redraw = (): void => {
    screen.render(freeze({ lines: freeze([renderMessage(config.message) + renderOptions(config.initial) + ' ']) }))
  }

  try {
    redraw()

    while (true) {
      const token = await term.readToken()

      if (term.isCancelled()) {
        screen.render(freeze({ lines: freeze([renderMessage(config.message) + renderCancelled()]) }))
        term.write('\n')
        return freeze({ result: PromptResult.Cancelled, value: undefined })
      }

      if (token.type === TokenType.Resize) {
        redraw()
        continue
      }

      const answer = parseAnswer(token)
      if (answer !== undefined) {
        return finish(answer)
      }

      if (token.value === Key.Enter && config.initial !== undefined) {
        return finish(config.initial)
      }
    }
  } finally {
    term.close()
  }
}
