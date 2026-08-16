import js from '@eslint/js'
import { globalIgnores } from 'eslint/config'
import pluginOxlint from 'eslint-plugin-oxlint'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import pluginReactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      pluginReactHooks.configs.flat['recommended-latest'],
      pluginReactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json')
)
