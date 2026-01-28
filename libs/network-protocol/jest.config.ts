import type { Config } from 'jest'

export default <Config>{
  preset: '../../jest.preset.cjs',
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!jest.config.{ts,tsx}',
    '!**/index.{ts,tsx}',
    '!**/*.d.{ts,tsx}',
    '!**/*.spec.ts',
    '!**/jest.setup*.ts',
    '!**/model.ts',
    '!**/mocks.ts',
    '!**/test-fixtures.ts',
  ],
  coverageDirectory: '../../coverage/libs/network-protocol',
  projects: [
    {
      displayName: 'network-protocol/node',
      preset: '../../jest.preset.cjs',
      moduleFileExtensions: ['ts', 'js', 'html'],
      testEnvironment: 'node',
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['^.*browser\\.spec\\.ts$'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      coverageThreshold: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
    {
      displayName: 'network-protocol/browser',
      preset: '../../jest.preset.cjs',
      moduleFileExtensions: ['ts', 'js', 'html'],
      testEnvironment: 'jsdom',
      testMatch: ['**/*.browser.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/jest.setup.browser.ts'],
      coverageThreshold: {
        global: {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
      },
    },
  ],
}
