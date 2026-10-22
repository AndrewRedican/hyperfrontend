const numbers = [0, 1.5, .5, 5., 1e3, 1E-3, 0xFF, 0o17, 0b101, 1_000_000, 10n, 0xffn]
const strings = ['\u0041', 'a', "b", 'c\n\t\r\b\f\v\0', 'd\x41B\u{1F600}', 'line\
continued', '\'', "\"", '\z', '\0']
const templates = [tag`\1 ${a} \xZZ \u{110000} \u12`, `plain`, `with ${a} and ${`nested ${b}`}`, `\${escaped}`, `${a}${b}`, tag`tagged ${a}`, tag<string>`typed`]
const regexes = [/ab+c/gi, /[/\]]+/u, /\//, /a/ as RegExp]
const unary = [-a, +a, !a, ~a, typeof a, void 0, delete a.b, ++a, --a, a++, a--]
const binary = a + b - c * d / e % f ** g ** h
const comparison = a < b && c > d || e <= f && g >= h || a == b || a != b || a === b || a !== b
const bitwise = (a & b) | (c ^ d) | (e << f) | (g >> h) | (i >>> j)
const nullish = a ?? b
const assignments = [(a = 1), (a += 1), (a -= 1), (a *= 1), (a /= 1), (a %= 1), (a **= 1), (a <<= 1), (a >>= 1), (a >>>= 1), (a &= 1), (a |= 1), (a ^= 1), (a &&= 1), (a ||= 1), (a ??= 1)]
const destructured = [([a, b] = [1, 2]), ({ c, d: [e] } = {})]
const inOperator = 'x' in obj && obj instanceof Object && #priv in obj
const chain = obj?.a?.[b]?.(c).d!.e?.()
const calls = fn(a, ...rest)(b)(...c)
const members = obj.a[b].c['d']
const constructed = [new Target(), new Target, new Target<string>(a), new a.b.C(), new (fn())(), new new Outer()()]
const meta = [new.target, import.meta.url]
const dynamic = [import('x'), import('y', { with: { type: 'json' } })]
const sequence = (a, b, c)
const conditional = a ? b : c ? d : e
const arrows = [(x) => x, x => x * 2, (x, y) => ({ x, y }), async (x) => await x, async x => x, () => {}, (x: number): number => x, <T,>(x: T) => x, async () => {}, (...args) => args, ([a], { b }) => a]
const functions = [function () {}, function named() {}, async function () {}, function* () {}, async function* gen() {}]
const classes = [class {}, class Named extends Base {}, @decorated class {}]
const objects = {
  a,
  b: 1,
  'c': 2,
  3: 3,
  [d]: 4,
  method() {},
  async asyncMethod() {},
  *generatorMethod() {},
  async *both() {},
  get getter() {
    return 1
  },
  set setter(value) {},
  ...spread,
  get: 1,
  set: 2,
  async: 3,
  nested: { deep: { deeper: true } },
}
const arrays = [, 1, , ...spread, [nested]]
const asserted = [a as string, a as const, a satisfies string, <string>a, a!, a as unknown as number]
const instantiated = fn<string>
const parenthesised = ((a))
const awaited = async () => { await (a, b) }
const privateName = class { #x = 1; has(o) { return #x in o } }
const yieldInGenerator = function* () { const v = yield* other(); yield (a, b) }
let implicitGlobal
implicitGlobal = 1
const nullish2 = null
const taggedTyped = tag<string>`a ${b}`
