/* eslint-disable @typescript-eslint/no-explicit-any */
import * as types from './actions.types'

export const start = <T = void>(payload?: T) => ({ type: types.START, payload })

export const cancel = <T = void>(payload?: T) => ({ type: types.CANCEL, payload })

export const pause = <T = void>(payload?: T) => ({ type: types.PAUSE, payload })

export const success = <T = void>(payload?: T) => ({ type: types.SUCCESS, payload })

export const fail = (error?: Error | string | any) => ({ type: types.FAIL, error })
