import baseConfig from '../../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      'projects/dependency-checks': [
        'error',
        {
          ignoredDependencies: ['@hyperfrontend/testing', '@rollup/plugin-babel', '@rollup/plugin-node-resolve'],
          ignoredFiles: ['{projectRoot}/lint.config.ts'],
        },
      ],
    },
  },
]
