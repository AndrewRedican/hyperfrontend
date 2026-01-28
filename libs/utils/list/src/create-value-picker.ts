export interface ValuePicker {
  current: () => string
  next: () => string
}

export function createValuePicker(values: string[]): ValuePicker {
  if (!values || !values.length) {
    throw new Error('Expected values not to be an empty list.')
  }
  let index = -1
  function current() {
    if (index < 0) index = 0
    return values[index]
  }
  function next() {
    if (index < 0) return current()
    index = ++index < values.length ? index : 0
    return values[index]
  }
  return {
    current: current,
    next: next,
  }
}
