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
          ignoredDependencies: ['jest'],
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
]
