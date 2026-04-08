import type { StyleMap } from './style.model'
import { createRunOnceFunction } from '@hyperfrontend/function-utils'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { addStylesheet } from './stylesheets'

/**
 * Creates a run-once function that applies multiple style rules.
 *
 * @param styles - StyleMap object containing selector-style pairs
 * @returns A function that applies all styles when called
 */
export const createApplyStyles = (styles: StyleMap) => createRunOnceFunction(() => addStylesheet(styles, uuidV4()))
