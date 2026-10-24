/**
 * The `undeclared-pragma.tsx` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/undeclared-pragma
 */

export const UNDECLARED_PRAGMA = {
  name: 'undeclared-pragma.tsx',
  source: `const x = (
  <>
    <a />
  </>
)
`,
  scopes: `S0 global Program 0-35 up=- strict=0
S1 module Program 0-35 up=0 strict=1
  V x defs=Variable@6 ids=6 t=0 v=1 refs=6
  R 6 x w v init=1 we=14 => S1:x
  T\x20
`,
}
