import { sleep } from './sleep'

describe('sleep', () => {
  it('resolves promise once time has passed (sequential wait times)', async () => {
    let total = 0
    const increment = () => (total += 1)
    const decrement = () => (total -= 1)
    await sleep(100)
    increment()
    await sleep(100)
    decrement()
    await sleep(100)
    increment()
    await sleep(100)
    decrement()
    expect(total).toEqual(0)
  })

  // eslint-disable-next-line jest/no-done-callback
  it('resolves promise once time has passed (concurrent wait times)', (done) => {
    let total = 0
    const increment = () => (total += 1)
    const decrement = () => (total -= 1)
    sleep(100).then(increment)
    sleep(200).then(decrement)
    sleep(300).then(increment)
    sleep(400).then(decrement)
    sleep(500).then(() => {
      expect(total).toEqual(0)
      done()
    })
  })
})
