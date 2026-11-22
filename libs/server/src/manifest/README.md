# manifest

Writes, reads and checks `hf-release.json`, the release manifest: an index of every file of one built artifact by path, size and SHA-256, under the artifact's name and version.

A name and a version can be built twice into different bytes, so the SHA-256 of the manifest file is what identifies the content of a release. This entry reads the disk and hashes with `node:crypto`, so it runs on Node.js only.

```ts
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { RELEASE_MANIFEST_FILENAME, createReleaseManifest, serializeReleaseManifest } from '@hyperfrontend/server/manifest'

const root = 'dist/shell'
const manifest = createReleaseManifest({
  root,
  name: '@acme/clock-shell',
  version: '1.4.0',
})

writeFileSync(join(root, RELEASE_MANIFEST_FILENAME), serializeReleaseManifest(manifest))
```

## Usage

[`createReleaseManifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-createReleaseManifest) indexes every regular file below the root, dotfiles included, and leaves out the manifest file at the root, since a manifest never lists itself. It throws when the directory holds a symbolic link or anything else that is neither a regular file nor a directory, naming each one, the manifest file included, and when it holds no file at all. What it returns has passed the validator.

To check a directory against its manifest, parse the file and verify the directory:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RELEASE_MANIFEST_FILENAME, parseReleaseManifest, releaseManifestDigest, verifyRelease } from '@hyperfrontend/server/manifest'

const root = 'node_modules/@acme/clock-shell'
const source = join(root, RELEASE_MANIFEST_FILENAME)
const bytes = readFileSync(source)

const digest = releaseManifestDigest(bytes)
const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
const issues = verifyRelease(root, parseReleaseManifest(text, source))
// [] when the directory holds exactly the listed bytes and nothing else
```

Decode the file strictly, as above: a decoder that replaces a malformed byte or drops a byte order mark gives one text for several byte sequences, and the digest is of the bytes.

A manifest is not a signature. Whoever can replace a file of the directory can replace the manifest beside it, so an empty result says only that the directory agrees with the manifest it carries. To pin a release, compare the digest with one obtained from somewhere you trust: [`verifyRelease`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-verifyRelease) does not check it.

Two parts of the workspace rely on the file. `hf build` in [`@hyperfrontend/features`](https://www.hyperfrontend.dev/docs/libraries/features/) writes one into every shell it builds, and lists it in the package's files so it is published with them. [`runService`](https://www.hyperfrontend.dev/docs/libraries/server/#api-runService) reads the one beside a built service's main before the service starts: it requires the canonical form, verifies the directory, refuses to boot on any issue, and prints the digest in its started line.

The three file-system operations are replaceable through [`ReleaseFileSystem`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-ReleaseFileSystem), which is how a spec runs either function over a directory that exists only in memory. A replacement for its [`list`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-ReleaseFileSystem-prop-list) answers one [`ReleaseEntry`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-ReleaseEntry) for each entry below the root that is no directory: the path below the root, written with the separators of the platform, and whether a regular file is there.

## Format

```json
{
  "schema": 1,
  "name": "@acme/clock-shell",
  "version": "1.4.0",
  "files": [
    {
      "path": "index.mjs",
      "size": 3,
      "sha256": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    }
  ]
}
```

| Member                                                                                                      | Rule                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`schema`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-ReleaseManifest-prop-schema)   | The number 1. A reader that meets any other value reports that alone, because nothing else can be judged under unknown rules          |
| [`name`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-ReleaseManifest-prop-name)       | The artifact's own name, for a shell its package name: non-empty text with no whitespace, control character or U+FFFD                 |
| [`version`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-ReleaseManifest-prop-version) | A semantic version, 2.0.0 grammar, with no leading `v`                                                                                |
| [`files`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-ReleaseManifest-prop-files)     | At least one entry, in ascending order of path compared code point by code point, so no path repeats                                  |
| `files[].path`                                                                                              | Relative to the manifest's directory and separated by `/`, with no empty, `.` or `..` segment, backslash, control character or U+FFFD |
| `files[].size`                                                                                              | The length in bytes, a whole number from 0 to 9007199254740991                                                                        |
| `files[].sha256`                                                                                            | The SHA-256 of the bytes, as 64 lowercase hexadecimal characters                                                                      |

The member sets are exact: a manifest or a file entry that holds any other member is refused. Paths are compared as written, with no case folding and no Unicode normalisation. The path `hf-release.json` at the root is reserved and never listed. U+FFFD is what a lossy decoder leaves of a malformed byte, so a file whose name on disk is not valid UTF-8 cannot be listed: indexing a directory that holds one fails, and verification reports it as unlisted.

Each file is read whole to be hashed, so a release cannot hold a file of 2 GiB or more, whatever size an entry could state: indexing and verifying such a file both throw.

The file has one canonical form: UTF-8 with no byte order mark, holding exactly what `JSON.stringify(manifest, null, 2)` writes with the members in the order above, closed by one line feed. [`serializeReleaseManifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-serializeReleaseManifest) writes it and [`parseReleaseManifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-parseReleaseManifest) refuses any other spelling of the same content, such as other spacing, another member order, a repeated key or `3.0` for `3`. One content therefore has one byte sequence, and one digest.

## Problems

[`checkReleaseManifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-checkReleaseManifest) returns every problem of a value at once, each with a stable code, the place it was found and a full sentence. [`validateReleaseManifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-validateReleaseManifest) and [`parseReleaseManifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-parseReleaseManifest) throw them as one error: the path of the source file, then a line per problem.

No message repeats a value or a key of the file, since both are text the author of an untrusted file chose. A member the schema does not define is reported by the object that holds it, once, however many such members there are.

| Code                     | Reported when                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest-not-json`      | The text is not JSON; reported alone, by [`parseReleaseManifest`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-parseReleaseManifest) only |
| `manifest-not-object`    | The value is no object; reported alone                                                                                                                         |
| `schema-missing`         | The schema member is absent; reported alone                                                                                                                    |
| `schema-unsupported`     | The schema number is anything but 1; reported alone                                                                                                            |
| `member-unknown`         | The manifest or a file entry holds a member schema 1 does not define                                                                                           |
| `name-invalid`           | The name breaks its rule or is absent                                                                                                                          |
| `version-invalid`        | The version breaks its rule or is absent                                                                                                                       |
| `files-not-array`        | The file list is no array or is absent                                                                                                                         |
| `files-empty`            | The file list is empty                                                                                                                                         |
| `file-not-object`        | An entry of the file list is no object                                                                                                                         |
| `file-path-invalid`      | A path breaks its rule or is absent                                                                                                                            |
| `file-path-reserved`     | A path names the manifest itself                                                                                                                               |
| `file-path-order`        | A path does not sort after the well-formed path before it                                                                                                      |
| `file-size-invalid`      | A size breaks its rule or is absent                                                                                                                            |
| `file-sha256-invalid`    | A digest breaks its rule or is absent                                                                                                                          |
| `manifest-not-canonical` | The content is sound and the text is not its canonical form; by parsing only                                                                                   |

After a malformed path the order comparison starts again, so one bad path is reported once and not again for the entry that follows it.

## Verification

[`verifyRelease`](https://www.hyperfrontend.dev/docs/libraries/server/manifest/#api-verifyRelease) has no lenient mode. It reports a manifest file at the root that is no regular file, checks each listed file in manifest order and reports it at most once, then reports every other entry below the root, in code point order.

| Code                   | Reported when                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `manifest-not-file`    | The entry `hf-release.json` at the root is a symbolic link or anything else that is no regular file       |
| `file-missing`         | No regular file is at a listed path: nothing, a directory, or a symbolic link, which is not followed      |
| `file-size-mismatch`   | The file's size differs from the listed one; the file is not read                                         |
| `file-sha256-mismatch` | The size agrees and the bytes hash to another digest                                                      |
| `file-unlisted`        | An entry below the root is not listed; the manifest file at the root is the one entry that is not counted |

The message of an unlisted entry opens with its path as it is when a manifest could list that path, and otherwise with the path as a quoted string in which every control character is escaped, so a name from disk never starts a line of its own. The `path` member holds the name unchanged.

A failure to read the disk is thrown, never turned into a verdict, and so is a manifest that does not pass the validator, before the disk is touched. A symbolic link to a directory is an entry of its own and is reported as unlisted, whatever lies behind it. A directory that holds nothing is not an entry, so an empty directory beside the listed files changes no result.
