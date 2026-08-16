# parse

Version and range parsing, with both strict and permissive variants.

`parseVersion(input)` accepts the common loose forms (leading `v`, missing patch, etc.) and returns a `ParseVersionResult`; `parseVersionStrict` rejects anything that isn't fully spec-compliant. `coerceVersion` is the most permissive option: it pulls a usable `SemVer` out of arbitrary inputs like `"v1"`, `"1.2"`, or `"1.2.3.4"` for use cases where semver-ish input must be normalized. `parseRange` and `parseRangeStrict` are the equivalents for npm-style range syntax (`^1.2.0`, `~1.2`, `>=1.0.0 <2.0.0`, ...) and return a `ParseRangeResult` carrying either the parsed `Range` or a structured failure reason.
