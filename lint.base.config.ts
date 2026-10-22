// context: the linter knows every rule it implements and reads each file by its extension, so the configurations name rules only; a project's lint.config.ts spreads these blocks before its own.
import {
  CODE,
  CODE_RULES,
  DEPENDENCY_CONSTRAINTS,
  JAVASCRIPT,
  JSDOC_RULES,
  on,
  REQUIRE_JSDOC,
  SCRIPT,
  TYPESCRIPT,
} from './tools/lint/config/rule-sets.ts'
import { BROWSER_AND_NODE_GLOBALS } from './tools/lint/config/globals.ts'

/**
 * Package scope prefixes that must never appear bare in a JSDoc description. `workspace/escape-package-tags`
 * reports and fixes them; the same list is handed to `jsdoc/escape-inline-tags` as an allowlist so a single
 * diagnostic and a single fixer own each occurrence.
 */
const WORKSPACE_PACKAGE_PREFIXES = ['@hyperfrontend', '@nx']

export default [
  { ignores: ['docs/', '.nx/', 'dist/', 'coverage/', 'tmp/', '**/node_modules/', '**/.next/', '**/out/'] },
  { files: CODE, rules: CODE_RULES },
  { files: JAVASCRIPT, language: { globals: BROWSER_AND_NODE_GLOBALS } },
  { files: SCRIPT, rules: JSDOC_RULES },
  {
    files: SCRIPT,
    rules: {
      'projects/module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          // context: @hyperfrontend/testing is the test runtime every project's specs import, whatever tag the project carries, so the tag constraints below would reject the import from every core library.
          allow: [
            '^.*/lint(\\.base)?\\.config\\.ts$',
            '^(?:\\.\\./)*(?:\\./)?tools/lint/config/[^/]+\\.ts$',
            '^@hyperfrontend/testing(/.*)?$',
          ],
          depConstraints: DEPENDENCY_CONSTRAINTS,
        },
      ],
      'no-useless-assignment': 'error',
    },
  },
  {
    // why: every JSON file is selected, most by no rule, so naming one on the command line never answers with an ignored-file warning.
    files: ['**/*.json'],
  },
  {
    files: ['**/package.json'],
    rules: {
      'package-json/restrict-dependency-ranges': [
        'error',
        { forDependencyTypes: ['dependencies', 'devDependencies', 'optionalDependencies'], rangeType: 'pin' },
      ],
      ...on(`
        workspace/lib-pkg-no-main workspace/lib-pkg-description workspace/lib-pkg-fields workspace/lib-pkg-package-json-export
        workspace/lib-pkg-exports-js-only workspace/lib-pkg-exports-exist workspace/lib-pkg-exports-entry-shape workspace/lib-pkg-bundle-entry
        workspace/lib-pkg-secondary-entry-readme
      `),
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'jsdoc/require-jsdoc': ['error', REQUIRE_JSDOC],
      ...on(`
        jsdoc/require-param-description jsdoc/require-returns-description jsdoc/require-returns jsdoc/require-returns-check
        jsdoc/check-param-names jsdoc/empty-tags jsdoc/no-defaults jsdoc/require-description jsdoc/informative-docs
      `),
      'jsdoc/check-tag-names': ['error', { typed: false, definedTags: ['locked', 'module'] }],
      'jsdoc/check-types': 'off',
      'jsdoc/valid-types': 'off',
      'jsdoc/no-types': 'off',
    },
  },
  { files: ['**/*.spec.{ts,tsx,js,jsx}'], rules: { 'jsdoc/require-jsdoc': 'off' } },
  { files: ['**/index.ts'], rules: on('workspace/no-unwanted-barrel-files workspace/no-barrel-star-export') },
  { files: TYPESCRIPT, ignores: ['**/test.setup.ts'], rules: { 'workspace/no-unsafe-builtin-methods': 'error' } },
  {
    files: TYPESCRIPT,
    ignores: ['**/test.setup.ts'],
    rules: {
      ...on(`
        workspace/require-node-protocol workspace/no-mixed-type-import workspace/no-mixed-type-export workspace/max-path-occurrences
        workspace/import-order workspace/export-order workspace/no-enum workspace/no-async-fs-api workspace/no-deprecated-tag
        workspace/no-todo-comments workspace/no-unsafe-regex workspace/prefer-exec-file-sync workspace/deepest-import-path
        workspace/no-section-dividers workspace/no-decorative-header-comments workspace/prefer-jsdoc-over-trailing-comments
        workspace/no-plain-inline-comments
      `),
      'workspace/max-file-lines': ['error', { maxLines: 600, maxLinesTest: 700 }],
    },
  },
  {
    files: SCRIPT,
    rules: {
      'workspace/escape-package-tags': ['error', { prefixes: WORKSPACE_PACKAGE_PREFIXES }],
      'jsdoc/escape-inline-tags': ['warn', { allowedInlineTags: WORKSPACE_PACKAGE_PREFIXES.map((prefix) => prefix.slice(1)) }],
    },
  },
  { files: TYPESCRIPT, ignores: ['**/test.setup.ts', '**/libs/logging/**'], rules: { 'workspace/no-direct-console': 'error' } },
  { files: TYPESCRIPT, ignores: ['**/test.setup.ts', '**/*.spec.ts'], rules: { 'workspace/no-namespace-import': 'error' } },
  {
    files: TYPESCRIPT,
    rules: {
      // why: Node's TypeScript type stripping rejects `<T>expr` outright, so `as` is the only assertion syntax the test runner can parse.
      'typescript/consistent-type-assertions': ['error', { assertionStyle: 'as' }],
      // why: under real ESM a type imported as a value fails at link time, because nothing elides it before the module is linked.
      'typescript/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
      ],
    },
  },
  {
    files: TYPESCRIPT,
    ignores: ['**/test.setup.ts', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: { 'workspace/no-inline-type-literal': 'error' },
  },
  { files: ['**/*.spec.ts'], rules: on('workspace/assertive-test-names workspace/jest-mock-after-imports') },
  {
    files: ['**/*.spec.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    rules: {
      // why: the fixture suites under the testing package's e2e project are inputs the suite executes and counts, and one of them must assert twice to exercise expect.assertions(2); their shape is the thing under test, not a test of this workspace.
      'workspace/one-assertion-per-test': ['error', { exclude: ['apps/package-e2e/testing/src/fixtures/**'] }],
    },
  },
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/test.setup.ts', '**/*.types.ts'],
    rules: on(
      'workspace/lib-require-jsdoc-example workspace/lib-require-jsdoc-example-label workspace/lib-require-module-header workspace/lib-pkg-main-reexports'
    ),
  },
  {
    files: ['**/*.ts', '**/*.mjs'],
    ignores: ['**/test.setup.ts'],
    rules: {
      // why: publishable libraries ship to Windows consumers, and a Windows CI leg runs the tools, the package e2e suites and the docs-site build scripts, so their sources and specs are all checked.
      'workspace/cross-platform': [
        'error',
        { include: [{ publishableLibraries: true }, { files: ['tools/**', 'apps/package-e2e/**', 'apps/docs-site/scripts/**'] }] },
      ],
    },
  },
  {
    files: ['**/project.json'],
    rules: on(`
      workspace/lib-project-metadata workspace/lib-project-version-targets workspace/lib-project-compatibility workspace/lib-project-bundle-config
      workspace/lib-e2e-project-required workspace/deploy-static-headers
    `),
  },
  {
    files: ['**/README.md'],
    rules: {
      // why: the README rules decide for themselves whether a file is a publishable package's readme, so they can be switched on for every README and still touch only package documentation.
      ...on(`
        workspace/lib-readme-structure workspace/lib-readme-compatibility-table workspace/lib-readme-media-regions workspace/readme-paragraph-length
        workspace/no-ascii-art-diagrams workspace/require-codeblock-language workspace/codeblock-line-width workspace/lib-inline-code-links
        workspace/no-manual-table-of-contents
      `),
      'workspace/readme-media-asset': ['error', { baseUrl: 'https://www.hyperfrontend.dev/media/', assetRoot: 'assets/media' }],
    },
  },
  { files: ['LIBRARY_COMPATIBILITY.md'], rules: { 'workspace/lib-compatibility-matrix': 'error' } },
  {
    files: ['**/*.md'],
    ignores: ['**/README.md'],
    rules: on(`
      workspace/no-ascii-art-diagrams workspace/require-codeblock-language workspace/codeblock-line-width workspace/lib-inline-code-links
      workspace/no-manual-table-of-contents
    `),
  },
]
