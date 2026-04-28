# declarations

`tsc`-driven `.d.ts` emission and post-emit path flattening.

`generateDeclarations(context)` shells out to the workspace-local `tsc` binary with `--emitDeclarationOnly --declaration --declarationMap`, captures stdout / stderr, and throws when the compiler exits with a non-zero status. After tsc finishes it calls `flattenDeclarationPaths` to relocate the nested `dist/<lib>/libs/<lib>/src/...` structure that tsc emits when `baseUrl` points at the workspace root back into the flat per-library shape consumers expect, copies any `lib/` declarations that platform entries re-export from, and removes the leftover `libs/`, `plugins/`, and `apps/` folders left at the output root.
