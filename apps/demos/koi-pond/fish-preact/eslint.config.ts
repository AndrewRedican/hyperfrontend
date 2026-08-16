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
      // why: Preact's hooks are API-identical to React's, so the React hook rules read this app correctly; `eslint-config-preact` cannot be used here because it peers eslint 9 and forces a Babel parser that would discard type-aware linting.
      pluginReactHooks.configs.flat['recommended-latest'],
      pluginReactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json')
)
