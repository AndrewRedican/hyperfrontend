# parse

Conventional-commit message parser: header, body, and footers parsed without regex.

`parseConventionalCommit` is the main entry point — given a raw commit message it returns a `ConventionalCommit` (or throws if the format is invalid). `isConventionalCommit` is the non-throwing predicate for guard checks. The lower-level helpers (`parseHeader`, `parseBody`, `parseFooters`) are exposed for callers that need to operate on individual sections of a message; each returns a focused `ParsedHeader` / `ParsedBody` / `ParsedFooters` shape. All parsing is character-by-character with explicit state transitions, giving O(n) behavior and no catastrophic-backtracking risk; input length is capped at 10 KB.
