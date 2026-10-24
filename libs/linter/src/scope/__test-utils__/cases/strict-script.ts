/**
 * The `strict-script.ts` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/strict-script
 */

export const STRICT_SCRIPT = {
  name: 'strict-script.ts',
  source: `1
'use strict'
var top = 1
function f() {
  'use strict'
}
function g() {
  "use strict"
}
`,
  scopes: `S0 global Program 0-91 up=- strict=1
  V top defs=Variable@19 ids=19 t=0 v=1 refs=19
  V f defs=FunctionName@36 ids=36 t=0 v=1 refs=
  V g defs=FunctionName@68 ids=68 t=0 v=1 refs=
  R 19 top w v init=1 we=25 => S0:top
S1 function FunctionDeclaration 27-58 up=0 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
S2 function FunctionDeclaration 59-90 up=0 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
`,
}
