import type { Server } from 'node:http'
import { createServer } from 'node:http'
import { describe, expect, it } from '@hyperfrontend/testing'
import { addressPort, closeServer, listen } from './listen'

interface FakeServer {
  server: Server
  listenCalls: unknown[][]
  closed: boolean
  errorHandlers: Array<(error: Error) => void>
}

const fakeServer = (port: number): FakeServer => {
  const state: FakeServer = { server: {} as Server, listenCalls: [], closed: false, errorHandlers: [] }
  state.server = {
    listen: (...args: unknown[]) => {
      state.listenCalls.push(args)
      const callback = args[args.length - 1] as () => void
      callback()
    },
    once: (_event: string, handler: (error: Error) => void) => state.errorHandlers.push(handler),
    removeListener: (_event: string, handler: (error: Error) => void) => {
      state.errorHandlers = state.errorHandlers.filter((registered) => registered !== handler)
    },
    address: () => ({ address: '::', family: 'IPv6', port }),
    close: (callback: () => void) => {
      state.closed = true
      callback()
    },
  } as unknown as Server
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

  it('stops listening for bind errors once the port is bound', async () => {
    const fake = fakeServer(4284)
    await listen(fake.server, 0)
    expect(fake.errorHandlers).toEqual([])
  })

  it('rejects with the bind error when the port is already taken', async () => {
    const taken = createServer(() => undefined)
    const port = await listen(taken, 0, '127.0.0.1')
    const rejection = await listen(
      createServer(() => undefined),
      port,
      '127.0.0.1'
    ).catch((error: unknown) => error)
    await closeServer(taken)
    expect(rejection).toEqual(expect.objectContaining({ code: 'EADDRINUSE' }))
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

  it('throws when the server reports no address', () => {
    expect(() => addressPort({ address: () => null } as unknown as Server)).toThrow('failed to report a listening port')
  })

  it('throws when the server is bound to a pipe rather than a port', () => {
    expect(() => addressPort({ address: () => '/tmp/hf.sock' } as unknown as Server)).toThrow('failed to report a listening port')
  })
})
