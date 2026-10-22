import baseConfig from '../../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.types.ts'],
    rules: {
      'workspace/lib-pkg-main-reexports': ['error', { topology: 'isomorphic' }],
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
