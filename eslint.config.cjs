const baseConfig = require('./eslint.base.config.cjs')
const eslintRules = require('./tools/eslint-rules/src/index.ts')

/**
 * What a project declaring `metadata.lifecycle.state: "frozen"` may not carry.
 *
 * Shipped demonstrations are artefacts rather than living code: they keep only what a deployed
 * artifact needs, and every linter, test runner and quality gate added to one is maintenance cost
 * that buys nothing. `workspace/project-lifecycle-policy` skips any project declaring no lifecycle,
 * so libraries, tools and e2e projects are untouched by this.
 */
const FROZEN_PROJECT_POLICY = {
  forbiddenTargets: ['lint', 'test', 'e2e'],
  forbiddenScripts: ['lint', 'lint:*', 'test', 'test:*'],
  forbiddenDependencies: [
    'eslint',
    'eslint-*',
    '@eslint/*',
    '@*/eslint-*',
    'typescript-eslint',
    'oxlint',
    'globals',
    'jiti',
    'vitest',
    '@vitest/*',
    'jest',
    '@jest/*',
    'ts-jest',
    '@testing-library/*',
    '@vue/test-utils',
    'axe-core',
    'jsdom',
    '@types/jsdom',
    'playwright*',
    'cypress',
  ],
  forbiddenFiles: [
    '**/*.spec.*',
    '**/*.test.*',
    '**/__tests__/**',
    'eslint.config.*',
    '.oxlintrc.json',
    '.eslintrc*',
    'vitest.config.*',
    'jest.config.*',
    'tsconfig.vitest.json',
    'tsconfig.spec.json',
  ],
  forbidNpmPublishing: true,
}

/**
 * What a project declaring `metadata.lifecycle.state: "planned"` may not carry: a reserved slot
 * holds a README and its manifests, and nothing that pretends the demo already exists.
 */
const PLANNED_PROJECT_POLICY = {
  forbiddenTargets: ['*'],
  forbiddenFiles: ['src/**'],
}

module.exports = [
  {
    files: ['**/*.json'],
    // Override or add rules here
    rules: {},
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },

  ...baseConfig,
  {
    // context: the projects this governs deliberately have no lint target of their own, so the
    // context: workspace-root lint target names their manifests in lintFilePatterns and reports here.
    files: ['**/project.json', '**/package.json'],
    plugins: {
      workspace: eslintRules,
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
    rules: {
      'workspace/project-lifecycle-policy': ['error', { states: { frozen: FROZEN_PROJECT_POLICY, planned: PLANNED_PROJECT_POLICY } }],
    },
  },
  {
    files: ['**/package.json'],
    plugins: {
      workspace: eslintRules,
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
    rules: {
      'workspace/no-vscode-config': 'error',
    },
  },
  {
    // context: no demo carries a lint target; these three only stop an editor resolving this config from reporting a shipped demo against rules it cannot satisfy from a consumer's seat.
    files: ['apps/demos/**/*.ts', 'apps/demos/**/*.tsx'],
    rules: {
      // why: the safe built-in copies live in an internal package a consumer-lens demo must not depend on, so the rule is unsatisfiable rather than unmet.
      'workspace/no-unsafe-builtin-methods': 'off',
      // why: a demo consumes the published packages by npm name, and the project graph resolves those names through the tsconfig path aliases and reads them as coupling to workspace sources.
      '@nx/enforce-module-boundaries': 'off',
      // why: a shipped simulation is an exhibit; splitting its steering brain or pond assembly for a line count is surgery that changes nothing a visitor sees.
      'workspace/max-file-lines': 'off',
    },
  },
  {
    // context: a demo's README is an engineering note read on GitHub, never a document the site renders at a phone's width, and the demos are frozen besides; this only stops an editor resolving this config from asking a shipped demo to refold its samples.
    files: ['apps/demos/**/*.md'],
    rules: {
      'workspace/codeblock-line-width': 'off',
    },
  },
  {
    // context: the features CLI owns the `<hf:feature>` block at the top of a demo's entry module and deliberately imports the feature handle first. Ordering that block by source category moves the import and drops the block's closing marker, so the CLI can no longer find the region it manages.
    files: ['apps/demos/**/src/main.ts', 'apps/demos/**/src/main.tsx'],
    rules: {
      'workspace/import-order': 'off',
    },
  },
  {
    // context: package-e2e projects consume @hyperfrontend packages installed from built tarballs, not workspace sources.
    // context: their specs also import shared helpers that live one level above each project root.
    files: ['apps/package-e2e/**/*.ts'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: ['^@hyperfrontend/', '^\\.\\./\\.\\./shared/'],
        },
      ],
    },
  },
  {
    // context: the package-e2e support helpers run inside scratch consumer workspaces where the @hyperfrontend built-in-copy replacements are not installed and no tsconfig path maps them, so the safe spellings cannot resolve.
    files: ['apps/package-e2e/**/src/support/**/*.ts'],
    rules: {
      'workspace/no-unsafe-builtin-methods': 'off',
    },
  },
  {
    // context: spec files in this directory were excluded from linting entirely until test-name enforcement was added.
    // todo: onboard the package-e2e specs to the remaining workspace style rules, then delete this override.
    files: ['apps/package-e2e/**/*.spec.ts'],
    rules: {
      'workspace/no-decorative-header-comments': 'off',
      'workspace/no-plain-inline-comments': 'off',
      'workspace/import-order': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    files: ['README.md'],
    plugins: {
      markdown: require('@eslint/markdown').default,
    },
    language: 'markdown/gfm',
    rules: {
      'workspace/root-readme-packages': 'error',
    },
  },
  {
    files: ['.github/workflows/ci-libraries.yml'],
    languageOptions: {
      parser: require('yaml-eslint-parser'),
    },
    rules: {
      'workspace/lib-ci-workflows': 'error',
    },
  },
  {
    files: ['tsconfig.base.json'],
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
    rules: {
      'workspace/lib-tsconfig-paths': [
        'error',
        {
          libraryDirectories: ['libs', 'plugins', 'tools'],
          excludePatterns: ['__fixtures__', 'node_modules', 'dist'],
        },
      ],
    },
  },
  {
    ignores: ['docs/', '.nx/', 'dist/', 'coverage/', 'tmp/'],
  },
]
