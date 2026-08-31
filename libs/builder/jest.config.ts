import type { Config } from 'jest'

export default {
  preset: '../../jest.preset.cjs',
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!jest.config.{ts,tsx}',
    '!**/index.{ts,tsx}',
    '!**/*.d.{ts,tsx}',
    '!**/*.spec.ts',
    '!**/jest.setup*.ts',
  ],
  coverageDirectory: '../../coverage/libs/builder',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'src/models/',
    '\\.types\\.ts$',
    'src/package/licenses/types\\.ts$',
    'src/bundle/dependencies/worker/index\\.ts$',
    'src/bundle/dependencies/worker/job-runner\\.ts$',
    'src/bundle/rollup/worker/index\\.ts$',
    'src/bundle/rollup/worker/job-runner\\.ts$',
    'src/bundle/rollup/worker/types\\.ts$',
    'src/bin/native/worker/index\\.ts$',
    'src/bin/native/worker/job-runner\\.ts$',
    'src/bin/native/worker/types\\.ts$',
  ],
  coverageThreshold: {
    global: {
      branches: 96,
      functions: 98,
      lines: 99,
      statements: 99,
    },
  },
  displayName: 'builder',
  moduleFileExtensions: ['ts', 'js', 'html'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
} as Config
