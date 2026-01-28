import { arrayBufferToUtf8String } from '@hyperfrontend/string-utils/browser'
import { generateKey } from '../generate-key/browser'
import { subtle } from '../subtle/browser'
import { createDecrypt } from './create-decrypt'

export const decrypt = createDecrypt(arrayBufferToUtf8String, generateKey, subtle)
