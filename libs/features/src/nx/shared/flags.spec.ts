import { headlessFlags } from './flags'

describe('headlessFlags', () => {
  it('sets the headless toggles and forwards overrides', () => {
    expect(headlessFlags({ name: 'clock', port: '4200' })).toEqual({
      ci: true,
      yes: false,
      dryRun: false,
      help: false,
      name: 'clock',
      port: '4200',
    })
  })
})
