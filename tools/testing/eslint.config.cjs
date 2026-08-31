const baseConfig = require('../../eslint.base.config.cjs')

module.exports = [
  ...baseConfig,
  {
    // context: this project is the test runtime itself. It must resolve to zero workspace packages, because every
    // context: library's specs import it and a dependency back onto a library would close a cycle in the Nx graph.
    // context: it must also stay unobservable to the code under test, which mocks the built-in-copy modules project-wide.
    files: ['**/*.ts'],
    rules: {
      'workspace/no-unsafe-builtin-methods': 'off',
      // context: reporting has to reach the terminal directly, since @hyperfrontend/logging is a workspace package this project cannot depend on.
      'workspace/no-direct-console': 'off',
      // context: this is the replacement for @types/jest, whose own surface is `any`-typed; narrowing it here would reject the call sites it exists to type.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
]
