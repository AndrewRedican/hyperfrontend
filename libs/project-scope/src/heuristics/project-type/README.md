# project-type

Project-type classification that decides whether a folder is an application, library, e2e suite, CLI tool, or plugin.

`detectProjectType` scores a project against multiple signals — `package.json` name suffixes (`-lib`, `-app`, `-e2e`, `-cli`), presence of `exports`/`main`/`module`/`bin`, entry-point file patterns (`server.ts` vs `index.ts`), directory layout (`public/`, `pages/`, `lib/`, `cypress/`), framework membership, and e2e tooling. The result includes the chosen `type`, a `confidence` percentage, and a list of `evidence` entries explaining each contributing factor. Useful as a starting point for code-mod scripts, scaffolding, and workspace-management tooling that needs to react differently per project shape.
