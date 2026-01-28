import type { Config } from 'jest'

export default <Config>{
  displayName: 'state-machine',
  preset: '../../jest.preset.cjs',
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/state-machine',
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/', '\\.model\\.ts$', '\\.types\\.ts$'],
  coverageProvider: 'v8',
}
