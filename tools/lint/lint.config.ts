import baseConfig from '../../lint.base.config.ts'

export default [
  {
    // why: the fixtures under __fixtures__ are inputs of the specs, among them manifests shaped to trip rules.
    ignores: ['**/__fixtures__/'],
  },
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
]
