import type { StyleMap } from './style.model'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { createRunOnceFunction } from '@hyperfrontend/function-utils'
import { addStylesheet } from './stylesheets'

export const createApplyStyles = (styles: StyleMap) => createRunOnceFunction(() => addStylesheet(styles, uuidV4()))
