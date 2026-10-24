/**
 * The `types.ts` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/types
 */

export const TYPES = {
  name: 'types.ts',
  source: `type Q1 = typeof value
type Q2 = typeof ns.inner.thing
type Q3 = typeof import('mod')
type Q4 = typeof import('mod').name<string>
type R1 = Other.Nested<Plain>
type C1<T> = T extends (infer U)[] ? U : T extends Promise<infer V> ? V : never
type C2<T> = T extends { [K in keyof T as infer N]: unknown } ? N : never
type C3<T> = T extends (...args: infer A) => infer R ? [A, R] : never
type C4 = { [K in Keys as \`get\${K}\`]: K }
type NoConditional = { [K in Keys]: (x: infer X) => X }
type F1 = (a: number, { b }: Opts, ...rest: string[]) => a is number
type F2 = new (x: number) => Plain
type Tuple = [first: string, second?: number, ...rest: boolean[]]
type Tmpl = \`\${Keys}-x\`
type Idx = Plain['x']
type Obj = {
  [key: string]: unknown
  method<T>(x: T): T
  prop: number
  [computedKey]: 1
  [computedMethod](): void
  new (): Obj
  (): void
  readonly ro?: string
}
function guard(this: Plain, x: unknown): asserts x is Plain {}
function guardThis(): this is Plain {
  return true
}
const constAssert = { a: 1 } as const
let typed: Plain | Array<Plain>
let fromLib: import('mod').Thing
type OnlyType = 1
const onlyValue = OnlyType
type FromValue = onlyValue
const biggest = Math.max(1)
const nothing = undefined
`,
  scopes: `S0 global Program 0-1214 up=- strict=0
S1 module Program 0-1214 up=0 strict=1
  V Q1 defs=Type@5 ids=5 t=1 v=0 refs=
  V Q2 defs=Type@28 ids=28 t=1 v=0 refs=
  V Q3 defs=Type@60 ids=60 t=1 v=0 refs=
  V Q4 defs=Type@91 ids=91 t=1 v=0 refs=
  V R1 defs=Type@135 ids=135 t=1 v=0 refs=
  V C1 defs=Type@165 ids=165 t=1 v=0 refs=
  V C2 defs=Type@245 ids=245 t=1 v=0 refs=
  V C3 defs=Type@319 ids=319 t=1 v=0 refs=
  V C4 defs=Type@389 ids=389 t=1 v=0 refs=
  V NoConditional defs=Type@431 ids=431 t=1 v=0 refs=
  V F1 defs=Type@487 ids=487 t=1 v=0 refs=
  V F2 defs=Type@556 ids=556 t=1 v=0 refs=
  V Tuple defs=Type@591 ids=591 t=1 v=0 refs=
  V Tmpl defs=Type@657 ids=657 t=1 v=0 refs=
  V Idx defs=Type@681 ids=681 t=1 v=0 refs=
  V Obj defs=Type@703 ids=703 t=1 v=0 refs=828
  V guard defs=FunctionName@877 ids=877 t=0 v=1 refs=
  V guardThis defs=FunctionName@940 ids=940 t=0 v=1 refs=
  V constAssert defs=Variable@991 ids=991 t=0 v=1 refs=991
  V typed defs=Variable@1027 ids=1027 t=0 v=1 refs=
  V fromLib defs=Variable@1059 ids=1059 t=0 v=1 refs=
  V OnlyType defs=Type@1093 ids=1093 t=1 v=0 refs=
  V onlyValue defs=Variable@1112 ids=1112 t=0 v=1 refs=1112
  V FromValue defs=Type@1138 ids=1138 t=1 v=0 refs=
  V biggest defs=Variable@1166 ids=1166 t=0 v=1 refs=1166
  V nothing defs=Variable@1194 ids=1194 t=0 v=1 refs=1194
  R 17 value r v init=0 we=- => ext
  R 40 ns r v init=0 we=- => ext
  R 140 Other r t init=0 we=- => ext
  R 153 Plain r t init=0 we=- => ext
  R 667 Keys r t init=0 we=- => ext
  R 687 Plain r t init=0 we=- => ext
  R 775 computedKey r v init=0 we=- => ext
  R 794 computedMethod r v init=0 we=- => ext
  R 991 constAssert w v init=1 we=1005 => S1:constAssert
  R 1017 const r t init=0 we=- => ext
  R 1034 Plain r t init=0 we=- => ext
  R 1042 Array r t init=0 we=- => ext
  R 1048 Plain r t init=0 we=- => ext
  R 1112 onlyValue w v init=1 we=1124 => S1:onlyValue
  R 1124 OnlyType r v init=0 we=- => ext
  R 1150 onlyValue r t init=0 we=- => ext
  R 1166 biggest w v init=1 we=1176 => S1:biggest
  R 1176 Math r v init=0 we=- => ext
  R 1194 nothing w v init=1 we=1204 => S1:nothing
  R 1204 undefined r v init=0 we=- => ext
  T 17,40,140,153,211,402,455,511,580,667,687,775,794,889,922,961,1017,1034,1042,1048,1124,1150,1176,1204
S2 type TSTypeAliasDeclaration 160-239 up=1 strict=1
  V T defs=Type@168 ids=168 t=1 v=0 refs=173,201
  T 211
S3 conditionalType TSConditionalType 173-239 up=2 strict=1
  V U defs=Type@190 ids=190 t=1 v=0 refs=197
  R 173 T r t init=0 we=- => S2:T
  R 197 U r t init=0 we=- => S3:U
  T 173
S4 conditionalType TSConditionalType 201-239 up=2 strict=1
  V V defs=Type@225 ids=225 t=1 v=0 refs=230
  R 201 T r t init=0 we=- => S2:T
  R 211 Promise r t init=0 we=- => ext
  R 230 V r t init=0 we=- => S4:V
  T 201,211
S5 type TSTypeAliasDeclaration 240-313 up=1 strict=1
  V T defs=Type@248 ids=248 t=1 v=0 refs=253,277
  T\x20
S6 conditionalType TSConditionalType 253-313 up=5 strict=1
  V N defs=Type@288 ids=288 t=1 v=0 refs=304
  R 253 T r t init=0 we=- => S5:T
  R 304 N r t init=0 we=- => S6:N
  T 253,277
S7 mappedType TSMappedType 263-301 up=6 strict=1
  V K defs=Type@266 ids=266 t=1 v=0 refs=
  R 277 T r t init=0 we=- => S5:T
  T 277
S8 type TSTypeAliasDeclaration 314-383 up=1 strict=1
  V T defs=Type@322 ids=322 t=1 v=0 refs=327
  T\x20
S9 conditionalType TSConditionalType 327-383 up=8 strict=1
  V A defs=Type@353 ids=353 t=1 v=0 refs=370
  V R defs=Type@365 ids=365 t=1 v=0 refs=373
  R 327 T r t init=0 we=- => S8:T
  R 370 A r t init=0 we=- => S9:A
  R 373 R r t init=0 we=- => S9:R
  T 327
S10 functionType TSFunctionType 337-366 up=9 strict=1
  V args defs=Parameter@341 ids=341 t=0 v=1 refs=
  T\x20
S11 mappedType TSMappedType 394-425 up=1 strict=1
  V K defs=Type@397 ids=397 t=1 v=0 refs=416,422
  R 402 Keys r t init=0 we=- => ext
  R 416 K r t init=0 we=- => S11:K
  R 422 K r t init=0 we=- => S11:K
  T 402
S12 mappedType TSMappedType 447-481 up=1 strict=1
  V K defs=Type@450 ids=450 t=1 v=0 refs=
  R 455 Keys r t init=0 we=- => ext
  T 455
S13 functionType TSFunctionType 462-479 up=12 strict=1
  V x defs=Parameter@463 ids=463 t=0 v=1 refs=
  V X defs=Type@472 ids=472 t=1 v=0 refs=478
  R 478 X r t init=0 we=- => S13:X
  T\x20
S14 functionType TSFunctionType 492-550 up=1 strict=1
  V a defs=Parameter@493 ids=493 t=0 v=1 refs=539
  V b defs=Parameter@506 ids=506 t=0 v=1 refs=
  V rest defs=Parameter@520 ids=520 t=0 v=1 refs=
  R 511 Opts r t init=0 we=- => ext
  R 539 a r v init=0 we=- => S14:a
  T 511
S15 functionType TSConstructorType 561-585 up=1 strict=1
  V x defs=Parameter@566 ids=566 t=0 v=1 refs=
  R 580 Plain r t init=0 we=- => ext
  T 580
S16 functionType TSMethodSignature 738-756 up=1 strict=1
  V T defs=Type@745 ids=745 t=1 v=0 refs=751,755
  V x defs=Parameter@748 ids=748 t=0 v=1 refs=
  R 751 T r t init=0 we=- => S16:T
  R 755 T r t init=0 we=- => S16:T
  T\x20
S17 functionType TSMethodSignature 793-817 up=1 strict=1
  T\x20
S18 functionType TSConstructSignatureDeclaration 820-831 up=1 strict=1
  R 828 Obj r t init=0 we=- => S1:Obj
  T 828
S19 functionType TSCallSignatureDeclaration 834-842 up=1 strict=1
  T\x20
S20 function FunctionDeclaration 868-930 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V this defs=Parameter@883 ids=883 t=0 v=1 refs=
  V x defs=Parameter@896 ids=896 t=0 v=1 refs=917
  R 889 Plain r t init=0 we=- => ext
  R 917 x r v init=0 we=- => S20:x
  R 922 Plain r t init=0 we=- => ext
  T 889,922
S21 function FunctionDeclaration 931-984 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  R 961 Plain r t init=0 we=- => ext
  T 961
`,
}
