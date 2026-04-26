# compare

Version-comparison primitives: equality, strict ordering, range satisfaction, and sort utilities.

`compare`, `eq`, `lt`, `lte`, `gt`, `gte`, and `neq` are the basic ordering operators over `SemVer` values. `satisfies`, `satisfiesComparator`, `maxSatisfying`, and `minSatisfying` answer range-membership and best-fit questions against `Range` and `Comparator` shapes. `sort` and `sortDescending` produce stable orderings; `max` and `min` are the convenience reductions. Behavior is fully spec-compliant with semver precedence, including the prerelease tie-breaker rules.
