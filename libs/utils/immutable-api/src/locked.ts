export type LockedMethod = (
  target: object,
  propertyKey: string | symbol,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptor: TypedPropertyDescriptor<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any

/**
 * @locked
 * Ensures a classic prototype method cannot be overwritten and is
 * always called with the correct `this` instance without needing arrow functions.
 *
 * - The method of the prototype is non-configurable and non-enumerable.
 * - Any attempt to assign to the method throws an error.
 * - It does not support class fields / arrow functions.
 */
export const locked = (): LockedMethod => {
  return function lockMethod(target, key, descriptor) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const original = <Function>descriptor.value
    const BOUND = Symbol(`[[locked.bound:${String(key)}]]`)
    return <PropertyDescriptor>{
      configurable: false,
      enumerable: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get(this: any) {
        // cache a bound function per instance
        if (!Object.prototype.hasOwnProperty.call(this, BOUND)) {
          Object.defineProperty(this, BOUND, {
            value: original.bind(this),
            writable: false,
            configurable: false,
            enumerable: false,
          })
        }
        return this[BOUND]
      },
      set() {
        throw new TypeError(`Cannot overwrite locked method ${String(key)}`)
      },
    }
  }
}
