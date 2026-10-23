# codeblock-line-width

Report documentation code lines that are wide only because they cram a list onto one line.

## Rule Details

On a phone a code block shows about forty-five characters of a line, and the rest scrolls sideways. Scrolling is right for a line that has to be wide and wrong for one that only happens to be: an object literal with four members, a call with five arguments, a shell command with a run of flags. Those read better one entry per line on every screen. The rule is authoring feedback for that second kind of line, not a width limit, and it does not fix. It reports a line of a fenced code block in markdown when all three hold:

1. The line is wider than [`minLineLength`](#options) and no wider than [`maxLineLength`](#options), tabs counted as four columns.
2. Nothing about the line exempts it (see below).
3. The line has a shape vertical formatting would fix: in a shell block (bash, sh, zsh, PowerShell and the like), a command with two or more flags or six or more words; in any other block, a bracketed span that opens and closes on the line and holds three or more entries.

Strings and nested brackets are skipped when entries are counted, so a comma inside a string is not an entry and `f(a, g(b, c))` holds two entries, not three.

### Lines the rule leaves alone

| Line                                                                    | Why                                       |
| ----------------------------------------------------------------------- | ----------------------------------------- |
| Contains a URL                                                          | A URL is one token and cannot be folded   |
| Contains a token of 32 or more characters with no space                 | A hash, a path, a key, a generated value  |
| Starts as a comment (`//`, `#`, `*`, `/*`, `<!--`, `--`)                | Prose, not code                           |
| Starts with `import` or `export`                                        | Names one module however long its list is |
| A function, type, interface, class or abstract class declaration        | A declaration shows a whole shape at once |
| A method or function-typed member signature                             | Same                                      |
| Any line of a text, console, diff, http, mermaid, markdown or csv block | Output, data or a diagram keeps its width |
| Any line wider than [`maxLineLength`](#options)                         | That wide, the width is deliberate        |

## Options

| Option                      | Type     | Default | Meaning                                                            |
| --------------------------- | -------- | ------- | ------------------------------------------------------------------ |
| [`minLineLength`](#options) | `number` | `80`    | Rendered columns a line may reach before it is a candidate.        |
| [`maxLineLength`](#options) | `number` | `140`   | Rendered columns past which a line's width is taken as deliberate. |

Eighty is past what a phone or a small laptop's document column shows and is the column most editors wrap at. Lowering it toward seventy starts catching lines with a single short argument list, which is not the shape the rule is for. Past a hundred and forty, sampled documentation holds only declarations and signatures the exemptions already cover; the ceiling keeps a deliberately wide line, such as a minified sample, from being mistaken for one that grew.

## Examples

### ❌ Incorrect

````markdown
```ts
const channel = connect('link', { send, receive, provider, session: next, onDrop })
```
````

````markdown
```bash
npm uninstall commitizen cz-conventional-changelog @commitlint/cli @commitlint/config-conventional
```
````

### ✅ Correct

````markdown
```ts
const channel = connect('link', {
  send,
  receive,
  provider,
  session: next,
  onDrop,
})
```
````

````markdown
```bash
npm uninstall \
  commitizen cz-conventional-changelog \
  @commitlint/cli @commitlint/config-conventional
```
````

### ✅ Correct, wide by design

````markdown
```bash
git clone https://github.com/example/repository.git --depth 1 --branch main --single-branch
```

```ts
function createPacket<T = unknown>(origin: string, target: string, data: Data<T>): Packet<T>
```

```text
DEBUG [config] resolving orders.json against /home/you/projects/example/config/orders.json
```
````

## When Not To Use It

A transcript or a generated reference whose lines must keep their exact shape is better off with the rule turned off for that file. Raising [`minLineLength`](#options) is the better lever for a package whose samples are legitimately denser than the rest. The rule pairs with [require-codeblock-language](./require-codeblock-language.md), since the fence language is what tells it a block is output.
