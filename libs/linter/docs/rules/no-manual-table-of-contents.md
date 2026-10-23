# no-manual-table-of-contents

Forbid hand-written table-of-contents sections in markdown.

## Rule Details

Documentation sites and repository hosts draw an on-page index from a document's headings. A table of contents written by hand says the same thing a second time, goes stale as soon as a heading changes, and takes the first screen of the page away from the content. The rule reports a heading, at any level, whose whole text names an index once letter case, repeated spaces and trailing punctuation are set aside. The remedy is to remove the heading and the list under it. The rule does not fix.

The headings reported are: Table of Contents, Table of Content, Contents, TOC, Index, Index of Contents, Document Index, Page Index, Section Index, Quick Index, Full Index, Document Contents, Page Contents, Section Contents, Quick Contents, In this document, In this page, In this section and In this guide.

Only headings are read, so the word "index" in a sentence, a list item or a code block is never reported, and a heading about something else, such as "Index Signatures" or "Indexing the cache", carries words that do not name a table of contents.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```markdown
# Architecture

### Table of Contents

1. [Overview](#overview)
2. [Design](#design)

### Overview
```

### ✅ Correct

```markdown
# Architecture

### Overview

### Index Signatures

A mapped type with an index signature.
```

## When Not To Use It

When the documents are read somewhere that draws no index from the headings, such as a plain-text viewer or a printed handout.
