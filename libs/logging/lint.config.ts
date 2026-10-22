import baseConfig from '../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'workspace/no-direct-console': 'off',
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
]
