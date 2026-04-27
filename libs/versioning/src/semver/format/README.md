# format

String formatting for semver values, ranges, and comparators.

`format(version)` produces the canonical `MAJOR.MINOR.PATCH[-prerelease][+build]` rendering for a `SemVer`. `formatSimple` strips prerelease/build metadata when only the numeric core is wanted. `formatRange` and `formatComparator` round-trip a parsed `Range` or `Comparator` back to the npm-flavored range syntax they came from.
