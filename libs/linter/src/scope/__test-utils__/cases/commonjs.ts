/**
 * The `commonjs.cjs` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/commonjs
 */

export const COMMONJS = {
  name: 'commonjs.cjs',
  source: `var x = require('y')
module.exports = x
function f() {
  'use strict'
  return x
}
`,
  scopes: `S0 global Program 0-83 up=- strict=0
S1 function Program 0-83 up=0 strict=0
  V arguments defs= ids= t=1 v=1 refs=
  V x defs=Variable@4 ids=4 t=0 v=1 refs=4,38,79
  V f defs=FunctionName@49 ids=49 t=0 v=1 refs=
  R 4 x w v init=1 we=8 => S1:x
  R 8 require r v init=0 we=- => ext
  R 21 module r v init=0 we=- => ext
  R 38 x r v init=0 we=- => S1:x
  T 8,21
S2 function FunctionDeclaration 40-82 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  R 79 x r v init=0 we=- => S1:x
  T 79
`,
}
