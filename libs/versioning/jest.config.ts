import type { Config } from 'jest'

export default {
  displayName: 'versioning',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/versioning',
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['registry/models/registry.ts', 'registry/npm/client.ts', 'registry/factory.ts', '__test-utils__'],
  coverageThreshold: {
    global: {
      branches: 92,
      functions: 98,
      lines: 97,
      statements: 97,
    },
  },
} as Config
