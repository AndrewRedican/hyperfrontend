import baseConfig from './lint.base.config.ts'

/**
 * What a project declaring `metadata.lifecycle.state: "frozen"` may not carry.
 *
 * Shipped demonstrations are artefacts rather than living code: they keep only what a deployed
 * artifact needs, and every linter, test runner and quality gate added to one is maintenance cost
 * that buys nothing. `workspace/project-lifecycle-policy` skips any project declaring no lifecycle,
 * so libraries, tools and e2e projects are untouched by this.
 */
const FROZEN_PROJECT_POLICY = {
  forbiddenTargets: ['lint', 'test', 'e2e'],
  forbiddenScripts: ['lint', 'lint:*', 'test', 'test:*'],
  forbiddenDependencies: [
    'eslint',
    'eslint-*',
    '@eslint/*',
    '@*/eslint-*',
    'typescript-eslint',
    'oxlint',
    'globals',
    'jiti',
    'vitest',
    '@vitest/*',
    'jest',
    '@jest/*',
    'ts-jest',
    '@testing-library/*',
    '@vue/test-utils',
    'axe-core',
    'jsdom',
    '@types/jsdom',
    'playwright*',
    'cypress',
  ],
  forbiddenFiles: [
    '**/*.spec.*',
    '**/*.test.*',
    '**/__tests__/**',
    'eslint.config.*',
    'lint.config.*',
    '.oxlintrc.json',
    '.eslintrc*',
    'vitest.config.*',
    'jest.config.*',
    'tsconfig.vitest.json',
    'tsconfig.spec.json',
  ],
  forbidNpmPublishing: true,
}

/**
 * What a project declaring `metadata.lifecycle.state: "planned"` may not carry: a reserved slot
 * holds a README and its manifests, and nothing that pretends the demo already exists.
 */
const PLANNED_PROJECT_POLICY = {
  forbiddenTargets: ['*'],
  forbiddenFiles: ['src/**'],
}

