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
  ],
  coverageDirectory: '../../coverage/libs/questions',
  coverageThreshold: {
    global: {
      branches: 93,
      functions: 100,
      lines: 98,
      statements: 98,
    },
  },
  displayName: 'questions',
  moduleFileExtensions: ['ts', 'js', 'html'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}
