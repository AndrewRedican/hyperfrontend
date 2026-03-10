const baseConfig = require('./eslint.base.config.cjs')
const eslintRules = require('./tools/eslint-rules/src/index.ts')

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
      workspace: eslintRules,
      markdown: require('@eslint/markdown').default,
    },
    language: 'markdown/gfm',
    rules: {
      'workspace/root-readme-packages': 'error',
    },
  },
  {
    files: ['.github/workflows/ci-libraries.yml'],
    plugins: {
      workspace: eslintRules,
    },
    languageOptions: {
      parser: require('yaml-eslint-parser'),
    },
    rules: {
      'workspace/lib-ci-workflows': 'error',
    },
  },
  {
    ignores: ['docs/', '.nx/', 'dist/', 'coverage/', 'tmp/', '**/*.spec.{ts,tsx,js,jsx}'],
  },
]
