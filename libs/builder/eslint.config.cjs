const baseConfig = require('../../eslint.base.config.cjs')

module.exports = [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/jest.config.ts', '**/jest.setup.ts', '**/*.types.ts'],
    rules: {
      'workspace/lib-pkg-main-reexports': ['error', { topology: 'fragmented' }],
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredDependencies: [
            'jest',
            // why: the bundled TypeScript plugin resolves tslib from the consumer's node_modules at build time; it is never imported here, so the graph cannot see it.
            'tslib',
            // why: rollup platform bindings are optionalDependencies so the bundled rollup worker resolves its native binding on a cold install; they are never imported, so the graph cannot see them.
            '@rollup/rollup-android-arm-eabi',
            '@rollup/rollup-android-arm64',
            '@rollup/rollup-darwin-arm64',
            '@rollup/rollup-darwin-x64',
            '@rollup/rollup-freebsd-arm64',
            '@rollup/rollup-freebsd-x64',
            '@rollup/rollup-linux-arm-gnueabihf',
            '@rollup/rollup-linux-arm-musleabihf',
            '@rollup/rollup-linux-arm64-gnu',
            '@rollup/rollup-linux-arm64-musl',
            '@rollup/rollup-linux-loong64-gnu',
            '@rollup/rollup-linux-loong64-musl',
            '@rollup/rollup-linux-ppc64-gnu',
            '@rollup/rollup-linux-ppc64-musl',
            '@rollup/rollup-linux-riscv64-gnu',
            '@rollup/rollup-linux-riscv64-musl',
            '@rollup/rollup-linux-s390x-gnu',
            '@rollup/rollup-linux-x64-gnu',
            '@rollup/rollup-linux-x64-musl',
            '@rollup/rollup-openbsd-x64',
            '@rollup/rollup-openharmony-arm64',
            '@rollup/rollup-win32-arm64-msvc',
            '@rollup/rollup-win32-ia32-msvc',
            '@rollup/rollup-win32-x64-gnu',
            '@rollup/rollup-win32-x64-msvc',
          ],
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
        },
      ],
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
  },
]
