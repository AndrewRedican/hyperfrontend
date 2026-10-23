# typescript/no-wrapper-object-types

Forbid the wrapper object types `String`, `Number`, `Boolean`, `BigInt`, `Symbol` and `Object` as types.

## Rule Details

The upper-cased wrapper types describe boxed objects, not the primitives almost every value is: a `string` is not assignable from a `String`, and `Object` admits every value except `null` and `undefined`. This rule reports each wrapper used as a type, or in the `extends` of an interface or the `implements` of a class, when the name refers to the global. A type of the same name that the file declares or imports itself passes. The fix replaces a type reference with the lower-cased primitive (`Object` becomes `object`); a heritage clause is reported without a fix.

Reimplements [typescript-eslint's `no-wrapper-object-types`](https://typescript-eslint.io/rules/no-wrapper-object-types).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
function shout(text: String): Number {
  return text.length
}
```

### ✅ Correct

```ts
function shout(text: string): number {
  return text.length
}
```
