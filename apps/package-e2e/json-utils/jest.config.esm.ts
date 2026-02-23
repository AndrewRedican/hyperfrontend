import type { Config } from 'jest'

const config: Config = {
  displayName: 'e2e-lib-json-utils-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|mjs)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        useESM: true,
      },
    ],
  },
  transformIgnorePatterns: [
    // Transform @hyperfrontend packages since they use ESM
    'node_modules/(?!@hyperfrontend/)',
  ],
  testMatch: ['<rootDir>/src/esm.spec.ts'],
}

export default config
