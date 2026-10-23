# typescript/no-unused-expressions

Forbid expression statements whose value is thrown away.

## Rule Details

A statement that neither calls, assigns, awaits, yields, deletes nor uses `void` does nothing with the value it computes, which is usually a typo or a half-finished edit. This rule reports a statement made of a literal, a name, a member access, a binary, logical, conditional or unary operator, a sequence, an array, object, function or class expression, a template or a tagged template. Type assertions, non-null assertions, instantiation expressions and optional chains are looked through to the expression underneath. Directive prologue strings such as `'use strict'`, dynamic imports and JSX elements pass. It does not fix.

Reimplements [typescript-eslint's `no-unused-expressions`](https://typescript-eslint.io/rules/no-unused-expressions).

## Options

This rule has no options. The [original's options](https://eslint.org/docs/latest/rules/no-unused-expressions#options), which allow short-circuit and ternary expressions, allow tagged templates and check JSX, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```ts
config.enabled
ready && start()
count > 0 ? show() : hide()
user!.name as string
```

### ✅ Correct

```ts
'use strict'
start()
config.enabled = true
if (ready) start()
void import('./plugin')
```
