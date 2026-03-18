import type { Config } from 'jest'

export default <Config>{
  displayName: 'versioning',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/versioning',
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['registry/models/registry.ts', 'registry/npm/client.ts', 'registry/factory.ts'],
  coverageThreshold: {
    global: {
      branches: 93,
      functions: 99,
      lines: 98,
      statements: 98,
    },
  },
}
