const baseConfig = require('../../eslint.base.config.cjs')

module.exports = [
  ...baseConfig,
  {
    ignores: ['__fixtures__/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'workspace/max-file-lines': [
        'warn',
        {
          maxLines: 600,
          maxLinesTest: 1200,
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
          ignoredDependencies: ['jest'],
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}', '{projectRoot}/scripts/**'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
]
