import baseConfig from '../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'max-file-lines': [
        'error',
        {
          maxLines: 600,
          maxLinesTest: 1100,
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
          ignoredFiles: ['{projectRoot}/lint.config.ts', '{projectRoot}/scripts/**'],
        },
      ],
    },
  },
]
