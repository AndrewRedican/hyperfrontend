import { utf8StringToUint8Array } from '@hyperfrontend/string-utils/browser'
import { subtle } from '../subtle/browser'
import { createKeyGenerator } from './create-key-generator'

export const generateKey = createKeyGenerator(subtle, utf8StringToUint8Array)
