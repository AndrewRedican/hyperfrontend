// context: the linter knows its packaged rules and reads each file by its extension; the first block registers the workspace's own rule families, and a project's lint.config.ts spreads these blocks before its own.
import { BROWSER_AND_NODE_GLOBALS, CODE, CODE_RULES, JAVASCRIPT, JSDOC_RULES, SCRIPT, TYPESCRIPT, on } from '@hyperfrontend/linter'
import { WORKSPACE_FAMILIES } from './tools/lint/config/families.ts'
import { documentationScopes } from './tools/lint/config/documentation-scopes.ts'
import { DEPENDENCY_CONSTRAINTS, REQUIRE_JSDOC } from './tools/lint/config/rule-sets.ts'

/**
 * Package scope prefixes that must never appear bare in a JSDoc description. `escape-package-tags`
 * reports and fixes them; the same list is handed to `jsdoc/escape-inline-tags` as an allowlist so a single
 * diagnostic and a single fixer own each occurrence.
 */
const WORKSPACE_PACKAGE_PREFIXES = ['@hyperfrontend', '@nx']

export default [
  { families: WORKSPACE_FAMILIES },
  { ignores: ['.nx/', 'dist/', 'coverage/', 'tmp/', '**/node_modules/', '**/.next/', '**/out/'] },
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
        require-node-protocol no-mixed-type-import no-mixed-type-export max-path-occurrences
        no-async-fs-api no-deprecated-tag
        no-todo-comments no-unsafe-regex prefer-exec-file-sync workspace/deepest-import-path
        no-section-dividers no-decorative-header-comments prefer-jsdoc-over-trailing-comments
        no-plain-inline-comments
      `),
      'max-file-lines': ['error', { maxLines: 600, maxLinesTest: 700 }],
      'import-order': ['error', { internalScopes: ['@hyperfrontend'] }],
      'export-order': ['error', { internalScopes: ['@hyperfrontend'] }],
      'no-enum': ['error', { freezeImport: "import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'" }],
    },
  },
  {
    files: SCRIPT,
    rules: {
      'escape-package-tags': ['error', { prefixes: WORKSPACE_PACKAGE_PREFIXES }],
      'jsdoc/escape-inline-tags': ['warn', { allowedInlineTags: WORKSPACE_PACKAGE_PREFIXES.map((prefix) => prefix.slice(1)) }],
    },
  },
  { files: TYPESCRIPT, ignores: ['**/test.setup.ts', '**/libs/logging/**'], rules: { 'workspace/no-direct-console': 'error' } },
  { files: TYPESCRIPT, ignores: ['**/test.setup.ts', '**/*.spec.ts'], rules: { 'no-namespace-import': 'error' } },
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
    rules: { 'no-inline-type-literal': 'error' },
  },
  { files: ['**/*.spec.ts'], rules: on('assertive-test-names jest-mock-after-imports') },
  { files: ['**/*.spec.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'], rules: { 'one-assertion-per-test': 'error' } },
  {
    // why: the fixture suites under the testing package's e2e project are inputs the suite executes and counts, and one of them must assert twice to exercise expect.assertions(2); their shape is the thing under test, not a test of this workspace.
    files: ['apps/package-e2e/testing/src/fixtures/**'],
    rules: { 'one-assertion-per-test': 'off' },
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
        workspace/lib-readme-structure workspace/lib-readme-compatibility-table workspace/lib-readme-media-regions
        no-ascii-art-diagrams codeblock-line-width workspace/lib-inline-code-links
      `),
      'workspace/readme-media-asset': ['error', { baseUrl: 'https://www.hyperfrontend.dev/media/', assetRoot: 'assets/media' }],
    },
  },
  { files: ['LIBRARY_COMPATIBILITY.md'], rules: { 'workspace/lib-compatibility-matrix': 'error' } },
  {
    files: ['**/*.md'],
    ignores: ['**/README.md'],
    rules: on('no-ascii-art-diagrams codeblock-line-width workspace/lib-inline-code-links'),
  },
  // why: a lint process runs from its project's root, so the working directory names the project whose documentation these blocks scope.
  ...documentationScopes(process.cwd()),
]
