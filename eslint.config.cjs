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
    ignores: ['docs/', '.nx/', 'dist/', 'coverage/', 'tmp/', '**/*.spec.{ts,tsx,js,jsx}'],
  },
]
