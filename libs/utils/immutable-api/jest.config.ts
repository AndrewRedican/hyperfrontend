import type { Config } from 'jest'

export default {
  displayName: 'immutable-api-utils',
  preset: '../../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/utils/immutable-api',
  testEnvironment: 'node',
} as Config
