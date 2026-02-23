import type { Config } from 'jest'

const config: Config = {
  displayName: 'e2e-lib-random-generator-utils-browser',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['<rootDir>/src/iife.spec.ts', '<rootDir>/src/umd.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default config
