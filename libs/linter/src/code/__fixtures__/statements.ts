'use strict'
;(function () {})()
var a = 1,
  b
let [c, , d = 2, ...e] = [1, 2, 3]
const { f, g: h, i = 3, ...j } = { f: 1 }
const [{ k }, [l]] = [{ k: 1 }, [2]]
label: for (let m = 0; m < 3; m++) {
  if (m === 1) continue label
  else if (m === 2) break label
  else {
  }
}
for (;;) break
for (var n in {}) {
}
for (const o of [1]) o
for await (const q of []) q
for (a = 0; a < 1; a++) a
for (let [r] of [[1]]) r
for (;;) {
  break
}
while (false) {}
do a++
while (false)
do {} while (false);
switch (a) {
  case 1:
  case 2: {
    break
  }
  default:
    a = 3
}
try {
  throw new Error('x')
} catch {
} finally {
}
try {
} catch (error) {
  error
}
try {
} catch ({ message }) {
  message
}
debugger;
;
if (a) a
else b
function declared(x, y = 1, ...rest) {
  return x
}
function* generator() {
  yield
  yield 1
  yield* generator()
  const inner = yield
}
async function asynchronous() {
  await a
  for await (const s of []) s
}
async function* both() {
  yield await 1
}
function hoisted() {
  return
}
function withThis(this: Window, arg: number): void {}
function overload(x: number): number
function overload(x: string): string
function overload(x: number | string): number | string {
  return x
}
outer: inner: a++
a = b ? c : d
if (a) {
} else if (b) {
}
using resource = acquire()
await using asyncResource = acquireAsync()
for ([t, u] of pairs) t
for ({ v } of objects) v
for (var w, x; ; ) break
for (await using y of []) y
const asyncInstance = async instanceof Function
class Sub extends Base {
  make() {
    return new super.constructor()
  }
}
const optionalTyped = obj?.<string>(a)
@(decorators.factory()) @plain.member class DecoratedWithCall {}
;[...rest] = source
;[a = 1, [b], { c }] = source
;({ d = 2, e: [f = 3] } = source)
;(a as any) += 1
;(b!) -= 1
await promise
await (promise)
;({ ...everything } = source)
for (item of items) item
for (obj.prop in source) {
}
await
promise2
