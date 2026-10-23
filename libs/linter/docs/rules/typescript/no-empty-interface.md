# typescript/no-empty-interface

Forbid interfaces that declare no members.

## Rule Details

An interface without members is the same as `{}`, which accepts any value except `null` and `undefined`, and an empty interface that extends one type is just that type under another name. This rule reports both. An empty interface extending two or more types passes, since it names their combination. The fix rewrites the single-supertype case as a type alias, keeping the type parameters; it is withheld when the interface merges with a class of the same name, or is declared inside an ambient module of a declaration file, where an alias would change meaning. The memberless case without a supertype has no fix.

Reimplements [typescript-eslint's `no-empty-interface`](https://typescript-eslint.io/rules/no-empty-interface), which typescript-eslint has since folded into [`no-empty-object-type`](./no-empty-object-type.md).

## Options

This rule has no options. The original's [`allowSingleExtends`](https://typescript-eslint.io/rules/no-empty-interface/#options) option is not read: an empty interface extending one type is always reported.

## Examples

### ❌ Incorrect

```ts
interface Props {}

interface ButtonProps extends Props {}
```

### ✅ Correct

```ts
type ButtonProps = Props

interface LinkProps extends Props, Anchor {}

interface Props {
  label: string
}
```

## Limitations

Where the fix is withheld, the original offers the type alias as a suggestion; this rule reports without one.
