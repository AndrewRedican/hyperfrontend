import type { Style } from './style.model'
import { createRunOnceFunction } from '@hyperfrontend/function-utils'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { addStylesheet } from './stylesheets'

export const createApplyStyle = (selector: string, style: Style) =>
  createRunOnceFunction(() => addStylesheet({ [selector]: style }, uuidV4()))
