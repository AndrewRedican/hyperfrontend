# compare

Equality checks and structural diffs for changelogs, entries, sections, items, and references.

## Overview

`compare/` answers two questions: are two changelogs equivalent, and where do they differ? Equality functions (`isChangelogEqual`, `isEntryEqual`, `isSectionEqual`, ...) perform deep value comparison ignoring incidental ordering where appropriate. `isEntryContentEqual` compares what an entry says about its release (version and sections) and ignores the date and compare URL, which are stamped at generation time and drift when the same entry is regenerated later. Diff functions (`diffChangelogs`, `diffEntries`, `summarizeDiff`) produce structured `ChangelogDiff` reports describing added, removed, and modified pieces. Useful for round-trip tests, merge conflict resolution, and changelog drift detection in CI.

## See Also

- [models/](../models/README.md): Shapes being compared
- [operations/merge](../operations/README.md): Consumes diffs to drive merges
