# Project rules

Lint rules that read the workspace's project graph, the one Nx would build, built by `@hyperfrontend/workspace/graph` (`tools/workspace/src/graph/`); the rules live in `src/rules/projects/`. Their options, messages and fixes are those of Nx's ESLint plugin (see [licenses/nx.txt](../../licenses/nx.txt)), reduced to the options this workspace configures, and they reach the same verdicts on this workspace while loading nothing from Nx.

| Rule                                               | Checks                                                              | Files                        |
| -------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------- |
| [`projects/module-boundaries`](#module-boundaries) | Imports between projects                                            | `.ts`, `.tsx`, `.js`, `.jsx` |
| [`projects/dependency-checks`](#dependency-checks) | A buildable project's `package.json` against what its files import  | `package.json`               |
| [`projects/plugin-manifests`](#plugin-manifests)   | The generator, executor and migration manifests of a plugin project | the configured manifests     |

## The project graph

`@hyperfrontend/workspace/graph` (`tools/workspace/src/graph/`) builds, once per lint process, the graph Nx would build, and the rules read it:

- **Projects**: every directory holding a `project.json` or a `package.json` among the files Git tracks or would track, less what `.nxignore` excludes. Names, types, tags and targets follow Nx: a `package.json` beside a `project.json` adds its scripts as targets and `npm:` tags from `private` and `keywords`.
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

## plugin-manifests

In a `package.json`, every version of a migrations `packageGroup` must be valid semver or one of `allowedVersionStrings`, and every member of a listed group must name its version. The workspace enables the rule on the `package.json` of `tools/package` and `tools/app`, which is the only file it reads there.

Options: `allowedVersionStrings`.
