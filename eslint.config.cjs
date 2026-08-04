const baseConfig = require('./eslint.base.config.cjs')

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
      'jest/no-conditional-expect': 'off',
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
