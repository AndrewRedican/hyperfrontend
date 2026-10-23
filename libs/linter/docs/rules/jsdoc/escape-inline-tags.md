# jsdoc/escape-inline-tags

Forbid an unescaped `@name` inside the text of a JSDoc block.

## Rule Details

Documentation tools read an `@` followed by a word as the start of a tag, so `@scope` in the middle of a sentence can split the description or create a bogus tag. This rule reports an `@` that starts a word, at the start of a line or after whitespace, in a block's description and in the text of its tags, except inside `@example`. The message names the three ways to write it: as an inline tag `{@name}`, escaped as `\@name`, or in backticks. Names in the allowed list are left alone. It does not fix.

Reimplements [eslint-plugin-jsdoc's `escape-inline-tags`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/escape-inline-tags.md).

## Options

| Option                                                                                                                 | Type     | Default | Meaning                                                           |
| ---------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------- |
| [`allowedInlineTags`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/escape-inline-tags.md#options) | string[] | `[]`    | Names, without `@`, that may appear unescaped, such as `"scope"`. |

The original's options that enable a fixer and choose its escaping style are not read.

## Examples

### ❌ Incorrect

```ts
/**
 * Publishes the packages under @acme to the registry.
 */
export function publish(): void {
  return undefined
}
```

### ✅ Correct

```ts
/**
 * Publishes the packages under `@acme` to the registry.
 */
export function publish(): void {
  return undefined
}
```

<!-- options: {"allowedInlineTags": ["acme"]} -->

```ts
/**
 * Publishes the packages under @acme to the registry.
 */
export function publish(): void {
  return undefined
}
```
