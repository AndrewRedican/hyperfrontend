# models

Core semver data model: versions, ranges, comparators, and bump types with their factories and predicates.

`SemVer` is the parsed-version shape; `BumpType` is the `'major' | 'minor' | 'patch' | ...` enum that drives the increment logic. Version factories (`createSemVer`, `createInitialVersion`, `createFirstRelease`) and predicates (`isPrerelease`, `isStable`, `stripBuild`, `stripPrerelease`) cover the common construction and projection cases. `Range`, `Comparator`, `ComparatorSet`, and `RangeOperator` are the npm-style range shapes; `createRange`, `createAnyRange`, `createExactRange`, `createComparator`, `createComparatorSet`, and `isWildcard` are the corresponding builders and tests.
