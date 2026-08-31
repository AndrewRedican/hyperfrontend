const baseConfig = require('../../eslint.base.config.cjs')

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'workspace/no-direct-console': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'workspace/max-file-lines': [
        'error',
        {
          maxLines: 750,
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
