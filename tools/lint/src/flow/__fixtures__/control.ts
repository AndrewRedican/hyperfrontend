if (a) b()
if (a) b()
else c()
const t = a ? b : c
const l = a && b
const n = a ?? b
x ||= y
x += y
while (a) {
  if (b) continue
  if (c) break
  d()
}
while (true) {
  if (a) break
}
function forever() {
  while (/always/) {
    break
  }
  for (;;) {}
  after()
}
for (let i = 0; i < 3; i++) body()
for (let i = 0; ; i++) {
  if (i) break
}
for (const k in o) k()
for (const v of list) v()
do {
  if (a) continue
} while (a)
do {
  if (a) break
} while (true)
do {
  break
} while (b)
outer: for (const a of list) {
  inner: for (const b of list) {
    if (a) continue outer
    if (b) break outer
    break inner
  }
}
block: {
  if (a) break block
  b()
}
switch (a) {
  case 1:
    one()
  case 2:
    two()
    break
  default:
    three()
  case 3:
    four()
}
switch (a) {
  case 1:
    break
}
switch (a) {
}
