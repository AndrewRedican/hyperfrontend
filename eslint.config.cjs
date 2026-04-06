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
    ignores: ['docs/', '.nx/', 'dist/', 'coverage/', 'tmp/', '**/*.spec.{ts,tsx,js,jsx}'],
  },
]
