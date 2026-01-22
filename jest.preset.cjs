/* eslint-disable @typescript-eslint/no-require-imports */
/** @type {import('jest').Config} */
module.exports = {
  ...require('@nx/jest/preset').default,
  ...require('ts-jest').createDefaultEsmPreset(),
  collectCoverage: true,
  collectCoverageFrom: ['**/*.{ts,tsx}', '!jest.config.{ts,tsx}', '!**/index.{ts,tsx}', '!**/*.d.{ts,tsx}'],
  coverageReporters: ['html', 'text', 'lcovonly'],
  passWithNoTests: false,
  testTimeout: 30000,
  rootDir: '.',
  testPathIgnorePatterns: ['.d.ts', '.js'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
}
