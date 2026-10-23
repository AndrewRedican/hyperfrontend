# max-file-lines

Limit the line count of files that hold more than one function.

## Rule Details

A long file with many functions usually carries more than one responsibility, and splitting it gives smaller modules that are easier to read, test and review. The rule counts the functions in a file (declarations, function expressions, arrow functions and class methods, inline callbacks included) and, when there are two or more, reports a file longer than its budget. A file with one function or none may be as long as it needs. The rule does not fix.

Test files, whose names end in `.spec` or `.test` followed by `.ts`, `.tsx`, `.js` or `.jsx`, have their own, higher budget.

## Options

| Option                     | Type     | Default | Meaning                                         |
| -------------------------- | -------- | ------- | ----------------------------------------------- |
| [`maxLines`](#options)     | `number` | `300`   | The most lines an implementation file may hold. |
| [`maxLinesTest`](#options) | `number` | `500`   | The most lines a test file may hold.            |

## Examples

### ❌ Incorrect, with { "maxLines": 4 }

<!-- options: {"maxLines": 4} -->

```ts
export function parse(input: string): string[] {
  return input.split(',')
}

export function validate(items: string[]): boolean {
  return items.every((item) => item.length > 0)
}
```

### ✅ Correct, with { "maxLines": 4 }, one function of any length

<!-- options: {"maxLines": 4} -->

```ts
export function parse(input: string): string[] {
  const items = input.split(',')
  const kept = items.filter(Boolean)
  return kept
}
```

## When Not To Use It

For generated files, or for files that are comprehensive by design, such as a module of type definitions. A per-file override is usually better than turning the rule off. Unlike [ESLint's `max-lines`](https://eslint.org/docs/latest/rules/max-lines), this rule exempts single-function files.

## Limitations

Lines are counted by line starts, so a file that ends with a newline counts the empty line after it: a 300-line file with a final newline counts as 301.
