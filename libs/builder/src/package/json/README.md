# json

`package.json` synthesis primitives: read, inherit, filter, generate exports, resolve CDN paths, synthesize the dist manifest, and write it to disk.

The subdomain ships as small, single-purpose primitives so wrappers can compose only the steps they need: `readProjectPackageJson`, `inheritFields` for selective field copy, `filterWorkspaceDepsFromOutput` to strip workspace-internal entries, `generateExportsFromFormats` to align the published `exports` map with the bundle-phase outputs, `getCdnPaths` for `unpkg`/`jsdelivr` resolution, and `writeOutputPackageJson` for the final emit. `synthesizePackageJson` is the facade that wires all of them together.
