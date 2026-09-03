/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ElementMethods } from './create-element'
import { getType } from '@hyperfrontend/data-utils'
import { createRunOnceFunction } from '@hyperfrontend/function-utils'

/** Function that returns a style element and a cleanup function */
export type StyleFn = () => [HTMLStyleElement, () => void]

/** Factory function that creates element methods from arguments */
export type CreateFn<T extends HTMLElement, Args extends any[]> = (...args: Args) => ElementMethods<T>

/**
 * Creates a component wrapper that applies styles once and returns element methods.
 *
 * @param create - Factory function to create element methods
 * @param style - Optional style function to apply component styles
 * @returns A run-once function that creates the component
 *
 * @example Creating styled component
 * ```typescript
 * const createButton = (label: string) => createElement('button', { className: 'btn' })
 * const buttonStyles = () => addStylesheet({ '.btn': { padding: '8px 16px' } }, 'btn-styles')
 *
 * const Button = component(createButton, buttonStyles)
 *
 * // First call applies styles and creates button
 * const btn1 = Button('Submit')
 *
 * // Subsequent calls return same instance (styles only applied once)
 * const btn2 = Button('Cancel')
 * // btn1 === btn2
 * ```
 */
export const component = <T extends HTMLElement, Args extends any[]>(create: CreateFn<T, Args>, style?: StyleFn) =>
  createRunOnceFunction((...args: Args) => {
    if (getType(style) === 'function') {
      ;(style as StyleFn)()
    }
    return create(...args)
  })
