# typescript/no-empty-object-type

Forbid the empty object type, written `{}` or as an interface without members.

## Rule Details

The type `{}` accepts every value except `null` and `undefined`, literals such as `0` and `""` included, which is rarely what its author meant: `object` says "any object" and `unknown` says "any value". This rule reports a `{}` type literal and an interface that declares no members and extends nothing. An interface that declares no members and extends exactly one type is reported as equivalent to that type; one extending two or more passes. A `{}` inside an intersection passes, since `T & {}` is the idiom for a non-nullable `T`. It does not fix.

Reimplements [typescript-eslint's `no-empty-object-type`](https://typescript-eslint.io/rules/no-empty-object-type).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/no-empty-object-type/#options), which allow empty interfaces, allow `{}` literals or exempt names matching a pattern, are not read, although the report text still names the option that would allow the construct upstream.

## Examples

### ❌ Incorrect

```ts
let value: {}

interface Props {}

interface ButtonProps extends Props {}
```

### ✅ Correct

```ts
let value: object
let anything: unknown

type NonNullable<T> = T & {}

interface LinkProps extends Props, Anchor {}
```

## Limitations

The original offers suggestions that replace `{}` with `object` or `unknown`, and that turn a single-supertype interface into a type alias; this rule reports without them.
