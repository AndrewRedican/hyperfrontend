# no-prototype-builtins

Forbid calling [`hasOwnProperty`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty), [`isPrototypeOf`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isPrototypeOf) and [`propertyIsEnumerable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/propertyIsEnumerable) directly on an object.

## Rule Details

These methods come from `Object.prototype`, so calling them on an arbitrary object trusts that object: it may shadow the method with a property of the same name, as parsed JSON can, or lack it entirely when it was made with `Object.create(null)`. The rule reports a call of one of the three methods as a member of any object, through dot or bracket access, optional chaining included. Call them through `Object.prototype`, or use `Object.hasOwn(object, key)`. The rule does not fix.

Reimplements [ESLint's `no-prototype-builtins`](https://eslint.org/docs/latest/rules/no-prototype-builtins).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const known = payload.hasOwnProperty('id')
const listed = payload?.['propertyIsEnumerable']('id')
const parent = base.isPrototypeOf(child)
```

### ✅ Correct

```ts
const known = Object.hasOwn(payload, 'id')
const listed = Object.prototype.propertyIsEnumerable.call(payload, 'id')
const parent = Object.prototype.isPrototypeOf.call(base, child)
```

## Limitations

The original offers suggestions that rewrite the call through `Object.prototype`; this rule reports without them.
