import baseConfig from '../../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    // why: these files are generated from upstream Nx sources by `tool-workspace:types-extract` and checked byte for byte, so the workspace's authoring rules do not apply to them.
    ignores: [
      'src/compat/executor.ts',
      'src/compat/graph.ts',
      'src/compat/tree.ts',
      'src/compat/plugin.ts',
      'src/compat/REPORT.md',
      'src/compat/NOTICE.md',
    ],
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
