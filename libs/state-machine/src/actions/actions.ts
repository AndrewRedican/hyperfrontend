/* eslint-disable @typescript-eslint/no-explicit-any */
import { START, CANCEL, PAUSE, SUCCESS, FAIL } from './actions.types'

/**
 * Creates a start action.
 *
 * @param payload - Optional payload data
 * @returns Start action object
 */
export const start = <T = void>(payload?: T) => ({ type: START, payload })

/**
 * Creates a cancel action.
 *
 * @param payload - Optional payload data
 * @returns Cancel action object
 */
export const cancel = <T = void>(payload?: T) => ({ type: CANCEL, payload })

/**
 * Creates a pause action.
 *
 * @param payload - Optional payload data
 * @returns Pause action object
 */
export const pause = <T = void>(payload?: T) => ({ type: PAUSE, payload })

/**
 * Creates a success action.
 *
 * @param payload - Optional payload data
 * @returns Success action object
 */
export const success = <T = void>(payload?: T) => ({ type: SUCCESS, payload })

/**
 * Creates a fail action.
 *
 * @param error - Optional error information
 * @returns Fail action object
 */
export const fail = (error?: Error | string | any) => ({ type: FAIL, error })
