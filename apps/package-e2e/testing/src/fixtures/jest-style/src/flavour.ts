/**
 * The module a spec replaces at runtime with `jest.doMock`.
 *
 * @returns The real flavour.
 */
export function flavour(): string {
  return 'vanilla'
}
