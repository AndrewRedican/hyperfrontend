# Notice

The linter's code is its own. Its rules' specifications are not all original: many of the cases in the `*.spec.ts` files beside the rules under `src/rules/` were adapted from the test suites of the projects whose rules this linter reimplements, and the messages, options and fixes those rules answer with follow the same projects. Each family's cases come from:

- ESLint (MIT, OpenJS Foundation and contributors): the core rules, under `src/rules/javascript/`
- typescript-eslint (MIT, typescript-eslint and contributors): the TypeScript rules, under `src/rules/typescript/`
- eslint-plugin-jsdoc (BSD-3-Clause, Gajus Kuizinas): the JSDoc rules, under `src/rules/jsdoc/`
- eslint-plugin-react (MIT, Yannick Croissant): the React rules, under `src/rules/react/`
- eslint-plugin-react-hooks (MIT, Meta Platforms, Inc. and affiliates): the hooks rules, under `src/rules/react-hooks/`
- eslint-plugin-package-json (MIT, Josh Goldberg and contributors): the manifest rule, under `src/rules/package-json/`

The convention rules under `src/rules/conventions/` were written for this linter. The licence texts are kept under `licenses/` beside this file.
