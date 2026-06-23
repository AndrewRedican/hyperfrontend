# entries

Entry-point discovery, resolution, and platform filtering primitives.

`discoverEntries(projectRoot)` scans `<projectRoot>/src` for the root `index.ts` plus every nested directory containing an `index.ts`, classifying the result into one of `root`, `platform`, `feature`, `hybrid`, or `complex`. `resolveEntries(config, discovered)` filters that list by the format-level `entry` and `exclude` patterns (exact subpaths or globs). `getEntriesByPlatform(discovery, platform)` and `getSharedEntries(discovery)` partition discovered entries by their platform hint for callers that target a specific runtime.
