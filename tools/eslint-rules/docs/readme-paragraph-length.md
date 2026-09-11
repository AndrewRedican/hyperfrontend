# readme-paragraph-length

Flag README paragraphs that have grown into walls of text.

## Rule Details

A paragraph is the unit a reader commits to before they get a break. Past a certain length that commitment stops being reasonable: the eye loses its place returning to the left margin, the reader cannot tell which sentence carries the point, and an LLM summarising the package has no paragraph boundary to summarise around. The fix is almost never a break inserted at the midpoint. It is either one idea per paragraph, or fewer words.

The rule reads the markdown AST rather than the raw text, so a fenced code block, an indented code block, a table, a heading, a thematic break, an HTML block and a link reference definition are all distinct node types and none of them can be mistaken for prose. A `mermaid` block full of sentence-like node labels is a `code` node, and the badge block that opens a library README is an `html` node.

### How a paragraph is measured

The rule measures rendered characters, not source characters:

| Node                           | Contributes                       |
| ------------------------------ | --------------------------------- |
| `text`                         | its text                          |
| `inlineCode`                   | its text                          |
| `link`, `linkReference`        | the link text only, never the URL |
| `emphasis`, `strong`, `delete` | the text inside                   |
| `image`, `imageReference`      | nothing                           |
| `html` (inline)                | nothing                           |
| `break`                        | nothing                           |

A URL is not prose a reader parses word by word, so a long target must not be what pushes a paragraph over the line. Inline HTML is markup, and an image is looked at rather than read.

Runs of whitespace collapse to a single space before the count, so a paragraph hard-wrapped over ten source lines measures exactly the same as the same paragraph written on one.

### Paragraphs the rule leaves alone

A paragraph inside a `listItem`, a `blockquote`, a `tableCell` or a `footnoteDefinition` is exempt. Those are read as fragments, and their length is governed by the structure around them: a step in a numbered list, a quoted passage, a cell in an options table, an aside at the foot of the page.

### Scope

The rule applies to markdown that is either:

- **At the workspace root**: `README.md`, `ARCHITECTURE.md` and their neighbours.
- **Inside a publishable library**: the library's own `README.md` and every README below it, including the ones for secondary entry points, because all of them ship inside the published package.

Markdown in a library without `build` and `publish` targets, in an application, or in an unrelated directory is left alone.

## Options

| Option          | Type     | Default | Description                                                      |
| --------------- | -------- | ------- | ---------------------------------------------------------------- |
| `maxCharacters` | `number` | `700`   | Rendered characters a paragraph may reach before it is reported. |

```js
'workspace/readme-paragraph-length': ['error', { maxCharacters: 700 }]
```

### Why 700

The threshold is calibrated against the repository's own prose rather than picked from the air.

Across the 20 top-level publishable-library READMEs (365 prose paragraphs), rendered characters per paragraph fall out as:

| Percentile | Characters |
| ---------- | ---------- |
| p50        | 175        |
| p75        | 349        |
| p90        | 457        |
| p95        | 588        |
| p99        | 858        |
| max        | 2033       |

Across all 203 `libs/**/README.md` files (959 paragraphs) the same measure gives p50 139, p75 355, p90 535, p95 642, p99 858, max 2033, with 32 paragraphs over 700 characters.

The documentation site sets its prose measure at 58rem (928px). At 16px Inter that is roughly 115 rendered characters per line, so four rendered lines is about 460 characters (the p90) and six lines is about 700. Setting the limit at 700 puts it above the 95th percentile of what the repository already writes, which means the rule flags genuine walls of text and stays silent on ordinary technical writing.

## Examples

### ❌ Incorrect

```markdown
The host owns the geometry and the feature never measures itself, which means the contract has to declare every display mode the feature supports up front, and the host then picks one of them at open time and passes the measured dimensions across the wire in the Present message, and because the feature has no way to ask for a different size the only lever it has is to refuse a mode it cannot render, and that refusal has to happen during the handshake rather than after the frame is already visible, so the version gate runs first and the mode negotiation runs second, and if either of them fails the host tears the frame down before anything has been painted, which is the whole reason the open call is asynchronous rather than synchronous.
```

One paragraph carrying five separate facts, none of which the reader can find again.

### ✅ Correct

```markdown
The host owns the geometry: a feature never measures itself. The contract declares every display mode the feature supports, the host picks one at open time, and the measured dimensions travel in the `Present` message.

A feature's only lever is refusal. It can decline a mode it cannot render, but the refusal has to land during the handshake, not after the frame is visible. The version gate runs first, mode negotiation second, and a failure in either tears the frame down before anything is painted. That is why `open` is asynchronous.
```

Two paragraphs, one idea each, and the second one is shorter than the original was.

### ✅ Also Correct

A long options table, a quoted passage, a step in a numbered list and a footnote are all exempt:

```markdown
| Option | Description                                                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode` | Chooses the display mode. Every mode the contract declares is valid here, and the host resolves the choice against the modes the feature reported during the handshake, then measures the container and sends the result. |

> A quoted passage keeps whatever shape it had where it was quoted from, so the rule does not touch it.
```

## When Not To Use It

If a document is generated rather than written, or is a transcript that has to keep its original paragraphing, turn the rule off for that file. Raising `maxCharacters` is the better lever when a whole package's documentation is legitimately denser than the rest.

## Related Rules

- [lib-readme-structure](./lib-readme-structure.md) - Requires the sections a library README has to carry
- [require-codeblock-language](./require-codeblock-language.md) - Requires a language on every fenced code block
- [no-ascii-art-diagrams](./no-ascii-art-diagrams.md) - Encourages Mermaid diagrams over ASCII art
