/**
 * Terminal prompting library with composable, functional API for text, select, confirm, and multiselect prompts.
 *
 * @module @hyperfrontend/questions
 */
export type {
  Choice,
  ConfirmConfig,
  MultiselectConfig,
  PromptCancelledOutcome,
  PromptConfig,
  PromptFunction,
  PromptOutcome,
  PromptSubmittedOutcome,
  SelectConfig,
  TextConfig,
} from './types'
export { confirm } from './prompts/confirm'
export { multiselect } from './prompts/multiselect'
export { select } from './prompts/select'
export { text } from './prompts/text'
export { PromptResult } from './types'
