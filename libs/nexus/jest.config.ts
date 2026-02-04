import type { Config } from 'jest'

export default <Config>{
  displayName: 'nexus',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/nexus',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup-after-env.ts'],
  transform: {
    '^.+\\.ts$': ['<rootDir>/jest.transformer.js', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
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
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
}
