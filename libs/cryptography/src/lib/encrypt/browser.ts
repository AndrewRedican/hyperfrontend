import { utf8StringToUint8Array } from '@hyperfrontend/string-utils/browser'
import { generateKey } from '../generate-key/browser'
import { getRandomValues } from '../get-random-values/browser'
import { subtle } from '../subtle/browser'
import { createEncrypt } from './create-encrypt'

export const encrypt = createEncrypt(utf8StringToUint8Array, getRandomValues, generateKey, subtle)
