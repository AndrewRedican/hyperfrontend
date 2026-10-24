/**
 * The `export-assignment.ts` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/export-assignment
 */

export const EXPORT_ASSIGNMENT = {
  name: 'export-assignment.ts',
  source: `const something = 1
export = something
`,
  scopes: `S0 global Program 0-39 up=- strict=0
S1 module Program 0-39 up=0 strict=1
  V something defs=Variable@6 ids=6 t=0 v=1 refs=6,29
  R 6 something w v init=1 we=18 => S1:something
  R 29 something r vt init=0 we=- => S1:something
  T\x20
`,
}
