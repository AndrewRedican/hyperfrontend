/* eslint-disable @typescript-eslint/no-explicit-any */
import { START, CANCEL, PAUSE, SUCCESS, FAIL } from './actions.types'

/**
 * Creates a start action.
 *
 * @param payload - Optional payload data
 * @returns Start action object
 *
 * @example
 * ```typescript
 * const action = start({ taskId: 'download-123' })
 * // => { type: 'START', payload: { taskId: 'download-123' } }
 * ```
 */
export const start = <T = void>(payload?: T) => ({ type: START, payload })

/**
 * Creates a cancel action.
 *
 * @param payload - Optional payload data
 * @returns Cancel action object
 *
 * @example
 * ```typescript
 * const action = cancel({ reason: 'user-requested' })
 * // => { type: 'CANCEL', payload: { reason: 'user-requested' } }
 * ```
 */
export const cancel = <T = void>(payload?: T) => ({ type: CANCEL, payload })

/**
 * Creates a pause action.
 *
 * @param payload - Optional payload data
 * @returns Pause action object
 *
 * @example
 * ```typescript
 * const action = pause({ resumeAt: Date.now() + 5000 })
 * // => { type: 'PAUSE', payload: { resumeAt: 1712345678 } }
 * ```
 */
export const pause = <T = void>(payload?: T) => ({ type: PAUSE, payload })

/**
 * Creates a success action.
 *
 * @param payload - Optional payload data
 * @returns Success action object
 *
 * @example
 * ```typescript
 * const action = success({ result: 'file-downloaded' })
 * // => { type: 'SUCCESS', payload: { result: 'file-downloaded' } }
 * ```
 */
export const success = <T = void>(payload?: T) => ({ type: SUCCESS, payload })

/**
 * Creates a fail action.
 *
 * @param error - Optional error information
 * @returns Fail action object
 *
 * @example
 * ```typescript
 * const action = fail(new Error('Network timeout'))
 * // => { type: 'FAIL', error: Error('Network timeout') }
 * ```
 */
export const fail = (error?: Error | string | any) => ({ type: FAIL, error })
