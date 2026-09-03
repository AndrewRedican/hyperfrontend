import { webcrypto } from 'node:crypto'

export const subtle = webcrypto.subtle as SubtleCrypto
