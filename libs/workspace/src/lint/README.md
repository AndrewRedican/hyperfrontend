# lint

The projects rule family for [`@hyperfrontend/linter`](https://www.hyperfrontend.dev/docs/libraries/linter/): three rules that read the workspace graph, and the readers a workspace's own rules share with them.

```ts
import { PROJECTS_FAMILY } from '@hyperfrontend/workspace/lint'

export default [
  { families: { projects: PROJECTS_FAMILY } },
  { files: ['**/*.ts'], rules: { 'projects/module-boundaries': ['error', { depConstraints: [] }] } },
  { files: ['**/package.json'], rules: { 'projects/dependency-checks': 'error' } },
  { files: ['**/project.json'], rules: { 'projects/command-lines': 'error' } },
]
```

| Rule                         | Checks                                                                  |
| ---------------------------- | ----------------------------------------------------------------------- |
| `projects/module-boundaries` | Imports between projects: aliases, cycles, tags, buildable dependencies |
| `projects/dependency-checks` | A buildable project's manifest against what its files import            |
| `projects/command-lines`     | Shell lines of a project's targets for what `sh` and cmd.exe read apart |

The readers resolve what a rule of your own needs about the file it lints: the workspace root and project that own it ([`workspaceRootOf`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-workspaceRootOf), [`projectRootOf`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-projectRootOf)), its project file and manifest ([`readProjectFile`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-readProjectFile), [`readPackageFile`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-readPackageFile)), the aliases of `tsconfig.base.json` ([`pathAliases`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-pathAliases)) and the exports of a module ([`moduleExports`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-moduleExports)).

Their options, messages and fixes are those of Nx's ESLint plugin (see [licenses/nx.txt](https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/lint/licenses/nx.txt)), reduced to the options a workspace configures, and they reach the same verdicts while loading nothing from Nx.

## The project graph

The [graph entry](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/) builds, once per lint process, the graph Nx would build, and the rules read it:

- **Projects**: every directory holding a `project.json` or a `package.json` among the files Git tracks or would track, less what `.hfignore` excludes. Names, types, tags and targets follow Nx: a `package.json` beside a `project.json` adds its scripts as targets and `npm:` tags from its [`private`](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/#api-PackageManifest-prop-private) flag and its keywords.
- **npm packages**: the root `package-lock.json`, one node per name and version.
- **Dependencies**: each code file's imports, read with the linter's own parser under Nx's rules, so a `require` inside a function or an `import()` counts as dynamic exactly when Nx counts it so; each `package.json`'s dependencies; and the implicit dependencies a project declares.

Imports are remembered in `node_modules/.cache/hyperfrontend-lint/imports.json`: a file whose size and modification time are unchanged is not read again, and one whose content hash is unchanged is not parsed again. Like Nx's cached graph, the graph reflects the files on disk, not unsaved editor buffers.

## module-boundaries

Reports an import that:

- reaches another project by a relative or absolute path instead of its alias, with a fix that rewrites it to the alias when the imported names can be traced through the project's entry points;
- names its own project's alias, with a fix that rewrites it to a relative path;
- closes a cycle between projects, or imports an application;
- statically imports a library the project loads lazily elsewhere;
- from a buildable library, names a library without a build target ([`enforceBuildableLibDependency`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-ModuleBoundariesOptions-prop-enforceBuildableLibDependency));
- reaches a project whose tags the [`depConstraints`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-ModuleBoundariesOptions-prop-depConstraints) do not allow ([`sourceTag`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-DependencyConstraint-prop-sourceTag) with [`onlyDependOnLibsWithTags`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-DependencyConstraint-prop-onlyDependOnLibsWithTags)).

Options: [`allow`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-ModuleBoundariesOptions-prop-allow) (patterns of specifiers never reported), [`depConstraints`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-ModuleBoundariesOptions-prop-depConstraints) and [`enforceBuildableLibDependency`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-ModuleBoundariesOptions-prop-enforceBuildableLibDependency), the ones this workspace sets. The base sets them in `lint.base.config.ts`, with narrower [`allow`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-ModuleBoundariesOptions-prop-allow) lists for `apps/package-e2e` in the root `lint.config.ts` and for `apps/docs-site` in its own config; the shipped demos turn the rule off.

## dependency-checks

For a project with a build target, compares the dependencies, [`peerDependencies`](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/#api-PackageManifest-prop-peerDependencies) and [`optionalDependencies`](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/#api-PackageManifest-prop-optionalDependencies) of its `package.json` with the packages the files of the build's inputs import, at the versions installed where they import them from. It reports and fixes missing packages, packages nothing imports, ranges the installed version does not satisfy, and a manifest with no dependency section at all.

Options: [`ignoredDependencies`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-DependencyChecksOptions-prop-ignoredDependencies) and [`ignoredFiles`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-DependencyChecksOptions-prop-ignoredFiles). Each project's `lint.config.ts` lists what its build bundles or never imports, with the reason beside each entry; the library generator's template starts every new library with [`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/) ignored.

## command-lines

The workspace runner starts every `@hyperfrontend/workspace:run-commands` line through the platform shell (`src/runner/commands.ts`): `sh` on Linux and macOS, cmd.exe on Windows. In a `project.json`, each target's command, the command of its options, and every entry of their [`commands`](https://www.hyperfrontend.dev/docs/libraries/workspace/graph/#api-TargetOptions-prop-commands) (a string, or an object's command) is checked for what the two shells read differently:

| Message     | Reported when                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------- |
| singleQuote | A `'` outside double quotes: cmd.exe passes it through as part of the argument                 |
| envPrefix   | The line starts with `NAME=value`, which cmd.exe does not read as an assignment                |
| variable    | A `$NAME`, `${NAME}`, `$(…)` or `%NAME%`, which only one shell expands, quoted or not          |
| separator   | A `;` or a lone `&` outside double quotes; `&&`, `\|\|`, `\|` and `2>&1` mean the same in both |
| glob        | A `*` or `?` outside double quotes, which only `sh` expands                                    |
| backslash   | A `\` outside double quotes, which `sh` reads as an escape                                     |

A line with several problems is reported once for each. Nothing is fixed: the replacement is a judgement about the command, such as moving a variable into the target's env or quoting a pattern so the program matches it.

Options: [`include`](https://www.hyperfrontend.dev/docs/libraries/workspace/lint/#api-CommandLinesOptions-prop-include), the selectors of the `workspace/cross-platform` rule, defaulting to every publishable library. The workspace selects publishable libraries, the root `project.json`, `tools/**` and `apps/package-e2e/**`: the projects whose targets the Windows and macOS legs run, or a contributor runs on their own machine. The docs site and the demos build on Linux alone, and their cp lines are left as they are.
