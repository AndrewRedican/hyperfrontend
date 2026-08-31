import type { Config } from 'jest'

export default {
  displayName: 'json-utils',
  preset: '../../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/utils/json',
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/src/types/'],
} as Config
