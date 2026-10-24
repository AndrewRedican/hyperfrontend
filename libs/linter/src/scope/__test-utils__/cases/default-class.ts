/**
 * The `default-class.ts` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/default-class
 */

export const DEFAULT_CLASS = {
  name: 'default-class.ts',
  source: `export default class {}
`,
  scopes: `S0 global Program 0-24 up=- strict=0
S1 module Program 0-24 up=0 strict=1
  T\x20
S2 class ClassDeclaration 15-23 up=1 strict=1
  T\x20
`,
}
