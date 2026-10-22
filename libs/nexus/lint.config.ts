import baseConfig from '../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      'projects/dependency-checks': [
        'error',
        {
          ignoredDependencies: ['@hyperfrontend/testing', '@hyperfrontend/network-protocol'],
          ignoredFiles: ['{projectRoot}/lint.config.ts'],
        },
      ],
    },
  },
]
