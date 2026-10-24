/**
 * The `values.ts` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/values
 */

export const VALUES = {
  name: 'values.ts',
  source: `let a = 1
var hoisted = a
a = 2
a += 3
a++
;({ a, b: [c = 1, ...rest] } = obj)
;(a as number) = 4
;(<number>a) = 5
a! = 6
;(a as number)++
obj.prop = 7
obj[key] = 8
obj.count++
for (var i = 0; i < 3; i++) {}
for (let j = 0; j < 3; j++) {}
for (const k in obj) {}
for (const [m = 1, n] of list) {}
for (a in obj) {}
for ([a, b = 2] of list) {}
for (obj.x of list) {}
switch (a) {
  case 1: {
    let inner = 1
  }
  default:
    break
}
outer: for (;;) {
  break outer
  continue outer
}
try {
} catch {}
try {
} catch (error) {}
try {
} catch ({ message = 'x' }) {}
call<string>(a, ...rest)
new Thing<number>(a)
tag<string>\`x\`
fn<number>
const { x = defaultX, [computedKey]: y, ...others } = source
const [first = a] = list
const shorthand = { a, [computedKey]: 1, method() {}, get g() { return 1 } }
label: {
}
a?.b.c
function withTarget() {
  return new.target
}
const assigned = (target = 1)
;[call(arg)[idx]] = list
;[[first], , ...others] = list
`,
  scopes: `S0 global Program 0-951 up=- strict=0
S1 module Program 0-951 up=0 strict=1
  V a defs=Variable@4 ids=4 t=0 v=1 refs=4,24,26,32,39,47,81,108,115,124,302,321,374,579,609,714,744,812
  V hoisted defs=Variable@14 ids=14 t=0 v=1 refs=14
  V i defs=Variable@186 ids=186 t=0 v=1 refs=186,193,200
  V x defs=Variable@646 ids=646 t=0 v=1 refs=646,646
  V y defs=Variable@675 ids=675 t=0 v=1 refs=675
  V others defs=Variable@681 ids=681 t=0 v=1 refs=681,936
  V first defs=Variable@706 ids=706 t=0 v=1 refs=706,706,923
  V shorthand defs=Variable@730 ids=730 t=0 v=1 refs=730
  V withTarget defs=FunctionName@828 ids=828 t=0 v=1 refs=
  V assigned defs=Variable@871 ids=871 t=0 v=1 refs=871
  R 4 a w v init=1 we=8 => S1:a
  R 14 hoisted w v init=1 we=24 => S1:hoisted
  R 24 a r v init=0 we=- => S1:a
  R 26 a w v init=0 we=30 => S1:a
  R 32 a rw v init=0 we=37 => S1:a
  R 39 a rw v init=0 we=- => S1:a
  R 47 a w v init=0 we=74 => S1:a
  R 54 c w v init=0 we=58 => ext
  R 54 c w v init=0 we=74 => ext
  R 64 rest w v init=0 we=74 => ext
  R 74 obj r v init=0 we=- => ext
  R 81 a w v init=0 we=96 => S1:a
  R 108 a w v init=0 we=113 => S1:a
  R 115 a w v init=0 we=120 => S1:a
  R 124 a rw v init=0 we=- => S1:a
  R 139 obj r v init=0 we=- => ext
  R 152 obj r v init=0 we=- => ext
  R 156 key r v init=0 we=- => ext
  R 165 obj r v init=0 we=- => ext
  R 186 i w v init=1 we=190 => S1:i
  R 193 i r v init=0 we=- => S1:i
  R 200 i rw v init=0 we=- => S1:i
  R 302 a w v init=0 we=307 => S1:a
  R 307 obj r v init=0 we=- => ext
  R 321 a w v init=0 we=334 => S1:a
  R 324 b w v init=0 we=328 => ext
  R 324 b w v init=0 we=334 => ext
  R 334 list r v init=0 we=- => ext
  R 348 obj r v init=0 we=- => ext
  R 357 list r v init=0 we=- => ext
  R 374 a r v init=0 we=- => S1:a
  R 566 call r v init=0 we=- => ext
  R 579 a r v init=0 we=- => S1:a
  R 585 rest r v init=0 we=- => ext
  R 595 Thing r v init=0 we=- => ext
  R 609 a r v init=0 we=- => S1:a
  R 612 tag r v init=0 we=- => ext
  R 627 fn r v init=0 we=- => ext
  R 646 x w v init=1 we=650 => S1:x
  R 646 x w v init=1 we=692 => S1:x
  R 675 y w v init=1 we=692 => S1:y
  R 681 others w v init=1 we=692 => S1:others
  R 650 defaultX r v init=0 we=- => ext
  R 661 computedKey r v init=0 we=- => ext
  R 692 source r v init=0 we=- => ext
  R 706 first w v init=1 we=714 => S1:first
  R 706 first w v init=1 we=719 => S1:first
  R 714 a r v init=0 we=- => S1:a
  R 719 list r v init=0 we=- => ext
  R 730 shorthand w v init=1 we=742 => S1:shorthand
  R 744 a r v init=0 we=- => S1:a
  R 748 computedKey r v init=0 we=- => ext
  R 812 a r v init=0 we=- => S1:a
  R 871 assigned w v init=1 we=883 => S1:assigned
  R 883 target w v init=0 we=892 => ext
  R 907 idx r v init=0 we=- => ext
  R 897 call r v init=0 we=- => ext
  R 902 arg r v init=0 we=- => ext
  R 915 list r v init=0 we=- => ext
  R 923 first w v init=0 we=946 => S1:first
  R 936 others w v init=0 we=946 => S1:others
  R 946 list r v init=0 we=- => ext
  T 54,54,64,74,139,152,156,165,255,288,307,324,324,334,348,357,566,585,595,612,627,650,661,692,719,748,883,907,897,902,915,946
S2 block BlockStatement 205-207 up=1 strict=1
  T\x20
S3 for ForStatement 208-238 up=1 strict=1
  V j defs=Variable@217 ids=217 t=0 v=1 refs=217,224,231
  R 217 j w v init=1 we=221 => S3:j
  R 224 j r v init=0 we=- => S3:j
  R 231 j rw v init=0 we=- => S3:j
  T\x20
S4 block BlockStatement 236-238 up=3 strict=1
  T\x20
S5 for ForInStatement 239-262 up=1 strict=1
  V k defs=Variable@250 ids=250 t=0 v=1 refs=250
  R 250 k w v init=1 we=255 => S5:k
  R 255 obj r v init=0 we=- => ext
  T 255
S6 block BlockStatement 260-262 up=5 strict=1
  T\x20
S7 for ForOfStatement 263-296 up=1 strict=1
  V m defs=Variable@275 ids=275 t=0 v=1 refs=275,275
  V n defs=Variable@282 ids=282 t=0 v=1 refs=282
  R 275 m w v init=1 we=279 => S7:m
  R 275 m w v init=1 we=288 => S7:m
  R 282 n w v init=1 we=288 => S7:n
  R 288 list r v init=0 we=- => ext
  T 288
S8 block BlockStatement 294-296 up=7 strict=1
  T\x20
S9 block BlockStatement 312-314 up=1 strict=1
  T\x20
S10 block BlockStatement 340-342 up=1 strict=1
  T\x20
S11 block BlockStatement 363-365 up=1 strict=1
  T\x20
S12 switch SwitchStatement 366-435 up=1 strict=1
  T\x20
S13 block BlockStatement 389-412 up=12 strict=1
  V inner defs=Variable@399 ids=399 t=0 v=1 refs=399
  R 399 inner w v init=1 we=407 => S13:inner
  T\x20
S14 block BlockStatement 452-486 up=1 strict=1
  T\x20
S15 block BlockStatement 491-494 up=1 strict=1
  T\x20
S16 catch CatchClause 495-503 up=1 strict=1
  T\x20
S17 block BlockStatement 501-503 up=16 strict=1
  T\x20
S18 block BlockStatement 508-511 up=1 strict=1
  T\x20
S19 catch CatchClause 512-528 up=1 strict=1
  V error defs=CatchClause@519 ids=519 t=0 v=1 refs=
  T\x20
S20 block BlockStatement 526-528 up=19 strict=1
  T\x20
S21 block BlockStatement 533-536 up=1 strict=1
  T\x20
S22 catch CatchClause 537-565 up=1 strict=1
  V message defs=CatchClause@544 ids=546 t=0 v=1 refs=546
  R 546 message w v init=1 we=556 => S22:message
  T\x20
S23 block BlockStatement 563-565 up=22 strict=1
  T\x20
S24 function FunctionExpression 771-776 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
S25 function FunctionExpression 783-798 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
S26 block BlockStatement 808-811 up=1 strict=1
  T\x20
S27 function FunctionDeclaration 819-864 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
`,
}
