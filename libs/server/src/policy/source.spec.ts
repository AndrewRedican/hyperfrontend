import { describe, expect, it } from '@hyperfrontend/testing'
import { classifyHostSource, permitsEveryOrigin } from './source'

describe('classifyHostSource', () => {
  it.each([
    ['https://host.example'],
    ['https://host.example:8443'],
    ['https://host.example:1'],
    ['https://host.example:65535'],
    ['https://host.example:*'],
    ['https://*.host.example'],
    ['https://*.host.example:*'],
    ['http://localhost'],
    ['http://127.0.0.1:5173'],
    ['tauri://localhost'],
    ['coap+tcp://host.example'],
    ['https://xn--bcher-kva.example'],
    ['https://-host-.example'],
  ])('accepts %s', (source: string) => {
    expect(classifyHostSource(source)).toBe('ok')
  })

  it.each([
    ['*', 'permits-every-origin'],
    ['https:', 'permits-every-origin'],
    ['https://*', 'permits-every-origin'],
    ['https://*:443', 'permits-every-origin'],
    ['https://*/app', 'permits-every-origin'],
    ['*:443', 'permits-every-origin'],
    ['host.example', 'scheme-missing'],
    ['*.host.example', 'scheme-missing'],
    ['localhost:3000', 'scheme-missing'],
    ['//host.example', 'scheme-missing'],
    ['https://host.example/', 'has-path'],
    ['https://host.example/app', 'has-path'],
    ['https://host.example?x=1', 'has-path'],
    ['https://host.example#top', 'has-path'],
    ['https://host.example:8443/app', 'has-path'],
    ['https://host.example:0', 'port-invalid'],
    ['https://host.example:65536', 'port-invalid'],
    ['https://host.example:080', 'port-invalid'],
    ['https://host.example:', 'port-invalid'],
    ['https://host.example:80:80', 'port-invalid'],
    ['https://host.example:http', 'port-invalid'],
    ['https://*.app:0', 'port-invalid'],
    ['https://*.app', 'wildcard-too-broad'],
    ['http://*.localhost:3000', 'wildcard-too-broad'],
    ['https://a.*.example', 'malformed'],
    ['https://*host.example', 'malformed'],
    ['https://*.', 'malformed'],
    ['https://under_score.example', 'malformed'],
    ['https://host.example.', 'malformed'],
    ['https://host..example', 'malformed'],
    ['https://[::1]:3000', 'malformed'],
    ['https://user@host.example', 'malformed'],
    ['https://', 'malformed'],
    ['https://:8443', 'malformed'],
    ['1https://host.example', 'malformed'],
    ['://host.example', 'malformed'],
    ['HTTPS://host.example', 'malformed'],
    ['https://Host.example', 'malformed'],
    ['https://host.example\n', 'malformed'],
    ['https://bücher.example', 'malformed'],
  ])('classifies %p as %s', (source: string, verdict: string) => {
    expect(classifyHostSource(source)).toBe(verdict)
  })
})

describe('permitsEveryOrigin', () => {
  it.each([['*'], ['https:'], ['HTTPS:'], ['https://*'], ['HTTPS://*'], ['*:443'], ['https://*:*'], ['http://*/path'], ['wss:']])(
    'holds for %s',
    (source: string) => {
      expect(permitsEveryOrigin(source)).toBe(true)
    }
  )

  it.each([
    ['https://*.vercel.app'],
    ["'self'"],
    ["'none'"],
    ['https://a.example'],
    ['a.example'],
    ['*.a.example'],
    ['https://a.example/*'],
    [''],
  ])('does not hold for %p', (source: string) => {
    expect(permitsEveryOrigin(source)).toBe(false)
  })
})
