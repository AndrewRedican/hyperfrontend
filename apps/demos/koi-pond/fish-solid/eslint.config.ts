import js from '@eslint/js'
import { globalIgnores } from 'eslint/config'
import pluginOxlint from 'eslint-plugin-oxlint'
import pluginSolid from 'eslint-plugin-solid/configs/typescript'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    // why: Solid's JSX compiles to real DOM rather than a virtual one, so its reactivity rules are the only ones that read this app correctly.
    ...pluginSolid,
    files: ['**/*.tsx'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json')
)
