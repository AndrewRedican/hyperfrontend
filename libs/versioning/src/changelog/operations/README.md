# operations

Immutable transformations over `Changelog` objects — every operation returns a new value, leaving the input untouched.

Add operations (`addEntry`, `addUnreleasedEntry`, `releaseUnreleased`, `addItemToEntry`) build new entries and items into a changelog. Remove operations strip entries or sections by predicate. `filterEntries`, `filterSections`, and `filterItems` produce focused projections. `transform` applies arbitrary transformer functions per entry/section/item. The merge family (`mergeChangelogs`, configured via `MergeStrategy` and `MergeOptions`) combines two changelogs and reports `MergeResult` / `MergeStats` describing what was added, conflicted, or skipped — used for cross-branch and monorepo changelog reconciliation.
