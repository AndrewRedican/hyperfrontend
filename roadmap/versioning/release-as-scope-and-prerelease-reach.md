# releaseAs Scope and Prerelease Reach

**Current State:** `releaseAs` accepts only the three semantic keywords `major`, `minor`, and
`patch`. It is a bump instruction, not a version selector: the next version is always computed
by incrementing the current one.

**Position (settled):** This is the intended design and stays. `releaseAs` says how far to move,
not where to land. Arbitrary version strings are out of scope: accepting them would let a caller
name a version that does not follow from the current one, and the whole point of the flow is that
the next version is derived rather than asserted.

**Future Direction:** Document the limitation explicitly so the boundary is a stated guarantee
rather than an accident of the enum, and investigate the prerelease gap below.

**Notes:**

- The engine underneath is broader than the option exposed. `BumpType`
  (`libs/versioning/src/semver/models/version.ts:32`) already covers `premajor`, `preminor`,
  `prepatch` and `prerelease`, and `increment`
  (`libs/versioning/src/semver/increment/bump.ts:18`) takes a `prereleaseId`, producing versions
  like `1.2.4-alpha.0`. Prerelease bumps are therefore supported by the semver layer and
  reachable through the library API.
- They are NOT reachable through `releaseAs`. Both the flow config type
  (`libs/versioning/src/flow/models/types.ts:280`) and the executor schema enum
  (`tools/package/src/executors/version/schema.json:12`) narrow it to the three stable keywords.
  So a consumer can cut a prerelease with the library but not with the executor option.
- NEEDS INVESTIGATION: whether that narrowing is deliberate or incidental. If prerelease bumps
  are meant to be reachable from the executor, the four prerelease keywords plus a
  `prereleaseId` option are the natural extension and require no new concepts. If they are not,
  the narrowing should be stated as a decision here so it stops looking like an oversight.
- Whichever way that lands, the stable-keyword-only rule for arbitrary version strings is
  unaffected: prerelease keywords are still instructions, not literal versions.
