type Keywords = [any, unknown, never, void, undefined, null, string, number, boolean, bigint, symbol, object, this]
type Literals = ['text', 1, -1, 1n, true, false, `template ${string} ${number}`]
type Reference = Map<string, Array<number>>
type Qualified = NS.Inner.Type<T>
type Union = | A | B | C
type Intersection = & A & B
type Mixed = (A | B) & (C | D)
type ArrayOf = string[][]
type Indexed = T['key'][number]
type Conditional = T extends string ? 'yes' : T extends (infer U extends number) ? U : never
type Inferred = T extends [infer Head, ...infer Tail] ? Head : never
type Mapped = { readonly [K in keyof T]?: T[K] }
type MappedModifiers = { -readonly [K in keyof T]-?: T[K] }
type MappedPlus = { +readonly [K in keyof T]+?: T[K] }
type MappedAs = { [K in keyof T as `get${Capitalize<K & string>}`]: () => T[K] }
type MappedBare = { [K in Keys] }
type MappedSemicolon = { [K in Keys]: V; }
type Operators = keyof T | unique symbol | readonly string[]
type FunctionType = (a: string, b?: number, ...rest: boolean[]) => void
type GenericFunction = <T>(value: T) => T
type ConstructorType = new (value: string) => Instance
type AbstractConstructor = abstract new () => Instance
type Tuple = [string, number?, ...boolean[]]
type NamedTuple = [first: string, second?: number, ...rest: boolean[]]
type RestNamed = [...head: string[], tail: number]
type Query = typeof value
type QueryMember = typeof value.member<string>
type QueryImport = typeof import('module')
type QueryThis = typeof this.member
type Imported = import('module')
type ImportedQualified = import('module').Nested.Type<string>
type Predicate = (value: unknown) => value is string
type AssertsPredicate = (value: unknown) => asserts value is string
type AssertsPlain = (value: unknown) => asserts value
type ThisPredicate = (this: Base) => this is Derived
type ParenthesisedFunction = ((a: string) => void) | null
type Optional = Partial<{ a?: string; b: number | undefined }>
type TemplateLiteral = `${Prefix}-${Suffix}`
type Negative = -1 | -2n
type ObjectLiteral = {
  property: string
  optional?: number
  readonly fixed: boolean
  method(a: string): void
  optionalMethod?(): void
  generic<T>(value: T): T
  (call: string): void
  <T>(generic: T): T
  new (construct: string): Instance
  new (bare: string)
  [index: string]: unknown
  readonly [readonlyIndex: number]: string
  get accessor(): string
  set accessor(value: string)
  'quoted': 1
  42: 2
  [computed]: 3
  nested: { deeper: { deepest: true } }
  arrow: (value: string) => void
  union: string | number,
  trailingComma: string,
}
interface Base<T = string> extends First, Second<T>, NS.Third {
  property: T
}
interface Empty {}
interface Extending extends Base<number> {
  extra: string
}
declare function ambient(a: string): void
declare const ambientConst: number
declare let ambientLet: string
declare var ambientVar: boolean
declare class AmbientClass {}
declare enum AmbientEnum {}
declare namespace AmbientNamespace {
  const inner: number
  function fn(): void
}
declare module 'quoted-module' {
  export const value: string
}
declare module Dotted.Namespace.Path {}
declare global {
  interface Window {
    extra: string
  }
}
declare abstract class AmbientAbstract {}
declare module 'shorthand'
namespace Plain {
  export namespace Nested {}
}
module LegacyModule {}
enum Numeric {
  A,
  B = 2,
  C = B * 2,
}
enum StringEnum {
  A = 'a',
  'quoted' = 'q',
}
const enum Constant {
  Only,
}
function withTypes<T extends string = 'x', const U = never>(a: T, b: U = 1 as U): asserts a is T {}
function returnsPredicate(value: unknown): value is string {
  return true
}
const annotated: Array<string> = []
const nonNull = annotated!
let withDefinite!: string
type Generic<in out T> = T
type ConditionalInUnion = A | (B extends C ? D : E)
type ReadonlyTuple = readonly [string, number]
type KeyofTypeof = keyof typeof value
type IndexAccess = Record<string, number>['x']
type NestedGenerics = Promise<Array<Map<string, Set<number>>>>
type Abstract = typeof AmbientAbstract
type ObjectKeyword = object
type FunctionInUnion = (() => void) | string
type InferConstraint = T extends [infer U extends string] ? U : never
type InferNoConstraint = T extends [infer U] ? U : never
type Intrinsic = intrinsic
abstract class WithOverloads {
  method(): void
  method(x?: number): void {}
}
let generic = fn<string, number>(a)
let instantiation = fn<string>
let callWithTypeArgs = obj.method<T>()
let newWithTypeArgs = new Container<string>()
let optionalCallTypeArgs = obj?.method<T>(a)
let tagged = tag<string>`x`
let comparison = a < b && c > d
let shift = a >> b >>> c
let generics = a < (b > c)
type InferInExtends = T extends infer U extends string ? U : never
type InferTuple = T extends [infer U extends string, infer V] ? [U, V] : never
type ParenthesisedKeyof = keyof (A | B)
type AbstractReference = abstract
let constAssertedTuple = [1, 2] as const
type Bare = { a; b }
type Signatures = { method(); generic<T>(x: T) }
type InferOutside = infer U extends string ? U : never
interface Indexed {
  [key: string]: unknown; ['c']: 1
}
interface Listed {
  [key: number]: unknown, ['d']: 2
}