export default [
  {
    files: ['**/*.json'],
    // Override or add rules here
    rules: {},
  },

  ...baseConfig,
  {
    // context: the projects this governs deliberately have no lint target of their own, so the
    // context: workspace-root lint target names their manifests in lintFilePatterns and reports here.
    files: ['**/project.json', '**/package.json'],
    rules: {
      'workspace/project-lifecycle-policy': ['error', { states: { frozen: FROZEN_PROJECT_POLICY, planned: PLANNED_PROJECT_POLICY } }],
    },
  },
  {
    files: ['**/package.json'],
    rules: {
      'workspace/no-vscode-config': 'error',
      'workspace/no-test-fixtures': 'error',
    },
  },
  {
    files: ['.devcontainer/**/devcontainer.json'],
    rules: { 'workspace/no-vscode-extensions': ['error', { allow: ['anthropic.claude-code', 'github.vscode-github-actions'] }] },
  },
  {
    // context: no demo carries a lint target; these three only stop an editor resolving this config from reporting a shipped demo against rules it cannot satisfy from a consumer's seat.
    files: ['apps/demos/**/*.ts', 'apps/demos/**/*.tsx'],
    rules: {
      // why: the safe built-in copies live in an internal package a consumer-lens demo must not depend on, so the rule is unsatisfiable rather than unmet.
      'workspace/no-unsafe-builtin-methods': 'off',
      // why: a demo consumes the published packages by npm name, and the project graph resolves those names through the tsconfig path aliases and reads them as coupling to workspace sources.
      'projects/module-boundaries': 'off',
      // why: a shipped simulation is an exhibit; splitting its steering brain or pond assembly for a line count is surgery that changes nothing a visitor sees.
      'max-file-lines': 'off',
    },
  },
  {
    // context: a demo's README is an engineering note read on GitHub, never a document the site renders at a phone's width, and the demos are frozen besides; this only stops an editor resolving this config from asking a shipped demo to refold its samples.
    files: ['apps/demos/**/*.md'],
    rules: {
      'codeblock-line-width': 'off',
    },
  },
  {
    // context: the features CLI owns the `<hf:feature>` block at the top of a demo's entry module and deliberately imports the feature handle first. Ordering that block by source category moves the import and drops the block's closing marker, so the CLI can no longer find the region it manages.
    files: ['apps/demos/**/src/main.ts', 'apps/demos/**/src/main.tsx'],
    rules: {
      'import-order': 'off',
    },
  },
  {
    // context: package-e2e projects consume @hyperfrontend packages installed from built tarballs, not workspace sources.
    // context: their specs also import shared helpers that live one level above each project root.
    files: ['apps/package-e2e/**/*.ts'],
    rules: {
      'projects/module-boundaries': [
        'error',
        {
          allow: ['^@hyperfrontend/', '^\\.\\./\\.\\./shared/'],
        },
      ],
    },
  },
  {
    // context: the package-e2e support helpers run inside scratch consumer workspaces where the @hyperfrontend built-in-copy replacements are not installed and no tsconfig path maps them, so the safe spellings cannot resolve.
    files: ['apps/package-e2e/**/src/support/**/*.ts', 'apps/package-e2e/shared/**/*.ts'],
    rules: {
      'workspace/no-unsafe-builtin-methods': 'off',
    },
  },
  {
    // context: spec files in this directory were excluded from linting entirely until test-name enforcement was added.
    // context: until the package-e2e specs are onboarded to the remaining workspace style rules, this override keeps them out of those rules.
    files: ['apps/package-e2e/**/*.spec.ts'],
    rules: {
      'no-decorative-header-comments': 'off',
      'no-plain-inline-comments': 'off',
      'import-order': 'off',
      'typescript/no-empty-function': 'off',
    },
  },
  {
    files: ['README.md'],
    rules: {
      // why: the root readme is a landing page that lists every package under one heading, flagship first, rather than sorting them into main and internal
      'workspace/root-readme-packages': ['error', { sections: ['Packages'] }],
    },
  },
  {
    files: ['.github/workflows/ci-main.yml'],
    rules: {
      'workspace/lib-ci-workflows': 'error',
      // why: npm auth writes the token the publishes use, and the Codecov uploads report the coverage main lands; a pull request does neither
      'workspace/main-steps-on-pr': [
        'error',
        { mainOnly: ['npm auth', 'Upload overall coverage to Codecov', 'Upload library coverage to Codecov'] },
      ],
    },
  },
  {
    // context: the pipeline applies this file to production, so each service's serve pin must be the release its demo installs
    files: ['.railway/railway.ts'],
    rules: {
      'workspace/railway-service-pins': 'error',
    },
  },
  {
    files: ['tsconfig.base.json'],
    rules: {
      'workspace/lib-tsconfig-paths': [
        'error',
        {
          libraryDirectories: ['libs', 'plugins', 'tools'],
          excludePatterns: ['__fixtures__', 'node_modules', 'dist'],
        },
      ],
    },
  },
  {
    // context: a releasable change to a file the toolchain input reads releases every library, so each builder source file is either read by it or named here with the reason it shapes no tarball
    files: ['hf.json'],
    rules: {
      'workspace/named-input-coverage': [
        'error',
        {
          input: 'toolchain',
          projectRoot: 'libs/builder',
          outside: [
            // why: the package barrel holds re-exports alone, so whatever a build emits is decided in the modules it names
            'src/index.ts',
            // why: the bundle barrel holds re-exports alone, of the phase runner and of one type
            'src/bundle/index.ts',
            // why: it refuses an output path over the build's inputs and removes a previous build of the same package, and the manifest it stamps is overwritten whole by the package phase; a release builds into an empty directory, where it removes nothing
            'src/clean-output.ts',
            // why: it finds the worker script beside the running module and the loader that starts it; what a worker emits is the worker's own code, which the input reads
            'src/bundle/worker-locator.ts',
            // why: the monitor reads the memory of the process and logs it, and recover yields one tick and collects garbage between phases; neither reads or writes a file of a build
            'src/memory/**',
          ],
        },
      ],
    },
  },
  {
    ignores: ['docs/', 'dist/', 'coverage/', 'tmp/'],
  },
]
