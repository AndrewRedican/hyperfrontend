import type { Config } from 'jest'

export default <Config>{
  displayName: 'window-messages',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/window-messages',
  testEnvironment: 'jsdom',
}
