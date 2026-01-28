import { utf8StringToUint8Array } from '@hyperfrontend/string-utils/node'
import { subtle } from '../subtle/node'
import { createKeyGenerator } from './create-key-generator'

export const generateKey = createKeyGenerator(subtle, utf8StringToUint8Array)
