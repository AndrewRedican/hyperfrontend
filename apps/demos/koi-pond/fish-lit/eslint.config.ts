import js from '@eslint/js'
import pluginVitest from '@vitest/eslint-plugin'
import { globalIgnores } from 'eslint/config'
import { configs as litConfigs } from 'eslint-plugin-lit'
import pluginOxlint from 'eslint-plugin-oxlint'
import { configs as wcConfigs } from 'eslint-plugin-wc'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    // why: Custom-element rules catch the lifecycle mistakes a class-based component makes — attributes touched in a constructor, a tag name that cannot be registered.
    ...wcConfigs['flat/recommended'],
    files: ['**/*.{ts,mts}'],
  },

  {
    // why: Markup inside `html` and `svg` template literals is opaque to every other linter here, so these rules are the only ones that read the koi's template at all.
    ...litConfigs['flat/recommended'],
    files: ['**/*.{ts,mts}'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json')
)
