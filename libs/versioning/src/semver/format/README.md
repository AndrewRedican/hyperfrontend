# format

String formatting for semver values, ranges, and comparators.

`format(version)` produces the canonical `MAJOR.MINOR.PATCH[-prerelease][+build]` rendering for a [`SemVer`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/models/#api-SemVer). [`formatSimple`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/format/#api-formatSimple) strips prerelease/build metadata when only the numeric core is wanted. [`formatRange`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/format/#api-formatRange) and [`formatComparator`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/format/#api-formatComparator) round-trip a parsed [`Range`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/models/#api-Range) or [`Comparator`](https://www.hyperfrontend.dev/docs/libraries/versioning/semver/models/#api-Comparator) back to the npm-flavored range syntax they came from.
