# models

Conventional-commit type system: type taxonomies, breaking-change models, factories, and semver-bump derivation.

`ConventionalCommit` and `CommitFooter` are the structured shapes produced by the parser; `createConventionalCommit` and `createCommitFooter` are the canonical factories. The `BreakingChange` model captures whether a commit declared a breaking change via `!` syntax or a `BREAKING CHANGE:` footer (`createBreakingFromFooter`, `createBreakingFromSubject`, `createNonBreaking`, `isBreakingFooterKey`). The `CommitType` taxonomy plus `COMMIT_TYPES`, `MINOR_TYPES`, `PATCH_TYPES`, `RELEASE_TYPES`, `isStandardType`, and `isReleaseType` answer the "what kind of commit is this?" questions, while `getSemverBump` maps a `(type, breaking)` pair to the corresponding `BumpType`.
