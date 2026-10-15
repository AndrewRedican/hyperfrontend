const baseConfig = require('../../eslint.base.config.cjs')

module.exports = [
  ...baseConfig,
  {
    // context: this package is the test runtime itself. It must resolve to zero workspace packages, because every
    // context: library's specs import it and a dependency back onto a library would close a cycle in the Nx graph.
    // context: it must also stay unobservable to the code under test, which mocks the built-in-copy modules project-wide.
    files: ['**/*.ts'],
    rules: {
      'workspace/no-unsafe-builtin-methods': 'off',
      // context: this is the replacement for @types/jest, whose own surface is `any`-typed; narrowing it here would reject the call sites it exists to type.
      '@typescript-eslint/no-explicit-any': 'off',
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
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
]
