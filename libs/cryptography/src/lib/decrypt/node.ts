import { arrayBufferToUtf8String } from '@hyperfrontend/string-utils/node'
import { generateKey } from '../generate-key/node'
import { subtle } from '../subtle/node'
import { createDecrypt } from './create-decrypt'

export const decrypt = createDecrypt(arrayBufferToUtf8String, generateKey, subtle)
