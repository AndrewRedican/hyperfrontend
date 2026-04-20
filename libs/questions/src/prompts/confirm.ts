/**
 * Confirmation prompt.
 *
 * @module @hyperfrontend/questions/prompts/confirm
 */
import type { PromptOutcome, ConfirmConfig } from '../types'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { renderMessage, renderSubmitted, renderCancelled, style } from '../render'
import { createTerminal, Ansi, Key } from '../terminal'
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
 * Prompts for yes/no confirmation.
 *
 * Pure functional prompt that asks a yes/no question and returns a boolean.
 * Supports default values and responds to y/Y/n/N keys.
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

  const drawPrompt = (): void => {
    term.write(Ansi.CursorStart + Ansi.ClearLine)
    term.write(renderMessage(config.message) + renderOptions(config.initial) + ' ')
  }

  const drawResult = (value: boolean): void => {
    term.write(Ansi.CursorStart + Ansi.ClearLine)
    term.write(renderMessage(config.message) + renderSubmitted(value ? 'Yes' : 'No') + '\n')
  }

  drawPrompt()

  while (true) {
    const key = await term.readKey()
    const lowerKey = key.toLowerCase()

    if (term.isCancelled()) {
      term.write(Ansi.CursorStart + Ansi.ClearLine)
      term.write(renderMessage(config.message) + renderCancelled() + '\n')
      term.close()
      return freeze({ result: PromptResult.Cancelled, value: undefined })
    }

    if (lowerKey === 'y') {
      drawResult(true)
      term.close()
      return freeze({ result: PromptResult.Submitted, value: true })
    }

    if (lowerKey === 'n') {
      drawResult(false)
      term.close()
      return freeze({ result: PromptResult.Submitted, value: false })
    }

    if (key === Key.Enter && config.initial !== undefined) {
      drawResult(config.initial)
      term.close()
      return freeze({ result: PromptResult.Submitted, value: config.initial })
    }
  }
}
