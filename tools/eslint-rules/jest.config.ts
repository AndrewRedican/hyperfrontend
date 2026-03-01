import type { Config } from 'jest'

export default <Config>{
  displayName: 'eslint-rules',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/tools/eslint-rules',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 98,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
}
