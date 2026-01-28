import { webcrypto } from 'node:crypto'

export const subtle = <SubtleCrypto>webcrypto.subtle
