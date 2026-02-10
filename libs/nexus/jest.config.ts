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
  coverageDirectory: '../../coverage/libs/nexus',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'src/types/action.ts',
    'src/types/broker.ts',
    'src/types/channel.ts',
    'src/types/contract.ts',
    'src/types/events.ts',
    'src/types/message.ts',
    'src/types/validation.ts',
    'src/broker/types.ts',
    'src/channel/types.ts',
    'src/constants/event-types.ts',
    'src/singleton.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 92,
      functions: 96,
      lines: 96,
      statements: 96,
    },
  },
  projects: [
    {
      displayName: 'nexus/node',
      preset: '../../jest.preset.cjs',
      moduleFileExtensions: ['ts', 'js', 'html'],
      testEnvironment: 'node',
      testMatch: ['**/*.spec.ts'],
      testPathIgnorePatterns: ['^.*browser\\.spec\\.ts$'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
    {
      displayName: 'nexus/browser',
      preset: '../../jest.preset.cjs',
      moduleFileExtensions: ['ts', 'js', 'html'],
      testEnvironment: 'jsdom',
      testMatch: ['**/*.browser.spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts', '<rootDir>/jest.setup.browser.ts'],
    },
  ],
}
