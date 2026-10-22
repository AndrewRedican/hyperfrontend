const chained = a?.b?.[c]?.(d).e
const plain = a.b(c)
const arrow = (p = q) => p
const expression = function named() {
  return named
}
class C {
  field = compute()
  static count = 0;
  [key] = 1
  method() {
    return this.field
  }
  static {
    C.count += 1
  }
  get value() {
    return 1
  }
  declare typed: number
}
const { x = 1, ...rest } = source
const element = <div onClick={() => go()}>{text}</div>
function unreachable() {
  return early
  late()
}
label: {
}
