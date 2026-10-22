@component({ selector: 'x' })
@sealed
export class Decorated<T extends object = {}> extends Base<T> implements First, Second<T> {
  static staticField = 1
  readonly readonlyField: string = 'x'
  declare declared: number
  definite!: number
  optional?: string
  private privateField
  protected protectedField
  public publicField
  override overridden = 2
  accessor auto = 3
  static accessor staticAuto = 4
  #secret = 5
  static #staticSecret = 6
  'quoted' = 7
  42 = 8
  [computed] = 9
  @log method(@param a: string, b?: number, ...c: string[]): void {}
  async asyncMethod() {}
  *generatorMethod() {}
  async *bothMethod() {}
  static staticMethod() {}
  get accessor() {
    return 1
  }
  set accessor(value) {}
  static get staticGetter() {
    return 1
  }
  #privateMethod() {}
  get #privateGetter() {
    return 1
  }
  override overriddenMethod() {}
  overloaded(x: number): void
  overloaded(x: string): void
  overloaded(x: number | string): void {}
  constructor(public readonly a: string, protected b: number, private c?: boolean, override d = 1) {
    super()
  }
  [Symbol.iterator]() {}
  static {
    Decorated.staticField = 2
  }
  static;
  get;
  set;
  async;
  declare;
  readonly;
  [key: string]: unknown
  static [key: number]: string
  public static readonly combined = 1
}
export abstract class Abstract {
  abstract abstractMethod(): void
  abstract abstractProperty: string
  protected abstract get abstractGetter(): string
  concrete() {}
}
declare class Ambient {
  field: string
  method(): void
}
class Minimal {}
const expression = class Named extends (a ? B : C) {}
class Generic<const T, in U, out V, W = string> {}
class Semicolons {
  a = 1;
  b() {};
  c
}
class UsesThis {
  method(this: UsesThis) {}
  untyped(this) {}
  modifierNames(readonly, public = 1) {}
  public
  pub = 1;
  ['quoted key'] = 2;
  [noType: string]
  @dec(...args, 1) decoratedWithSpread() {}
  generic<T>(value: T) {}
  static
  separated = 1
}
