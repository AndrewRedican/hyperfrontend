let a = 1
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
tag<string>`x`
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
