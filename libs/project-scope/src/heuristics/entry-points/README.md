# entry-points

Entry-point discovery for application source code, combining `package.json` declarations with conventional file patterns.

`discoverEntryPoints` reads `main`, `module`, `browser`, `bin`, and `exports` fields from `package.json`, then layers in convention-based candidates (`src/index.ts`, `src/main.ts`, `src/server.ts`, `src/cli.ts`, etc.). Each candidate is returned with a `confidence` score, `type` classification (`main`, `cli`, `server`, `library`, `worker`, ...), and the `source` that produced it (`package-json` vs `convention`). Detection is cached for a short TTL; pass `{ skipCache: true }` for fresh results. The patterns themselves are exposed as `ENTRY_POINT_PATTERNS` for downstream tools that need to extend the heuristic.
