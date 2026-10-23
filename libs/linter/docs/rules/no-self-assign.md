# no-self-assign

Forbid assigning a variable or property to itself.

## Rule Details

`value = value` has no effect, and almost always stands where a different name was meant, such as `this.value = value` written as `value = value`. The rule reports the value side of an `=`, `&&=`, `||=` or `??=` assignment that names the same thing as its target: the same variable, the same member chain (`a.b.c = a.b.c`, optional chaining looked through), or a matching position inside array and object destructuring (`[a, b] = [a, c]` reports `a`). Destructuring positions after a spread are not compared, since the spread may change them. The rule does not fix.

Reimplements [ESLint's `no-self-assign`](https://eslint.org/docs/latest/rules/no-self-assign).

## Options

This rule has no options. The original's [`props`](https://eslint.org/docs/latest/rules/no-self-assign#options) option is not read: properties are always checked, the original's default.

## Examples

### ❌ Incorrect

```ts
count = count
config.port = config.port
;[first, second] = [first, third]
```

### ✅ Correct

```ts
count = next
config.port = other.port
;[first, second] = [second, first]
```
