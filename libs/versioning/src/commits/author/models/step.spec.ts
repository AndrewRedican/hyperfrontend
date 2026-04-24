import { cancelled, done, goto, StepStatus } from './step'

describe('done', () => {
  it('builds a done result', () => {
    expect(done()).toEqual({ status: StepStatus.Done })
  })
})

describe('cancelled', () => {
  it('builds a cancelled result without error when none is given', () => {
    expect(cancelled()).toEqual({ status: StepStatus.Cancelled })
  })

  it('attaches the error when supplied', () => {
    const error = new Error('boom')
    expect(cancelled(error)).toEqual({ status: StepStatus.Cancelled, error })
  })
})

describe('goto', () => {
  it('builds a goto result pointing at the supplied step id', () => {
    expect(goto('type')).toEqual({ status: StepStatus.Goto, gotoStepId: 'type' })
  })
})
