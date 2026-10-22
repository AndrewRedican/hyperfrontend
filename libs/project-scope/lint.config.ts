import baseConfig from '../../lint.base.config.ts'

export default [
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
      'projects/dependency-checks': [
        'error',
        {
          ignoredDependencies: ['@hyperfrontend/testing'],
          ignoredFiles: ['{projectRoot}/lint.config.ts'],
        },
      ],
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
