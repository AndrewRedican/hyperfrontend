const baseConfig = require('../../eslint.base.config.cjs')
const pluginReact = require('eslint-plugin-react')
const pluginReactHooks = require('eslint-plugin-react-hooks')
const pluginJsxA11y = require('eslint-plugin-jsx-a11y')
const eslintRules = require('../../tools/eslint-rules/src/index.ts')

module.exports = [
  {
    ignores: ['.next/', 'out/', 'node_modules/', 'next-env.d.ts'],
  },
  ...baseConfig,
  {
    // Ensure all publishable libraries are documented in content.ts
    files: ['src/lib/content.ts'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/docs-site-libraries': 'error',
    },
  },
  {
    // Allow @hyperfrontend/ imports from npm packages installed in this app's node_modules
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: ['^@hyperfrontend/'],
        },
      ],
    },
  },
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
      'jsx-a11y': pluginJsxA11y,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: '19.0',
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-description': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    rules: {
      'jsdoc/check-tag-names': 'off',
      'jsdoc/require-jsdoc': 'off',
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
          ignoredDependencies: [
            // Apps are standalone and install @hyperfrontend packages from npm
            // They should not be subject to monorepo version synchronization rules
            '@hyperfrontend/cryptography',
            '@hyperfrontend/data-utils',
            '@hyperfrontend/function-utils',
            '@hyperfrontend/immutable-api-utils',
            '@hyperfrontend/json-utils',
            '@hyperfrontend/list-utils',
            '@hyperfrontend/logging',
            '@hyperfrontend/network-protocol',
            '@hyperfrontend/nexus',
            '@hyperfrontend/project-scope',
            '@hyperfrontend/random-generator-utils',
            '@hyperfrontend/state-machine',
            '@hyperfrontend/string-utils',
            '@hyperfrontend/time-utils',
            '@hyperfrontend/ui-utils',
            '@hyperfrontend/web-worker',
            // Third-party dependencies used by docs-site
            'clsx',
            'mermaid',
            'next',
            'next-themes',
            'react',
            'react-dom',
            '@tailwindcss/typography',
            '@types/node',
            '@types/react',
            '@types/react-dom',
            'autoprefixer',
            'postcss',
            'tailwindcss',
            'typescript',
          ],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
]
