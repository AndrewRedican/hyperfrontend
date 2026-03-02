import { decrypt } from '../decrypt/browser'
import { encrypt } from '../encrypt/browser'
import { getRandomValues } from '../get-random-values/browser'
import { createValueCreator } from './create-value-creator'

export const createVault = createValueCreator(getRandomValues, encrypt, decrypt)
