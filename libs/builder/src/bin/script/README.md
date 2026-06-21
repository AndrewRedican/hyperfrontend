# script

JS bin synthesis primitives: rollup-driven bundling with shebang + bootstrap footer + chmod.

`buildJsBin(bin, context)` bundles `src/bin/<name>.ts` with Rollup once per declared format, prepends the `#!/usr/bin/env node` shebang, appends the resolved bootstrap footer (`bin.bootstrap` override or `defaultBootstrap`), writes the output to `<outputPath>/bin/<name>.<ext>`, and chmods it to `0o755`. Output naming is `<name>.mjs` for ESM, `<name>.js` when CJS is the only declared format, and `<name>.cjs.js` when CJS is paired with ESM. `defaultBootstrap({ runner, format })` produces the standard footer template — when `runner === 'default'` the runner reference resolves per-format (`module.exports.default` for CJS, `(await import(import.meta.url)).default` for ESM); otherwise the named runner is referenced directly.
