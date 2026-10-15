/**
 * The export a spec replaces through `jest.mock`.
 *
 * @returns The real label.
 */
export function label(): string {
  return 'real'
}

/**
 * The export a partial mock leaves alone.
 *
 * @returns The real value.
 */
export function untouched(): string {
  return 'kept'
}
