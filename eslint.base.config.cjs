/* eslint-disable @typescript-eslint/no-require-imports */
const nx = require('@nx/eslint-plugin');
const pluginJest = require('eslint-plugin-jest');

module.exports = [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['docs/', '.nx/', 'dist/', 'coverage/', 'tmp/']
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
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*']
            }
          ]
        }
      ]
    }
  },
  {
    files: ['**/*.spec.{ts,tsx,js,jsx}'],
    plugins: { jest: pluginJest },
    languageOptions: {
      globals: { ...pluginJest.environments.globals.globals }
    },
    rules: { ...pluginJest.configs.recommended.rules },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {}
  },
  {
    files: ['**/package.json'],
    plugins: { 'package-json': require('eslint-plugin-package-json') },
    languageOptions: {
      parser: require('jsonc-eslint-parser')
    },
    rules: {
      'package-json/restrict-dependency-ranges': [
        'error',
        {
          forDependencyTypes: [
            'dependencies',
            'devDependencies',
            'optionalDependencies'
          ],
          rangeType: 'pin'
        }
      ]
    }
  }
]