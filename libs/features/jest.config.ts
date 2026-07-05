import type { Config } from 'jest'

export default <Config>{
  displayName: 'features',
  preset: '../../jest.preset.cjs',
  coverageDirectory: '../../coverage/libs/features',
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!jest.config.{ts,tsx}',
    '!**/index.{ts,tsx}',
    '!**/*.d.{ts,tsx}',
    '!**/*.spec.ts',
    '!**/jest.setup*.ts',
    // why: Bin entry is a thin re-export wired to the builder bootstrap; the runner it exposes is covered by bin.spec.ts.
    '!**/bin/**',
    // why: The tiered loader's native `await import()` compiles to __importStar/__awaiter helper branches ts-jest cannot exercise; behaviour is covered by load-module.spec.ts.
    '!**/cli/config/load-module.ts',
    // why: Module self-location reads `import.meta.url` on its ESM branch, which the CommonJS test runtime cannot parse; jest maps the module to the `__dirname` stub, so both files sit outside coverage while dev-server.spec.ts covers the locating behaviour.
    '!**/server/module-dir.ts',
    '!**/server/module-dir.stub.ts',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', 'src/shared/types.ts', 'src/host/types.ts', 'src/hostee/types.ts', 'src/nx/model.ts'],
  projects: [
    {
      displayName: 'features/node',
      preset: '../../jest.preset.cjs',
      moduleFileExtensions: ['ts', 'js', 'html'],
      testEnvironment: 'node',
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['^.*browser\\.spec\\.ts$'],
      // why: The real module-dir.ts carries an `import.meta` token on its ESM branch; the CommonJS test runtime cannot parse it, so requests resolve to a `__dirname` stub with identical behaviour.
      moduleNameMapper: { '^\\./module-dir$': '<rootDir>/src/server/module-dir.stub.ts' },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
    {
      displayName: 'features/browser',
      preset: '../../jest.preset.cjs',
      moduleFileExtensions: ['ts', 'js', 'html'],
      testEnvironment: 'jsdom',
      testMatch: ['**/*.browser.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/jest.setup.browser.ts'],
    },
  ],
}
