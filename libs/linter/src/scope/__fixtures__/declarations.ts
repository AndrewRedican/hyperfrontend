import def, { named, type TypeOnly, other as aliased } from 'mod'
import * as ns from 'mod'
import type { T1 } from 'mod'
import eq = ns.inner.thing
import ext = require('mod')
export { named, type TypeOnly }
export type { T1 }
export { other } from 'mod'
export * from 'mod'
export default aliased
function decl(this: Window, p1, p2 = p1, { d1, d2 = d1 }: Opts, ...restParams: number[]): void {
  var inner
  decl()
}
function overload(x: string): void
function overload(x: number): void
function overload(x: unknown) {}
const expr = function named(q = named) {
  return named
}
const anon = function () {
  return arguments
}
const arrow = (p) => p
const arrowBody = (p) => {
  return p
}
@dec
class Decorated<T> extends Base<T> implements Iface {
  @prop field = this.other
  static staticField = Decorated
  declare declared: number
  accessor acc = 1;
  [computed] = 2
  constructor(@paramDec private readonly param: number, @paramDec other = param) {
    super()
  }
  @methodDec
  method<U>(this: Decorated<T>, @paramDec arg: U): U {
    return arg
  }
  static {
    Decorated.staticField
  }
  [index: string]: unknown
  get getter() {
    return 1
  }
  set setter(v) {}
  async *gen() {}
  [computedMethod]() {}
  signature(x: string): void
  signature(x: number): void
  signature(x: unknown) {}
  #priv = 1
  #privMethod() {
    return this.#priv
  }
}
abstract class Abs {
  abstract absMethod(): void
  abstract absProp: number
}
const classExpr = class Named {
  static x = Named
}
const anonClass = class {}
enum Color {
  Red,
  Green = Red + 1,
  'Blue' = Green,
}
declare enum Ambient {
  A,
}
namespace NS {
  export const inside = 1
  namespace Inner {
    const deep = inside
  }
}
declare module 'quoted' {
  const q: number
}
declare global {
  interface Window {
    extra: number
  }
}
interface Iface<T> extends Base<T>, Other.Nested {
  prop: T
  method(): void
}
interface Plain {
  x: number
}
type Alias<T> = T | Plain
type PlainAlias = string
export as namespace Lib
