# codeblock-line-width

Flag code lines in documentation that are wide for their shape and would read better one entry per line.

## Rule Details

Code in the documentation is read on phones, where the site renders it at twelve pixels in a column about 330px wide. That shows forty-five characters of a line; everything past that scrolls sideways inside the block. Scrolling is the right behaviour for a line that has to be wide, and the wrong outcome for a line that only happens to be: an object literal with four members on one line, a call with five arguments, a shell command with a run of flags. Those read better one entry per line on every screen, and on a phone the difference is whether the example can be read at all.

The rule is authoring feedback for the second kind of line only. It is not a width limit, and it is separate from how the site decides to draw a block at half or full width. It reports a line when three things are true at once:

1. The line is wider than `minLineLength` and no wider than `maxLineLength`, tabs counted as four columns.
2. Nothing about the line exempts it (see below).
3. The line has a shape vertical formatting would fix: in a shell block, a command with two or more flags or six or more words; in any other block, a bracketed span that opens and closes on the same line and holds three or more entries.

### Lines the rule leaves alone

Some lines are wide for a reason no reformatting would change, and the rule never reports them:

| Line                                                             | Why                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Contains a URL                                                   | A URL is one token and cannot be folded                          |
| Contains a token of 32 or more characters with no space          | A hash, a path, a key, a generated value                         |
| Starts as a comment (`//`, `#`, `*`, `/*`, `<!--`, `--`)         | Prose, not code                                                  |
| Starts with `import` or `export`                                 | Names one module however long its list is                        |
| A `function`, `type`, `interface`, `class` or `abstract` line    | A declaration is the one place a whole shape is expected at once |
| A method or function-typed member signature                      | Same                                                             |
| Any line in a `text`, `console`, `diff`, `http`, `mermaid` block | Output, data or a diagram; its width is whatever it shows        |
| Any line wider than `maxLineLength`                              | That wide, the width is deliberate                               |

Strings and nested brackets are skipped when entries are counted, so a comma inside a string is not an entry and `f(a, g(b, c))` holds two entries, not three.

## Options

| Option          | Type     | Default | Description                                                        |
| --------------- | -------- | ------- | ------------------------------------------------------------------ |
| `minLineLength` | `number` | `80`    | Rendered columns a line may reach before it is a candidate.        |
| `maxLineLength` | `number` | `140`   | Rendered columns past which a line's width is taken as deliberate. |

```js
'workspace/codeblock-line-width': ['warn', { minLineLength: 80, maxLineLength: 140 }]
```

### Why 80 and 140

Both are calibrated against the site's own geometry and the repository's own samples rather than picked from the air.

A phone shows about forty-five characters of a code line and a small laptop's document column about seventy-three, so a line past eighty scrolls on every screen narrower than a mid-sized laptop; eighty is also the column most editors wrap at, so an author already expects to be asked about a line that crosses it. Across the 8,200 code lines in the library READMEs, architecture documents, guides and articles, lines between eighty and a hundred and forty with a foldable shape number about fifty, and reading them confirms the calibration: `session: { protocol: 'v4', role: 'initiator', localId: hostId, peerId: guestId },`, `createLogger(console.error, console.warn, console.log, console.info, console.debug)`, `npm uninstall commitizen cz-conventional-changelog @commitlint/cli @commitlint/config-conventional`. Lowering the floor to seventy-two doubles the count and starts catching lines with a single short argument list, which is not the shape the rule is for.

Past a hundred and forty the corpus holds a handful of lines, every one of them a declaration or a signature the exemptions already cover. The ceiling is there so that a deliberately wide line, a table of output, a minified sample, is never mistaken for a sample that grew.

The rule is configured as a warning: the corpus that predates it keeps building, and every new wide line is pointed out where it is written.

## Examples

### ❌ Incorrect

````markdown
```typescript
const channel = createChannel('link', { send, receive, protocolProvider, session: nextSession, onDrop })
```
````

````markdown
```bash
npm uninstall commitizen cz-conventional-changelog @commitlint/cli @commitlint/config-conventional
```
````

### ✅ Correct

````markdown
```typescript
const channel = createChannel('link', {
  send,
  receive,
  protocolProvider,
  session: nextSession,
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

### ✅ Also Correct

A URL, a declaration and a block of output are all left alone at any width:

````markdown
```bash
git clone https://github.com/YOUR_USERNAME/hyperfrontend.git --depth 1 --branch main --single-branch
```

```typescript
function createUnencryptedPacket<T = any>(origin: string, target: string, data: Data<T>): UnencryptedPacket<T>
```

```text
DEBUG [config] resolving orders.json against /home/you/sync/projects/example/config/orders.json
```
````

## When Not To Use It

If a document is a transcript or a generated reference whose lines have to keep their exact shape, turn the rule off for that file. Raising `minLineLength` is the better lever for a package whose samples are legitimately denser than the rest.

## Related Rules

- [require-codeblock-language](./require-codeblock-language.md) - Requires a language on every fenced code block, which is also what tells this rule a block is output
- [readme-paragraph-length](./readme-paragraph-length.md) - The same idea for prose: a paragraph that has grown past what a reader commits to
- [no-ascii-art-diagrams](./no-ascii-art-diagrams.md) - Encourages Mermaid diagrams over ASCII art
