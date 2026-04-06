/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ElementMethods } from './create-element'
import { getType } from '@hyperfrontend/data-utils'
import { createRunOnceFunction } from '@hyperfrontend/function-utils'

/** Function that returns a style element and a cleanup function */
export type StyleFn = () => [HTMLStyleElement, () => void]

/** Factory function that creates element methods from arguments */
export type CreateFn<T extends HTMLElement, Args extends any[]> = (...args: Args) => ElementMethods<T>

export const component = <T extends HTMLElement, Args extends any[]>(create: CreateFn<T, Args>, style?: StyleFn) =>
  createRunOnceFunction((...args: Args) => {
    if (getType(style) === 'function') {
      ;(<StyleFn>style)()
    }
    return create(...args)
  })
