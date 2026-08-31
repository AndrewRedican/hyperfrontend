# Release Rationale in the Changelog

**Current State:** When a release carries no qualifying commits, the generated entry states the
fact and nothing more: `Released with no functional changes since 0.1.1.` for a package that has
been published before, or `Initial release` for one that has not
(`libs/versioning/src/flow/steps/generate-changelog.ts`).

**Gap:** There is nowhere to record WHY the release happened. The tool can observe that nothing
changed; it cannot know that the maintainer was promoting a long-stable package to `1.0.0`,
re-publishing after a registry incident, or cutting a version to carry a relicensing. That
reason is often the only interesting thing about such a release, and it is exactly what a reader
of the changelog wants.

**Future Direction:** A caller-supplied release note that is appended to the generated entry,
independent of whether any commits were classified. Something in the shape of a `releaseNote`
flow option and a matching executor option, so the entry can read:

```
### Other

- Released with no functional changes since 0.1.1.
- Promoted to stable.
```

**Notes:**

- Keep the note orthogonal to the reason. The library should not try to infer intent, for
  example by treating a forced major bump on a `0.x` version as a promotion to stable: that
  inference is correct exactly once and wrong the moment someone majors a `1.x` package.
- The value belongs on the entry, not the section, so it survives the case where commits DO
  exist and the entry already has Features and Bug Fixes sections.
- Worth deciding whether the note is free text or a small closed vocabulary. Free text is more
  useful and matches how maintainers actually write; a vocabulary would be machine-readable but
  is unlikely to cover the cases that motivate the feature.
- FOLLOW-UP REQUIRED: this is a genuine capability gap, not a defect. Nothing today produces a
  wrong changelog because of it; the entry is simply less informative than it could be.
