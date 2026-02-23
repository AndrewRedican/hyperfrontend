import type { Config } from 'jest'

const config: Config = {
  displayName: 'e2e-lib-function-utils-cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['<rootDir>/src/cjs.spec.ts'],
  moduleNameMapper: {},
}

export default config
