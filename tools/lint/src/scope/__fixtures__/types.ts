type Q1 = typeof value
type Q2 = typeof ns.inner.thing
type Q3 = typeof import('mod')
type Q4 = typeof import('mod').name<string>
type R1 = Other.Nested<Plain>
type C1<T> = T extends (infer U)[] ? U : T extends Promise<infer V> ? V : never
type C2<T> = T extends { [K in keyof T as infer N]: unknown } ? N : never
type C3<T> = T extends (...args: infer A) => infer R ? [A, R] : never
type C4 = { [K in Keys as `get${K}`]: K }
type NoConditional = { [K in Keys]: (x: infer X) => X }
type F1 = (a: number, { b }: Opts, ...rest: string[]) => a is number
type F2 = new (x: number) => Plain
type Tuple = [first: string, second?: number, ...rest: boolean[]]
type Tmpl = `${Keys}-x`
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
