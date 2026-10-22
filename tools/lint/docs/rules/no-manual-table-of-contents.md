# no-manual-table-of-contents

Disallow hand-written table-of-contents sections in library markdown.

## Rule Details

The documentation site renders every library document with an on-page index generated from its headings, in the right-hand sidebar. A table of contents written by hand into the markdown says the same thing a second time, goes stale as soon as a heading changes, and takes the first screen of the page away from the content.

The rule applies to every markdown file under `libs/`, publishable or not, and reads headings structurally: only a heading whose whole text names an index is reported, at any level. The word `index` in a sentence, a list item, or a code block is never a heading and never reported, and a heading that is _about_ something (`Index Signatures`, `Content Security Policy`, `Indexing the cache`) carries words the rule does not treat as naming a table of contents.

Headings that are reported include, after case, spacing and trailing punctuation are ignored: `Table of Contents`, `Table of Content`, `Contents`, `TOC`, `Index`, `Document Index`, `Quick Index`, `Page Contents`, `Section Contents`, `Index of Contents`, and `In this document`.

The remedy is to remove the heading and the list under it. Renaming the section, moving it elsewhere, hiding it in the renderer, or disabling the rule all leave the redundant navigation in place.

## Examples

### ❌ Incorrect

```markdown
# Nexus Architecture

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Design Philosophy](#design-philosophy)

## Architecture Overview
```

### ✅ Correct

```markdown
# Nexus Architecture

## Architecture Overview
```

```markdown
## Index Signatures

A mapped type with an index signature ...
```

## Options

None.
