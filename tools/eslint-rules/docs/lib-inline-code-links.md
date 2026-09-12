# lib-inline-code-links

Require inline code that names a package, entry point, symbol, member or declaration to link to where it is documented, and check that every such link resolves.

## Rule Details

Package prose is read on npm, on GitHub and on the documentation site, and a reader who meets `createShell` in a sentence should be one click from its reference on all three. This rule reads every inline code span in a publishable package's markdown and sorts it into one of two kinds.

A **value** is code because it is code: a literal, a quoted string, a number, a keyword, a file name, a path, a command line, a flag, an expression with punctuation in it, a hyphenated enum value such as `security-error`, a single character, or a name the platform defines (`Uint8Array`, `postMessage`, `process`, `iframe`). Nothing on the site documents a value, so a value is left alone.

A **name** is something a reader might want to look up: a package (`@hyperfrontend/nexus`), an entry point (`/host`), an exported symbol (`createShell`), a member of one (`onDrop`, `accepted`, `v4`), the global a bundle assigns itself to (`HyperfrontendFeaturesHost`), or a function, class, interface, type or enum declared inside the package. A name must sit inside a link, and the link's destination must exist.

The rule resolves names from the workspace itself rather than from a list anyone maintains: each publishable package's manifest names its entry points, each entry point's source names its exports, each export's declaration names its members, the project manifest names its bundle globals, and the documentation site's routes and content say which pages exist. The index is built once per lint process and rebuilt when any of those inputs changes.

### What counts as resolved

| Mention                                  | Destination                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `@hyperfrontend/features`                | The package's landing page                                                                                           |
| `@hyperfrontend/features/host`, `/host`  | The entry point's page, or a module page the site publishes without an export (`/data` in network-protocol)          |
| `createShell`                            | `#api-createShell` on the page of the one entry exporting it; the deepest entry when several re-export it            |
| `createChannel` (browser and node twins) | `#api-createChannel` on the package landing page, whose reference opens the module holding the symbol                |
| `onDrop`, `emitted`                      | `#api-Parent-prop-onDrop` when the parent is an interface or class property; `#api-Parent` for any other member kind |
| `v4`, `replayed`                         | The literal-union type or the frozen code map that lists the value                                                   |
| `protocol.seal`, `queue.size`            | The member on the type the variable is named after                                                                   |
| `HyperfrontendFeaturesHost`              | The page of the entry the bundle exposes                                                                             |
| `handleRequest` (declared, not exported) | The declaring source file in the repository                                                                          |

A name the package's own entry points export is applied by the fixer. A name only another package exports, or only a single lowercase word that a sibling entry exports (`status`, `error`), is offered in the message and never applied: prose that says `cancel` more often means the word than a selector some other package happens to export.

### What counts as broken

A link around inline code is checked wherever it points:

- A site URL must name a page the site publishes: a `page.tsx` under the documentation site's app directory, a guide with content, or an article with content.
- A `#api-Name` anchor must name a symbol the page's reference lists: the entry's exports on an entry page, any entry's exports on a landing page. A `#api-Name-prop-member` anchor must name a property the site anchors individually.
- Any other anchor must be a heading of the markdown document the page renders, slugged the way the site slugs it.
- A repository `blob` or `tree` URL must name a file or directory that exists in the workspace.
- A relative link must name a file that exists beside the document, and a bare `#anchor` a heading of the document itself.

External URLs to other hosts are taken on trust; nothing offline can say whether they resolve.

### Scope

Applies to every markdown file under a publishable library (a project whose `project.json` declares `projectType: "library"` with both `build` and `publish` targets), except `CHANGELOG.md`, which the versioning flow writes. Headings are skipped: a heading is its own anchor, and a link inside one would carry the reader away from the section it names. Fenced code is not inline code and is never read.

## Options

| Option         | Type     | Default                         | Description                                                                             |
| -------------- | -------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `siteUrl`      | `string` | `https://www.hyperfrontend.dev` | Origin of the documentation site; every resolved link is published under it.            |
| `docsSiteRoot` | `string` | `apps/docs-site`                | The site's project, relative to the workspace root, whose routes say which pages exist. |
| `repoUrl`      | `string` | the workspace manifest's        | Browsable repository URL, for links to declaring source files.                          |

## Examples

### ❌ Incorrect

```markdown
Hand `createShell` a feature URL and a map of display modes.
```

`createShell` is exported by `@hyperfrontend/features/host`, so the fixer links it to `https://www.hyperfrontend.dev/docs/libraries/features/host/#api-createShell`.

```markdown
Every drop is reported through [`onDrop`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-onDrop).
```

`onDrop` is a property of `ChannelOptions`, not an export; the anchor does not exist. The rule names the anchor that does.

```markdown
The pipeline runs `init`, `build` and `dev`.
```

Nothing in the package exports those names. The message says so, lists what other packages export under them, and asks for either a link to the page that explains them (the CLI page's `runInit`, here) or plain prose if they are not navigable.

### ✅ Correct

```markdown
Hand [`createShell`](https://www.hyperfrontend.dev/docs/libraries/features/host/#api-createShell) a feature URL.
Every drop is reported through [`onDrop`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-ChannelOptions-prop-onDrop).
The default is `true`, the file is `index.esm.js`, and the flag is `--protocol v4`.
```

The last line carries three values and no names, and is left alone.

## When Not To Use It

On markdown outside a publishable package: an application README, a design note, a changelog. The rule already skips those.
