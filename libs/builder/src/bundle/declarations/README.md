# declarations

`tsc`-driven `.d.ts` emission and post-emit path flattening.

`generateDeclarations(context)` runs the `tsc` entry script of the TypeScript resolved from the workspace root on the current Node binary (no shell, no `node_modules/.bin` shim, so it launches the same way on Windows) with `--emitDeclarationOnly --declaration --declarationMap`, captures stdout / stderr, and throws when the compiler exits with a non-zero status.

After tsc finishes it calls [`flattenDeclarationPaths`](https://www.hyperfrontend.dev/docs/libraries/builder/bundle/declarations/#api-flattenDeclarationPaths), which relocates the nested `dist/<lib>/libs/<lib>/src/...` structure that tsc emits when [`baseUrl`](https://www.typescriptlang.org/tsconfig/#baseUrl) points at the workspace root back into the flat per-library shape consumers expect, then removes the leftover `libs/`, `plugins/`, and `apps/` folders left at the output root. The flatten is a recursive, unconditional copy of the whole nested src declaration tree, so internal non-entry subdirectories any entry's `index.d.ts` re-exports from (e.g. `shared/`, `lib/`) are preserved rather than dropped.
