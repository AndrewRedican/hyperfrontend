import type { State } from '../models'

export const createInitialState = (): State => ({
  inProgress: false,
  success: false,
  fail: false,
  halt: false,
})
