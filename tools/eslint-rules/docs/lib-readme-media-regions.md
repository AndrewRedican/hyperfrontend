# lib-readme-media-regions

Validate the media regions a publishable library README declares for its distribution readme.

## Rule Details

A package's source `README.md` stays semantic text: the documentation site renders it, GitHub shows it, and an author edits it. The readme that ships in the package is written by the build from that source, with every marked region replaced by a committed visual. A region is a pair of HTML comments, which every renderer hides:

```markdown
<!-- hf:media start id="runtimes" scene="runtimes-logging" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later, evergreen browsers and web workers" -->

| Environment   | Supported |
| ------------- | :-------: |
| Node.js >= 18 |    ✅     |

<!-- hf:media end -->
```

The build refuses a readme whose regions are wrong, but it refuses at build time, after the edit is made. This rule reports the same mistakes where they are written, and two the build cannot see: whether the `docs` attribute names a page and anchor the site publishes, and whether the readme declares the region every package readme carries.

Every publishable readme declares one region:

| Region     | Scene                | Asset      | Where                                               |
| ---------- | -------------------- | ---------- | --------------------------------------------------- |
| `runtimes` | `runtimes-<package>` | `runtimes` | Inside the Compatibility section, around the table. |

`<package>` is the npm name without its scope. The region wraps the compatibility table, which the strip replaces in the distribution readme and only there.

The package banner is not a region. The build replaces the readme's level-1 heading with it, reading `banner.gif` from the `banner-<package>` scene, so nothing in the readme names it. This rule reports the readme when that scene has not been recorded, and reports a region with the id `banner` left over from before the build placed the banner itself.

### What the rule reports

| Message           | Reported when                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `unreadable`      | A region does not pair, nests, repeats an id, carries an unknown attribute or is not written on one line. |
| `missingScene`    | The `scene` a region names has no directory under the committed media.                                    |
| `missingAsset`    | The scene has no portable `<asset>.gif`, `.webp` or `.png`; themed files do not count.                    |
| `brokenDocs`      | The `docs` attribute resolves to a page or anchor the documentation site does not publish.                |
| `missingRegion`   | The readme declares no `runtimes` region.                                                                 |
| `wrongRegion`     | A required region names a scene or asset other than the package's own.                                    |
| `misplacedRegion` | A required region sits outside the part of the document it belongs in.                                    |
| `missingBanner`   | The `banner-<package>` scene has no portable `banner.gif`, `.webp` or `.png` for the build to place.      |
| `bannerRegion`    | The readme still declares a `banner` region, which would show the banner twice.                           |

### Scope

Applies to the `README.md` at the root of every publishable library, and only there: the build transforms that file alone. A readme whose package the documentation index does not know is left alone.

## Options

| Option         | Type     | Default                         | Description                                                         |
| -------------- | -------- | ------------------------------- | ------------------------------------------------------------------- |
| `assetRoot`    | `string` | `assets/media`                  | Directory, relative to the workspace root, holding the media.       |
| `siteUrl`      | `string` | `https://www.hyperfrontend.dev` | Origin every `docs` attribute resolves under.                       |
| `docsSiteRoot` | `string` | `apps/docs-site`                | The site project whose routes say which pages exist.                |
| `repoUrl`      | `string` | the workspace manifest's        | Browsable repository URL, for a `docs` attribute that points there. |

## Examples

### ❌ Incorrect

```markdown
<!-- hf:media start id="runtimes" scene="runtimes-logging" asset="runtimes.dark" alt="Runs everywhere" -->

| Environment | Supported |

<!-- hf:media end -->
```

The asset stem carries a theme suffix. The distribution readme is read on pages whose theme nobody here controls, so only the portable file is ever embedded.

```markdown
<!-- hf:media start id="runtimes" scene="runtimes-logging" asset="runtimes" docs="#supported-runtimes" alt="Runs everywhere" -->
```

The landing page has no heading with that anchor, so the strip would link to the top of the page.

```markdown
<!-- hf:media start id="banner" scene="banner-logging" asset="banner" alt="@hyperfrontend/logging" -->
<!-- hf:media end -->
```

The build places the banner in place of the title; a region naming it would show it a second time.

### ✅ Correct

```markdown
<!-- hf:media start id="runtimes" scene="runtimes-logging" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later, evergreen browsers and web workers" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ✅     |
| Modern Browsers |    ✅     |
| Web Workers     |    ✅     |

<!-- hf:media end -->
```

## When Not To Use It

If a workspace ships its source readme as is, with no build step that substitutes media, there are no regions to check.
