# no-loss-of-precision

Forbid number literals that a double-precision float cannot hold exactly as written.

## Rule Details

JavaScript numbers are 64-bit floats with about 15 to 17 significant decimal digits. A literal with more precision than that, such as `9007199254740993`, is silently stored as a nearby number, so the value the code uses is not the one the author wrote. The rule reports a number literal, in decimal, binary, octal or hexadecimal notation and with or without numeric separators, whose stored value no longer prints as the digits written. Trailing zeros and exponent notation that round-trip exactly pass. BigInt literals are never reported. The rule does not fix.

Reimplements [ESLint's `no-loss-of-precision`](https://eslint.org/docs/latest/rules/no-loss-of-precision).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const big = 9007199254740993
const long = 5123000000000000000000000000001
const precise = 1.230000000000000000000000000001
const hex = 0x20000000000001
```

### ✅ Correct

```ts
const big = 9007199254740991
const exact = 12345
const scaled = 1.23e30
const huge = 9007199254740993n
```
