# parse

Tokenizer and parser for converting Keep-a-Changelog markdown into structured `Changelog` objects.

`tokenize` walks markdown character-by-character to emit a typed `Token[]` stream: headings, list items, links, and section markers. `parseChangelog` consumes that stream and assembles entries, sections, and items in their declared order. Per-line helpers (`parseVersionFromHeading`, `parseCommitRefs`, `parseIssueRefs`, `parseBreakingFromItem`, `parseScopeFromItem`) extract the structured fragments embedded in entry headers and bullet items. `parseBreakingFromItem` lifts the breaking-change markers an item opens with onto the item's `breaking` flag, which is what keeps a parse then serialize round trip a fixpoint: the serializer re-emits exactly one marker, and any run of markers left by an earlier round trip collapses back to that one. No regex is used anywhere in the parsing pipeline, keeping behavior linear in input length and free of catastrophic backtracking risk.
