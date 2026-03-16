const nx = require('@nx/eslint-plugin')
const pluginJest = require('eslint-plugin-jest')
const eslintRules = require('./tools/eslint-rules/src/index.ts')

module.exports = [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ...require('eslint-plugin-jsdoc').configs['flat/recommended-typescript'],
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  },
  {
    ignores: ['docs/', '.nx/', 'dist/', 'coverage/', 'tmp/', '**/node_modules/', '**/.next/', '**/out/'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            // Core libraries: no dependencies on other libraries
            {
              sourceTag: 'type:core',
              onlyDependOnLibsWithTags: [],
            },
            // Utility libraries: can depend on core
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:core', 'type:util'],
            },
            // Feature libraries: can depend on core and utils
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: ['type:core', 'type:util', 'type:feature'],
            },
            // Protocol libraries: can depend on core and utils
            {
              sourceTag: 'type:protocol',
              onlyDependOnLibsWithTags: ['type:core', 'type:util', 'type:protocol'],
            },
            // Applications: can depend on util libraries
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:util'],
            },
            // Demos: cannot import from local libraries (npm packages only)
            {
              sourceTag: 'type:demo',
              onlyDependOnLibsWithTags: [],
            },
            // Standalone apps: cannot import from local libraries
            {
              sourceTag: 'scope:standalone',
              onlyDependOnLibsWithTags: [],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    files: ['**/package.json'],
    plugins: { 'package-json': require('eslint-plugin-package-json') },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
    rules: {
      'package-json/restrict-dependency-ranges': [
        'error',
        {
          forDependencyTypes: ['dependencies', 'devDependencies', 'optionalDependencies'],
          rangeType: 'pin',
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-check': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': ['error', { typed: true, definedTags: ['locked'] }],
      'jsdoc/check-alignment': 'error',
      'jsdoc/multiline-blocks': 'error',
      'jsdoc/tag-lines': ['error', 'any', { startLines: 1 }],
      'jsdoc/empty-tags': 'error',
      'jsdoc/no-defaults': 'error',
      'jsdoc/require-description': 'error',
      'jsdoc/informative-docs': 'error',
      'jsdoc/check-types': 'off',
      'jsdoc/valid-types': 'off',
      'jsdoc/no-types': 'off',
    },
  },
  {
    files: ['**/*.spec.{ts,tsx,js,jsx}'],
    plugins: { jest: pluginJest },
    languageOptions: {
      globals: { ...pluginJest.environments.globals.globals },
    },
    rules: {
      ...pluginJest.configs.recommended.rules,
      'jsdoc/check-tag-names': [
        'error',
        {
          definedTags: ['jest-environment'],
        },
      ],
      'jsdoc/require-jsdoc': 'off',
    },
  },
  {
    files: ['**/index.ts'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/no-unwanted-barrel-files': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/no-unsafe-builtin-methods': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/require-node-protocol': 'error',
      'workspace/no-mixed-type-import': 'error',
      'workspace/import-order': 'error',
      'workspace/no-enum': 'error',
      'workspace/no-async-fs-api': 'error',
      'workspace/no-deprecated-tag': 'error',
      'workspace/no-unsafe-regex': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts', '**/*.spec.ts'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/no-namespace-import': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts', '**/*.spec.ts'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/prefer-angle-bracket-assertion': 'error',
    },
  },
  {
    files: ['**/*.spec.ts'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/assertive-test-names': 'error',
    },
  },
  {
    files: ['**/package.json'],
    plugins: {
      workspace: eslintRules,
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
    rules: {
      'workspace/lib-pkg-fields': 'error',
      'workspace/lib-pkg-package-json-export': 'error',
      'workspace/lib-pkg-bundle-entry': 'error',
      'workspace/lib-pkg-exports-exist': 'error',
      'workspace/lib-pkg-exports-js-only': 'error',
      'workspace/lib-pkg-no-main': 'error',
    },
  },
  {
    files: ['**/project.json'],
    plugins: {
      workspace: eslintRules,
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
    rules: {
      'workspace/lib-project-metadata': 'error',
      'workspace/lib-project-bundle-config': 'error',
      'workspace/lib-e2e-project-required': 'error',
    },
  },
  {
    files: ['**/README.md'],
    plugins: {
      workspace: eslintRules,
      markdown: require('@eslint/markdown').default,
    },
    language: 'markdown/gfm',
    rules: {
      'workspace/lib-readme-structure': 'error',
    },
  },
]
