const baseConfig = require('../../eslint.base.config.cjs')
const eslintRules = require('../../tools/eslint-rules/src/index.ts')

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      workspace: eslintRules,
    },
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
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
]
