/**
 * The `pragma.tsx` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/pragma
 */

export const PRAGMA = {
  name: 'pragma.tsx',
  source: `import { h, Frag } from 'lib'
function render() {
  return (
    <>
      <a />
    </>
  )
}
`,
  scopes: `S0 global Program 0-94 up=- strict=0
S1 module Program 0-94 up=0 strict=1
  V h defs=ImportBinding@9 ids=9 t=1 v=1 refs=9
  V Frag defs=ImportBinding@12 ids=12 t=1 v=1 refs=12
  V render defs=FunctionName@39 ids=39 t=0 v=1 refs=
  R 9 h r v init=0 we=- => S1:h
  R 12 Frag r v init=0 we=- => S1:Frag
  T\x20
S2 function FunctionDeclaration 30-93 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
`,
}
