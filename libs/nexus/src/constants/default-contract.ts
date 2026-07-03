import type { IChannelContract } from '../types/contract'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Default contract allowing generic message types.
 * Useful for development and prototyping.
 *
 * The contract is self-oriented: `emitted` lists what this side sends,
 * `accepted` lists what this side accepts.
 */
export const DEFAULT_CONTRACT: IChannelContract = freeze(<IChannelContract>{
  emitted: freeze([
    { type: 'MESSAGE', description: 'Generic message' },
    { type: 'DATA', description: 'Generic data transfer' },
    { type: 'EVENT', description: 'Generic event' },
  ]),
  accepted: freeze([
    { type: 'MESSAGE', description: 'Generic message' },
    { type: 'DATA', description: 'Generic data transfer' },
    { type: 'EVENT', description: 'Generic event' },
    { type: 'ACK', description: 'Acknowledgment' },
  ]),
})
