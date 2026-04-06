const baseConfig = require('../../eslint.base.config.cjs')
const eslintRules = require('../../tools/eslint-rules/src/index.ts')

module.exports = [
  ...baseConfig,
  {
    ignores: ['**/__fixtures__/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/max-file-lines': [
        'error',
        {
          maxLines: 450,
          maxLinesTest: 870,
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
          ignoredDependencies: ['jest', '@jest/globals'],
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
  // Enforce use of core/fs wrappers instead of direct node:fs imports
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts', 'src/core/**/*.ts', 'src/vfs/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:fs', 'fs'],
              importNames: ['existsSync', 'readFileSync', 'writeFileSync', 'statSync', 'lstatSync', 'readdirSync'],
              message: 'Use wrappers from core/fs instead of direct Node.js fs imports.',
            },
          ],
        },
      ],
    },
  },
]
