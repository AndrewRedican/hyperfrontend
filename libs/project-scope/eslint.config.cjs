const baseConfig = require('../../eslint.base.config.cjs')

module.exports = [
  ...baseConfig,
  {
    ignores: ['**/__fixtures__/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'workspace/max-file-lines': [
        'error',
        {
          maxLines: 500,
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
          ignoredDependencies: ['@hyperfrontend/testing', '@jest/globals'],
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
