import type { Config } from 'jest'

const config: Config = {
  displayName: 'e2e-lib-features-nx',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['<rootDir>/src/nx-plugin.spec.ts', '<rootDir>/src/nx-plugin-callbacks.spec.ts'],
  moduleNameMapper: {},
}

export default config
