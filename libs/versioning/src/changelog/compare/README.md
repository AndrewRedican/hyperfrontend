# compare

Equality checks and structural diffs for changelogs, entries, sections, items, and references.

## Overview

`compare/` answers two questions: are two changelogs equivalent, and where do they differ? Equality functions ([`isChangelogEqual`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/compare/#api-isChangelogEqual), [`isEntryEqual`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/compare/#api-isEntryEqual), [`isSectionEqual`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/compare/#api-isSectionEqual), ...) perform deep value comparison ignoring incidental ordering where appropriate. [`isEntryContentEqual`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/compare/#api-isEntryContentEqual) compares what an entry says about its release (version and sections) and ignores the date and compare URL, which are stamped at generation time and drift when the same entry is regenerated later. Diff functions ([`diffChangelogs`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/compare/#api-diffChangelogs), [`diffEntries`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/compare/#api-diffEntries), [`summarizeDiff`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/compare/#api-summarizeDiff)) produce structured [`ChangelogDiff`](https://www.hyperfrontend.dev/docs/libraries/versioning/changelog/compare/#api-ChangelogDiff) reports describing added, removed, and modified pieces. Useful for round-trip tests, merge conflict resolution, and changelog drift detection in CI.

## See Also

- [models/](../models/README.md): Shapes being compared
- [operations/merge](../operations/README.md): Consumes diffs to drive merges
