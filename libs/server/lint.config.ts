import baseConfig from '../../lint.base.config.ts'

export default [
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
