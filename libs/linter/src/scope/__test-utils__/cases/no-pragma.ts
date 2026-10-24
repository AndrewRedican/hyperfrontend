/**
 * The `no-pragma.tsx` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/no-pragma
 */

export const NO_PRAGMA = {
  name: 'no-pragma.tsx',
  source: `import React from 'react'
const x = <a />
const y = <></>
`,
  scopes: `S0 global Program 0-58 up=- strict=0
S1 module Program 0-58 up=0 strict=1
  V React defs=ImportBinding@7 ids=7 t=1 v=1 refs=
  V x defs=Variable@32 ids=32 t=0 v=1 refs=32
  V y defs=Variable@48 ids=48 t=0 v=1 refs=48
  R 32 x w v init=1 we=36 => S1:x
  R 48 y w v init=1 we=52 => S1:y
  T\x20
`,
}
