import { utf8StringToUint8Array } from '@hyperfrontend/string-utils/node'
import { getRandomValues } from '../get-random-values/node'
import { generateKey } from '../generate-key/node'
import { subtle } from '../subtle/node'
import { createEncrypt } from './create-encrypt'

export const encrypt = createEncrypt(utf8StringToUint8Array, getRandomValues, generateKey, subtle)
