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
  ],
  coveragePathIgnorePatterns: ['/node_modules/', 'src/shared/types.ts', 'src/host/types.ts', 'src/hostee/types.ts'],
  projects: [
    {
      displayName: 'features/node',
      preset: '../../jest.preset.cjs',
      moduleFileExtensions: ['ts', 'js', 'html'],
      testEnvironment: 'node',
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['^.*browser\\.spec\\.ts$'],
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
