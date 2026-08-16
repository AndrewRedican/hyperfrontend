import js from '@eslint/js'
import { globalIgnores } from 'eslint/config'
import pluginOxlint from 'eslint-plugin-oxlint'
import pluginSvelte from 'eslint-plugin-svelte'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import svelteConfig from './svelte.config.js'

export default tseslint.config(
  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,svelte}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  ...pluginSvelte.configs.recommended,

  {
    name: 'app/svelte-parser',
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      // why: The Svelte parser owns the file, delegates every `<script lang="ts">` block to the TypeScript parser, and needs the project's own config to know which runes and options apply.
      parserOptions: { extraFileExtensions: ['.svelte'], parser: tseslint.parser, svelteConfig },
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json')
)
