import type { Config } from 'jest'

export default <Config>{
  preset: '../../../jest.preset.cjs',
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!jest.config.{ts,tsx}',
    '!**/index.{ts,tsx}',
    '!**/*.d.{ts,tsx}',
    '!**/*.spec.ts',
    '!**/jest.setup*.ts',
  ],
  coverageDirectory: '../../../coverage/libs/utils/string',
  projects: [
    {
      displayName: 'string-utils/node',
      preset: '../../../jest.preset.cjs',
      testEnvironment: 'node',
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['^.*browser\\.spec\\.ts$'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
    {
      displayName: 'string-utils/browser',
      preset: '../../../jest.preset.cjs',
      moduleFileExtensions: ['ts', 'js', 'html'],
      testEnvironment: 'jsdom',
      testMatch: ['**/browser.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
}
