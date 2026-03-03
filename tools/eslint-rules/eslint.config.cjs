const baseConfig = require('../../eslint.base.config.cjs')

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'workspace/no-unsafe-builtin-methods': 'off',
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
