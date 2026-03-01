import type { StyleMap } from './style.model'
import { createRunOnceFunction } from '@hyperfrontend/function-utils'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { addStylesheet } from './stylesheets'

export const createApplyStyles = (styles: StyleMap) => createRunOnceFunction(() => addStylesheet(styles, uuidV4()))
