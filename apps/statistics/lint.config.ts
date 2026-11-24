import baseConfig from '../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    // why: the tracked packages are a hand-written list, which only this rule holds to the publishable libraries.
    files: ['service.config.ts'],
    rules: {
      'workspace/statistics-packages': 'error',
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
