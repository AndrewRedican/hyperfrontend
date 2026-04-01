/**
 * Configuration pattern information.
 */
export interface ConfigPatternInfo {
  /** File patterns to match */
  patterns: string[]
  /** Primary format (optional - auto-detected from file extension if not provided) */
  format?: 'json' | 'jsonc' | 'yaml' | 'js' | 'ts' | 'ini' | 'dotenv' | 'text'
  /** Human-readable description */
  description: string
  /** Whether config can extend others */
  canExtend?: boolean
  /** Whether file may contain secrets */
  sensitive?: boolean
}

/**
 * Configuration type identifier.
 */
export type ConfigType =
  | 'package.json'
  | 'package-lock.json'
  | 'pnpm-lock.yaml'
  | 'yarn.lock'
  | '.npmrc'
  | 'tsconfig'
  | 'nx'
  | 'project.json'
  | 'workspace.json'
  | 'turbo'
  | 'lerna'
  | 'webpack'
  | 'rollup'
  | 'vite'
  | 'esbuild'
  | 'babel'
  | 'swc'
  | 'jest'
  | 'vitest'
  | 'cypress'
  | 'playwright'
  | 'next'
  | 'angular'
  | 'nuxt'
  | 'svelte'
  | 'astro'
  | 'eslint'
  | 'prettier'
  | 'env'
  | '.gitignore'
  | '.gitattributes'

/**
 * Known configuration file patterns organized by type.
 */
export const CONFIG_PATTERNS: Record<ConfigType, ConfigPatternInfo> = {
  'package.json': {
    patterns: ['package.json'],
    format: 'json',
    description: 'NPM package manifest',
  },
  'package-lock.json': {
    patterns: ['package-lock.json'],
    format: 'json',
    description: 'NPM lockfile',
  },
  'pnpm-lock.yaml': {
    patterns: ['pnpm-lock.yaml'],
    format: 'yaml',
    description: 'PNPM lockfile',
  },
  'yarn.lock': {
    patterns: ['yarn.lock'],
    format: 'text',
    description: 'Yarn lockfile',
  },
  '.npmrc': {
    patterns: ['.npmrc'],
    format: 'ini',
    description: 'NPM configuration',
    sensitive: true,
  },

  tsconfig: {
    patterns: ['tsconfig.json', 'tsconfig.*.json'],
    format: 'jsonc',
    description: 'TypeScript configuration',
    canExtend: true,
  },

  nx: {
    patterns: ['nx.json'],
    format: 'json',
    description: 'NX workspace configuration',
  },
  'project.json': {
    patterns: ['project.json', '**/project.json'],
    format: 'json',
    description: 'NX project configuration',
  },
  'workspace.json': {
    patterns: ['workspace.json'],
    format: 'json',
    description: 'NX workspace projects (deprecated)',
  },
  turbo: {
    patterns: ['turbo.json'],
    format: 'jsonc',
    description: 'TurboRepo configuration',
  },
  lerna: {
    patterns: ['lerna.json'],
    format: 'json',
    description: 'Lerna configuration',
  },

  webpack: {
    patterns: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.cjs', 'webpack.config.mjs'],
    format: 'js',
    description: 'Webpack configuration',
  },
  rollup: {
    patterns: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
    format: 'js',
    description: 'Rollup configuration',
  },
  vite: {
    patterns: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
    format: 'js',
    description: 'Vite configuration',
  },
  esbuild: {
    patterns: ['esbuild.config.js', 'esbuild.config.ts', 'esbuild.config.mjs'],
    format: 'js',
    description: 'esbuild configuration',
  },
  babel: {
    patterns: ['babel.config.js', 'babel.config.json', '.babelrc', '.babelrc.js', '.babelrc.json'],
    format: 'json',
    description: 'Babel configuration',
  },
  swc: {
    patterns: ['.swcrc'],
    format: 'json',
    description: 'SWC configuration',
  },

  jest: {
    patterns: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs'],
    description: 'Jest configuration',
  },
  vitest: {
    patterns: ['vitest.config.js', 'vitest.config.ts'],
    description: 'Vitest configuration',
  },
  cypress: {
    patterns: ['cypress.config.js', 'cypress.config.ts'],
    description: 'Cypress configuration',
  },
  playwright: {
    patterns: ['playwright.config.js', 'playwright.config.ts'],
    description: 'Playwright configuration',
  },

  next: {
    patterns: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    format: 'js',
    description: 'Next.js configuration',
  },
  angular: {
    patterns: ['angular.json'],
    format: 'json',
    description: 'Angular CLI configuration',
  },
  nuxt: {
    patterns: ['nuxt.config.js', 'nuxt.config.ts'],
    format: 'js',
    description: 'Nuxt.js configuration',
  },
  svelte: {
    patterns: ['svelte.config.js', 'svelte.config.ts'],
    format: 'js',
    description: 'SvelteKit configuration',
  },
  astro: {
    patterns: ['astro.config.js', 'astro.config.ts', 'astro.config.mjs'],
    format: 'js',
    description: 'Astro configuration',
  },

  eslint: {
    patterns: [
      'eslint.config.js',
      'eslint.config.cjs',
      'eslint.config.mjs',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.json',
      '.eslintrc.yml',
    ],
    format: 'js',
    description: 'ESLint configuration',
  },
  prettier: {
    patterns: ['prettier.config.js', 'prettier.config.cjs', '.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml'],
    format: 'json',
    description: 'Prettier configuration',
  },

  env: {
    patterns: ['.env', '.env.*', '*.env'],
    format: 'dotenv',
    description: 'Environment variables',
    sensitive: true,
  },

  '.gitignore': {
    patterns: ['.gitignore'],
    format: 'text',
    description: 'Git ignore patterns',
  },
  '.gitattributes': {
    patterns: ['.gitattributes'],
    format: 'text',
    description: 'Git attributes',
  },
}

/**
 * Get patterns for specific config types.
 *
 * @param types - Array of config types to get patterns for
 * @returns Array of file patterns
 */
export function getConfigPatternsByType(types: ConfigType[]): string[] {
  return types.flatMap((type) => CONFIG_PATTERNS[type]?.patterns ?? [])
}
