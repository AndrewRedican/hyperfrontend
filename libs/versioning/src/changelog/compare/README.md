# compare

Equality checks and structural diffs for changelogs, entries, sections, items, and references.

## Overview

`compare/` answers two questions: are two changelogs equivalent, and where do they differ? Equality functions (`isChangelogEqual`, `isEntryEqual`, `isSectionEqual`, ...) perform deep value comparison ignoring incidental ordering where appropriate. Diff functions (`diffChangelogs`, `diffEntries`, `summarizeDiff`) produce structured `ChangelogDiff` reports describing added, removed, and modified pieces — useful for round-trip tests, merge conflict resolution, and changelog drift detection in CI.

## See Also

- [models/](../models/README.md) — Shapes being compared
- [operations/merge](../operations/README.md) — Consumes diffs to drive merges
