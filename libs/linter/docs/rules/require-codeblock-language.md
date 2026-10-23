# require-codeblock-language

Require a language on every fenced code block in markdown.

## Rule Details

The language after the opening fence is what lets a renderer highlight the block, a screen reader announce it, and tools such as [codeblock-line-width](./codeblock-line-width.md) tell code from output. A reader also knows at a glance what they are looking at. The rule reports an opening fence of backticks with nothing after it. For output or plain text, use the language text or console. The rule does not fix.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

````markdown
```
const x = 1
```
````

### ✅ Correct

````markdown
```ts
const x = 1
```

```json
{ "name": "example" }
```

```text
This is plain text output
```
````

## Limitations

Fences are paired line by line without regard to their length, so a block fenced with four backticks that shows a three-backtick fence inside it is not read the way a markdown renderer reads it. Fences of tildes are not checked.
