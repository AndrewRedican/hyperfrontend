# increment

Version bumping: increment a `SemVer` by a `BumpType` and compute the diff between two versions.

`increment(version, bumpType)` produces the next version for `major`, `minor`, `patch`, and the equivalent prerelease bumps. `incrementPrerelease` is the dedicated helper for advancing `-rc.1` → `-rc.2` style identifiers without touching the numeric core. `diff(a, b)` returns the smallest `BumpType` that explains the change between two versions, used by changelog and dependent-package logic to decide what kind of bump a downstream package needs.
