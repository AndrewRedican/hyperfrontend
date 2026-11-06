import baseConfig from '../../lint.base.config.ts'

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/test.config.ts', '**/test.setup.ts', '**/*.types.ts'],
    rules: {
      'workspace/lib-pkg-main-reexports': ['error', { topology: 'barrel' }],
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      'projects/dependency-checks': [
        'error',
        {
          ignoredDependencies: [
            // why: the test runtime is imported by the specs and test.config.ts, and by the test executor's runner, which resolves it from the workspace the task runs in; it is an optional peer, never a dependency.
            '@hyperfrontend/testing',
            // why: the embedded builder loads the compiler from the consumer's node_modules; nothing here imports it, so the graph cannot see it.
            'typescript',
            // why: the embedded builder's TypeScript plugin resolves tslib from the consumer's node_modules at build time; it is never imported here, so the graph cannot see it.
            'tslib',
            // why: rollup platform bindings are optionalDependencies so the build executor resolves its native binding on a cold install; they are never imported, so the graph cannot see them.
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
          ignoredFiles: ['{projectRoot}/lint.config.ts'],
        },
      ],
    },
  },
]
