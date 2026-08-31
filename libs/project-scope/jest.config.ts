import type { Config } from 'jest'

export default {
  displayName: 'project-scope',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/project-scope',
  coveragePathIgnorePatterns: ['<rootDir>/__fixtures__/'],
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 93,
      functions: 98,
      lines: 98,
      statements: 98,
    },
  },
} as Config
