# Notice

Not all of the linter is original. Its rules reimplement rules of other projects and answer with the same messages, options and fixes; many of the cases in the `*.spec.ts` files beside the rules under `src/rules/` were adapted from those projects' test suites; and some of the tables the package ships were derived from theirs or from other packages. Each project's part:

- ESLint (MIT, OpenJS Foundation and contributors): the core rules, under `src/rules/javascript/`, and their spec cases
- typescript-eslint (MIT, typescript-eslint and contributors): the TypeScript rules, under `src/rules/typescript/`, and their spec cases; the language globals in `src/scope/globals.ts`, with the type and value positions its scope manager's library tables give each name
- eslint-plugin-jsdoc (BSD-3-Clause, Gajus Kuizinas): the JSDoc rules, under `src/rules/jsdoc/`, and their spec cases; the tag name and synonym tables in `src/jsdoc/tags.ts`
- eslint-plugin-react (MIT, Yannick Croissant): the React rules, under `src/rules/react/`, and their spec cases; the DOM property tables in `src/rules/react/shared/dom-properties.ts`
- eslint-plugin-react-hooks (MIT, Meta Platforms, Inc. and affiliates): the hooks rules, under `src/rules/react-hooks/`, and their spec cases
- eslint-plugin-package-json (MIT, Josh Goldberg and contributors): the manifest rule, under `src/rules/package-json/`, and its spec cases
- globals (MIT, Sindre Sorhus): the browser and Node global names in `src/presets/globals.ts`
- safe-regex (MIT, James Halliday): the star-height reading of a regular expression in `src/rules/conventions/shared/star-height.ts`, which `no-unsafe-regex` follows

The other convention rules under `src/rules/conventions/` were written for this linter. The licence texts, each headed by what was taken and from which version, are kept under `licenses/` beside this file.
