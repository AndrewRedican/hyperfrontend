# Project rules

Lint rules that read the workspace's project graph, the one Nx would build, built by `@hyperfrontend/workspace/graph` (`src/graph/`); the rules live in `src/lint/` and a configuration registers them as `{ families: { projects: PROJECTS_FAMILY } }` from `@hyperfrontend/workspace/lint`. Their options, messages and fixes are those of Nx's ESLint plugin (see [licenses/nx.txt](../../../../tools/lint/licenses/nx.txt)), reduced to the options this workspace configures, and they reach the same verdicts on this workspace while loading nothing from Nx.

| Rule                                               | Checks                                                                   | Files                        |
| -------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| [`projects/module-boundaries`](#module-boundaries) | Imports between projects                                                 | `.ts`, `.tsx`, `.js`, `.jsx` |
| [`projects/dependency-checks`](#dependency-checks) | A buildable project's `package.json` against what its files import       | `package.json`               |
| [`projects/command-lines`](#command-lines)         | The `@hyperfrontend/workspace:run-commands` lines of a project's targets | `project.json`               |

## The project graph

`@hyperfrontend/workspace/graph` (`src/graph/`) builds, once per lint process, the graph Nx would build, and the rules read it:

- **Projects**: every directory holding a `project.json` or a `package.json` among the files Git tracks or would track, less what `.hfignore` excludes. Names, types, tags and targets follow Nx: a `package.json` beside a `project.json` adds its scripts as targets and `npm:` tags from `private` and `keywords`.
- **npm packages**: the root `package-lock.json`, one node per name and version.
- **Dependencies**: each code file's imports, read with the linter's own parser under Nx's rules, so a `require` inside a function or an `import()` counts as dynamic exactly when Nx counts it so; each `package.json`'s dependencies; and `implicitDependencies`.

Imports are remembered in `node_modules/.cache/hyperfrontend-lint/imports.json`: a file whose size and modification time are unchanged is not read again, and one whose content hash is unchanged is not parsed again. Like Nx's cached graph, the graph reflects the files on disk, not unsaved editor buffers.

## module-boundaries

Reports an import that:

- reaches another project by a relative or absolute path instead of its alias, with a fix that rewrites it to the alias when the imported names can be traced through the project's entry points;
- names its own project's alias, with a fix that rewrites it to a relative path;
- closes a cycle between projects, or imports an application;
- statically imports a library the project loads lazily elsewhere;
- from a buildable library, names a library without a build target (`enforceBuildableLibDependency`);
- reaches a project whose tags the `depConstraints` do not allow (`sourceTag` with `onlyDependOnLibsWithTags`).

Options: `allow` (patterns of specifiers never reported), `depConstraints` and `enforceBuildableLibDependency`, the ones this workspace sets. The base sets them in `lint.base.config.ts`, with narrower `allow` lists for `apps/package-e2e` in the root `lint.config.ts` and for `apps/docs-site` in its own config; the shipped demos turn the rule off.

## dependency-checks

For a project with a build target, compares the `dependencies`, `peerDependencies` and `optionalDependencies` of its `package.json` with the packages the files of the build's inputs import, at the versions installed where they import them from. It reports and fixes missing packages, packages nothing imports, ranges the installed version does not satisfy, and a manifest with no dependency section at all.

Options: `ignoredDependencies` and `ignoredFiles`. Each project's `lint.config.ts` lists what its build bundles or never imports, with the reason beside each entry; the library generator's template starts every new library with `@hyperfrontend/testing` ignored.

## command-lines

The workspace runner starts every `@hyperfrontend/workspace:run-commands` line through the platform shell (`src/runner/commands.ts`): `sh` on Linux and macOS, cmd.exe on Windows. In a `project.json`, each target's `command`, the `command` of its `options`, and every entry of their `commands` (a string, or an object's `command`) is checked for what the two shells read differently:

| Message       | Reported when                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `singleQuote` | A `'` outside double quotes: cmd.exe passes it through as part of the argument                 |
| `envPrefix`   | The line starts with `NAME=value`, which cmd.exe does not read as an assignment                |
| `variable`    | A `$NAME`, `${NAME}`, `$(…)` or `%NAME%`, which only one shell expands, quoted or not          |
| `separator`   | A `;` or a lone `&` outside double quotes; `&&`, `\|\|`, `\|` and `2>&1` mean the same in both |
| `glob`        | A `*` or `?` outside double quotes, which only `sh` expands                                    |
| `backslash`   | A `\` outside double quotes, which `sh` reads as an escape                                     |

A line with several problems is reported once for each. Nothing is fixed: the replacement is a judgement about the command, such as moving a variable into the target's `env` or quoting a pattern so the program matches it.

Options: `include`, the selectors of the `workspace/cross-platform` rule, defaulting to every publishable library. The workspace selects publishable libraries, the root `project.json`, `tools/**` and `apps/package-e2e/**`: the projects whose targets the Windows and macOS legs run, or a contributor runs on their own machine. The docs site and the demos build on Linux alone, and their `cp` lines are left as they are.
