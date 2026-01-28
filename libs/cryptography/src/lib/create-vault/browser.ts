import { getRandomValues } from '../get-random-values/browser'
import { encrypt } from '../encrypt/browser'
import { decrypt } from '../decrypt/browser'
import { createValueCreator } from './create-value-creator'

export const createVault = createValueCreator(getRandomValues, encrypt, decrypt)
