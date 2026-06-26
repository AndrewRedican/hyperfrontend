import { EXIT_CANCELLED, EXIT_ERROR, EXIT_OK } from './exit-codes'

describe('exit codes', () => {
  it('maps each outcome to its conventional process code', () => {
    expect({ EXIT_OK, EXIT_ERROR, EXIT_CANCELLED }).toEqual({ EXIT_OK: 0, EXIT_ERROR: 1, EXIT_CANCELLED: 130 })
  })
})
