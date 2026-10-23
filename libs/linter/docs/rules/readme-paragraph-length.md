# readme-paragraph-length

Report markdown paragraphs that have grown into walls of text.

## Rule Details

A paragraph is the unit a reader commits to before a break. Past a certain length the eye loses its place returning to the margin, the reader cannot tell which sentence carries the point, and a summariser has no boundary to summarise around. The remedy is rarely a break at the midpoint: it is one idea per paragraph, or fewer words. The rule reports a paragraph longer than [`maxCharacters`](#options). It does not fix.

The rule reads the markdown tree, so code blocks, tables, headings, HTML blocks and link definitions are never mistaken for prose. It measures rendered characters, not source characters:

| Node                         | Contributes                       |
| ---------------------------- | --------------------------------- |
| text and inline code         | its text                          |
| link, link reference         | the link text only, never the URL |
| emphasis, strong, delete     | the text inside                   |
| image, image reference       | nothing                           |
| inline HTML, hard line break | nothing                           |

Runs of whitespace collapse to one space before the count, so a paragraph hard-wrapped over ten source lines measures the same as one written on a single line. A paragraph inside a list item, a blockquote, a table cell or a footnote definition is exempt: those are fragments whose length the surrounding structure governs.

## Options

| Option                      | Type     | Default | Meaning                                                          |
| --------------------------- | -------- | ------- | ---------------------------------------------------------------- |
| [`maxCharacters`](#options) | `number` | `700`   | Rendered characters a paragraph may reach before it is reported. |

Seven hundred is about six lines at a typical documentation column of 115 characters, and sits above the 95th percentile of paragraph length in a sample of nearly a thousand library README paragraphs, so the rule flags genuine walls of text and stays silent on ordinary technical writing.

## Examples

### ❌ Incorrect, with { "maxCharacters": 200 }

<!-- options: {"maxCharacters": 200} -->

```markdown
The host owns the geometry and the feature never measures itself, which
means the contract declares every display mode up front, and the host picks
one at open time and passes the measured size across, and because the
feature cannot ask for a different size its only lever is to refuse a mode.
```

### ✅ Correct, with { "maxCharacters": 200 }

<!-- options: {"maxCharacters": 200} -->

```markdown
The host owns the geometry: a feature never measures itself. The contract
declares every display mode, and the host picks one at open time.

A feature's only lever is refusal: it can decline a mode it cannot render.

- A list item is a fragment, so its length is left to the list around it,
  however many words it takes to describe the step it stands for in full.
```

## When Not To Use It

For generated documents, or transcripts that must keep their original paragraphing. Raising [`maxCharacters`](#options) is the better lever when a whole package's documentation is legitimately denser than the rest.
