# How to publish release notes from your CHANGELOG.md

You will turn a version number and a `CHANGELOG.md` into the body of a release, in a script your CI job can run, that fails when the version is not in the file rather than publishing an empty release.

The file already says what shipped. Getting one version out of it is where release jobs go wrong: a regex over `##` headings works until an entry has a compare link in its heading, a scope in bold, or a breaking marker, and `sed` between two headings quietly takes the wrong section when the latest release is a rerun. [`@hyperfrontend/versioning`](/docs/libraries/versioning) parses [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) into a document you can query.

## 1. Install it

```bash
npm install --save-dev @hyperfrontend/versioning
```

## 2. Read the file into a document

[`parseChangelog`](/docs/libraries/versioning/changelog#api-parseChangelog) takes the markdown and returns the whole changelog as data: a header, and one [`ChangelogEntry`](/docs/libraries/versioning/changelog#api-ChangelogEntry) per version, each holding its date, compare URL, and sections.

```js
import { readFileSync } from 'node:fs'
import { parseChangelog } from '@hyperfrontend/versioning/changelog'

const changelog = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'))
```

## 3. Take the version you shipped, or stop

[`getEntryByVersion`](/docs/libraries/versioning/changelog#api-getEntryByVersion) returns that entry or nothing. Nothing means the release was tagged without its notes ever being written, which is worth failing on:

```js
import { getEntryByVersion } from '@hyperfrontend/versioning/changelog'

const version = process.argv[2]
const entry = getEntryByVersion(changelog, version)

if (!entry) {
  console.error(`CHANGELOG.md has no entry for ${version}`)
  process.exit(1)
}
```

## 4. Render that entry on its own

A changelog holding one entry and an empty header serialises to exactly that entry, so [`serializeChangelog`](/docs/libraries/versioning/changelog#api-serializeChangelog) writes the release body with the same formatting rules that wrote the file:

```js
import { createChangelog, serializeChangelog } from '@hyperfrontend/versioning/changelog'

const body = serializeChangelog(createChangelog({ header: { title: '', description: [], links: [] }, entries: [entry] }), {
  includeCompareUrls: false,
}).trim()
```

Turning off compare URLs keeps the version heading plain text, since the release page is already named after the tag. The rest of [`SerializeOptions`](/docs/libraries/versioning/changelog#api-SerializeOptions) tunes the same output: section order, headings, list markers, and whether commit and issue references come along.

## 5. Lead with what a reader needs to see first

Every [`ChangelogItem`](/docs/libraries/versioning/changelog#api-ChangelogItem) carries `breaking`, lifted off the item text during parsing, so an upgrade warning is one pass over the sections. The entry's `compareUrl` is the diff against the previous release:

```js
const breaking = entry.sections.some((section) => section.items.some((item) => item.breaking))

process.stdout.write(
  [
    breaking ? '> **This release contains breaking changes.**\n\n' : '',
    body,
    entry.compareUrl ? `\n\n**Full changelog**: ${entry.compareUrl}` : '',
  ].join('')
)
```

## Check it worked

Run the script against a version you have already released and pipe it where the release goes:

```bash
node release-notes.mjs 1.4.0 > notes.md
gh release create v1.4.0 --notes-file notes.md
```

`notes.md` holds that version's sections and nothing from its neighbours, with the breaking marker still on the items that had it. Ask for a version the file does not mention and the script exits `1` with the version named, before anything is published. Ask for the same version twice and you get byte-identical notes, which is what makes the job safe to re-run.
