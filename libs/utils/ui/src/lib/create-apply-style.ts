import type { Style } from './style.model'
import { createRunOnceFunction } from '@hyperfrontend/function-utils'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { addStylesheet } from './stylesheets'

/**
 * Creates a run-once function that applies a single style rule to a selector.
 *
 * @param selector - CSS selector to apply the style to
 * @param style - Style object to apply
 * @returns A function that applies the style when called
 */
export const createApplyStyle = (selector: string, style: Style) =>
  createRunOnceFunction(() => addStylesheet({ [selector]: style }, uuidV4()))
