import baseConfig from '../../lint.base.config.ts'

export default [
  {
    // why: the fixtures under __fixtures__ are inputs of the specs, among them sources shaped to trip rules.
    ignores: ['**/__fixtures__/'],
  },
  ...baseConfig,
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/test.config.ts', '**/test.setup.ts', '**/*.types.ts'],
    rules: {
      'workspace/lib-pkg-main-reexports': ['error', { topology: 'fragmented' }],
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
