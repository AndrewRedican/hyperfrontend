const baseConfig = require('../../eslint.base.config.cjs')

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Node.js type strip mode (used when require()'ing .ts files) doesn't support angle-bracket assertions - Vercel deployment issue
      'workspace/prefer-angle-bracket-assertion': 'off',
      'workspace/no-direct-console': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'workspace/max-file-lines': [
        'error',
        {
          maxLines: 710,
          maxLinesTest: 1420,
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
]
