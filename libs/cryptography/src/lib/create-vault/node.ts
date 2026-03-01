import { decrypt } from '../decrypt/node'
import { encrypt } from '../encrypt/node'
import { getRandomValues } from '../get-random-values/node'
import { createValueCreator } from './create-value-creator'

export const createVault = createValueCreator(getRandomValues, encrypt, decrypt)
