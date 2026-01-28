/* eslint-disable @typescript-eslint/no-explicit-any */
import * as types from './actions.types'

export const start = (...args: any[]) => ({ ...args, type: types.START })

export const cancel = (...args: any[]) => ({ ...args, type: types.CANCEL })

export const pause = (...args: any[]) => ({ ...args, type: types.PAUSE })

export const success = (...args: any[]) => ({ ...args, type: types.SUCCESS })

export const fail = (...args: any[]) => ({ ...args, type: types.FAIL })
