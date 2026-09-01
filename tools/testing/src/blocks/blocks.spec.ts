import assert from 'node:assert/strict'
import { describe as nodeDescribe, it as nodeIt } from 'node:test'
import { describe, it } from './blocks'

nodeDescribe('it wrapper', () => {
  it('runs a body that takes no parameters', () => {
    assert.equal(1, 1)
  })

  it('awaits an async body', async () => {
    await Promise.resolve()
    assert.equal(1, 1)
  })

  it('completes a body written in the done-callback style', (done) => {
    setTimeout(() => done(), 0)
  })

  it.skip('never runs a skipped body', () => {
    assert.fail('a skipped test must not run')
  })

  it.todo('records pending work')

  it.skip('skips without a body')

  it.failing('passes because the body fails', () => {
    assert.fail('deliberate')
  })

  it.only('runs when marked as the only test outside an only run', () => {
    assert.equal(1, 1)
  })

  it.concurrent('runs concurrently with its siblings', () => {
    assert.equal(1, 1)
  })

  it('honours a per-test timeout longer than the body needs', async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }, 5000)

  it.only('threads a timeout through the only modifier', async () => {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }, 5000)

  it.concurrent(
    'threads a timeout through the concurrent modifier',
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
    },
    5000
  )
})

nodeDescribe('it.each', () => {
  const seen: number[] = []

  it.each([1, 2, 3])('records %d', (value: number) => {
    seen.push(value)
  })

  nodeIt('ran once per row', () => {
    assert.deepEqual(seen.sort(), [1, 2, 3])
  })

  it.each([
    [1, 2, 3],
    [4, 5, 9],
  ])('adds %d and %d to make %d', (left: number, right: number, total: number) => {
    assert.equal(left + right, total)
  })

  it.each([10, 20])(
    'threads a timeout through to row %d',
    async (value: number) => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      assert.equal(value % 10, 0)
    },
    5000
  )
})

describe('describe wrapper', () => {
  it('nests tests inside the suite', () => {
    assert.equal(1, 1)
  })
})

describe.skip('describe.skip', () => {
  it('never runs', () => {
    assert.fail('a skipped suite must not run')
  })
})

describe.skip('describe.skip without a body')

describe.only('describe.only outside an only run behaves like a plain suite', () => {
  it('still registers its tests', () => {
    assert.equal(1, 1)
  })
})

describe.each(['alpha', 'beta'])('describe.each for %s', (name: string) => {
  it('receives the row value', () => {
    assert.equal(typeof name, 'string')
  })
})
