/**
 * The `export-expression.ts` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/export-expression
 */

export const EXPORT_EXPRESSION = {
  name: 'export-expression.ts',
  source: `export = { value: 1 }
`,
  scopes: `S0 global Program 0-22 up=- strict=0
S1 module Program 0-22 up=0 strict=1
  T\x20
`,
}
