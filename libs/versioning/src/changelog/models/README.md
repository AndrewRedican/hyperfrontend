# models

Type definitions and factory functions for the changelog data model.

Exposes `Changelog`, `ChangelogHeader`, `ChangelogEntry`, `ChangelogSection`, `ChangelogItem`, `CommitRef`, and `IssueRef`, along with `create*` factories, the section-type registry (`SECTION_HEADINGS`, `getSectionType`), and the JSON schema (`changelogSchema`, `validateChangelog`). All other `changelog/*` submodules consume these shapes.
