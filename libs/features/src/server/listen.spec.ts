import type { Server } from 'node:http'
import { addressPort, closeServer, listen } from './listen'

interface FakeServer {
  server: Server
  listenCalls: unknown[][]
  closed: boolean
}

const fakeServer = (port: number): FakeServer => {
  const state: FakeServer = { server: <Server>{}, listenCalls: [], closed: false }
  state.server = <Server>(<unknown>{
    listen: (...args: unknown[]) => {
      state.listenCalls.push(args)
      const callback = <() => void>args[args.length - 1]
      callback()
    },
    address: () => ({ address: '::', family: 'IPv6', port }),
    close: (callback: () => void) => {
      state.closed = true
      callback()
    },
  })
  return state
}

describe('listen', () => {
  it('listens with the two-argument form when no host is given', async () => {
    const fake = fakeServer(4284)
    const port = await listen(fake.server, 0)
    expect({ port, args: fake.listenCalls[0]?.slice(0, -1) }).toEqual({ port: 4284, args: [0] })
  })

  it('passes the host through in the three-argument form', async () => {
    const fake = fakeServer(8080)
    const port = await listen(fake.server, 8080, '127.0.0.1')
    expect({ port, args: fake.listenCalls[0]?.slice(0, -1) }).toEqual({ port: 8080, args: [8080, '127.0.0.1'] })
  })
})

describe('closeServer', () => {
  it('resolves once the close callback fires', async () => {
    const fake = fakeServer(1)
    await expect(closeServer(fake.server)).resolves.toBeUndefined()
    expect(fake.closed).toBe(true)
  })
})

describe('addressPort', () => {
  it('returns the port from the server address', () => {
    expect(addressPort(fakeServer(4321).server)).toBe(4321)
  })
})
