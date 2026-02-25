/* eslint-disable @typescript-eslint/no-explicit-any */
import { START, CANCEL, PAUSE, SUCCESS, FAIL } from './actions.types'

export const start = <T = void>(payload?: T) => ({ type: START, payload })

export const cancel = <T = void>(payload?: T) => ({ type: CANCEL, payload })

export const pause = <T = void>(payload?: T) => ({ type: PAUSE, payload })

export const success = <T = void>(payload?: T) => ({ type: SUCCESS, payload })

export const fail = (error?: Error | string | any) => ({ type: FAIL, error })
