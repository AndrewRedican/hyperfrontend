import type { Config } from 'jest'

export default <Config>{
  displayName: 'eslint-rules',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/tools/eslint-rules',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 89,
      functions: 99,
      lines: 96,
      statements: 96,
    },
  },
}
