import baseConfig from '../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    // context: this package is the test runtime itself. It must resolve to zero workspace packages, because every
    // context: library's specs import it and a dependency back onto a library would close a cycle in the workspace graph.
    // context: it must also stay unobservable to the code under test, which mocks the built-in-copy modules project-wide.
    files: ['**/*.ts'],
    rules: {
      'workspace/no-unsafe-builtin-methods': 'off',
      // context: this is the replacement for @types/jest, whose own surface is `any`-typed; narrowing it here would reject the call sites it exists to type.
      'typescript/no-explicit-any': 'off',
      // context: this package implements createTempDir and useTempDir, so its own specs exercise the fs calls beneath them.
      'workspace/no-mkdtemp-in-tests': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.types.ts'],
    rules: {
      // why: the hooks and dom entries register hooks or install a DOM the moment they are imported, so the main entry must not re-export them.
      'workspace/lib-pkg-main-reexports': ['error', { topology: 'fragmented' }],
    },
  },
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
