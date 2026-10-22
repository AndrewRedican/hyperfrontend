import baseConfig from '../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      'projects/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/lint.config.ts'],
        },
      ],
    },
  },
  {
    files: ['**/package.json'],
    rules: {
      'projects/plugin-manifests': 'error',
    },
  },
]
