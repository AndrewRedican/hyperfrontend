import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { restoreAllMocks } from './registry'
import { replaceProperty, stubEnv, stubGlobal } from './replace'

describe('replaceProperty', () => {
  afterEach(() => restoreAllMocks())

  it('gives an own data property the replacement value', () => {
    const settings = { mode: 'light' }
    replaceProperty(settings, 'mode', 'dark')
    assert.equal(settings.mode, 'dark')
  })

  it('puts an own data property back on restore', () => {
    const settings = { mode: 'light' }
    replaceProperty(settings, 'mode', 'dark').restore()
    assert.deepEqual(Object.getOwnPropertyDescriptor(settings, 'mode'), {
      value: 'light',
      writable: true,
      enumerable: true,
      configurable: true,
    })
  })

  it('changes the value again through replaceValue', () => {
    const settings = { mode: 'light' }
    replaceProperty(settings, 'mode', 'dark').replaceValue('dim')
    assert.equal(settings.mode, 'dim')
  })

  it('returns the same handle from replaceValue so calls chain', () => {
    const replaced = replaceProperty({ mode: 'light' }, 'mode', 'dark')
    assert.equal(replaced.replaceValue('dim'), replaced)
  })

  it('shadows an inherited accessor with an own value', () => {
    const navigatorLike = Object.create({
      get userAgent() {
        return 'jsdom'
      },
    }) as { userAgent: string }
    replaceProperty(navigatorLike, 'userAgent', 'Firefox')
    assert.equal(navigatorLike.userAgent, 'Firefox')
  })

  it('removes the shadow of an inherited property on restore', () => {
    const navigatorLike = Object.create({ userAgent: 'jsdom' }) as { userAgent: string }
    replaceProperty(navigatorLike, 'userAgent', 'Firefox').restore()
    assert.equal(Object.hasOwn(navigatorLike, 'userAgent'), false)
  })

  it('puts an own accessor back on restore', () => {
    const owner = {
      get size() {
        return 1
      },
    }
    const getter = Object.getOwnPropertyDescriptor(owner, 'size')?.get
    replaceProperty(owner, 'size', 2).restore()
    assert.equal(Object.getOwnPropertyDescriptor(owner, 'size')?.get, getter)
  })

  it('replaces process.platform for the length of a test', () => {
    const real = process.platform
    replaceProperty(process, 'platform', real === 'win32' ? 'linux' : 'win32')
    assert.notEqual(process.platform, real)
  })

  it('assigns a writable property that cannot be redefined', () => {
    const sealed = Object.seal({ count: 1 })
    replaceProperty(sealed, 'count', 2)
    assert.equal(sealed.count, 2)
  })

  it('assigns the original back to a writable property that cannot be redefined', () => {
    const sealed = Object.seal({ count: 1 })
    replaceProperty(sealed, 'count', 2).restore()
    assert.equal(sealed.count, 1)
  })

  it('refuses a property that does not exist', () => {
    assert.throws(() => replaceProperty({} as { missing?: number }, 'missing', 1), /does not exist/)
  })

  it('refuses a property that is neither configurable nor writable', () => {
    assert.throws(() => replaceProperty(Object.freeze({ fixed: 1 as number }), 'fixed', 2), /neither configurable nor writable/)
  })

  it('restores only once when restored by hand and then by restoreAllMocks', () => {
    const settings = { mode: 'light' }
    const replaced = replaceProperty(settings, 'mode', 'dark')
    replaced.restore()
    settings.mode = 'set by the test'
    restoreAllMocks()
    assert.equal(settings.mode, 'set by the test')
  })

  it('undoes stacked replacements newest first, leaving the original', () => {
    const settings = { mode: 'light' }
    replaceProperty(settings, 'mode', 'dark')
    replaceProperty(settings, 'mode', 'dim')
    restoreAllMocks()
    assert.equal(settings.mode, 'light')
  })
})

describe('stubEnv', () => {
  afterEach(() => restoreAllMocks())

  it('sets a variable', () => {
    stubEnv('HF_SPEC_STUB', 'on')
    assert.equal(process.env['HF_SPEC_STUB'], 'on')
  })

  it('removes a variable given undefined', () => {
    process.env['HF_SPEC_STUB_SHELL'] = 'present'
    stubEnv('HF_SPEC_STUB_SHELL', undefined)
    const present = Object.hasOwn(process.env, 'HF_SPEC_STUB_SHELL')
    restoreAllMocks()
    delete process.env['HF_SPEC_STUB_SHELL']
    assert.equal(present, false)
  })

  it('removes a variable that did not exist on restore', () => {
    stubEnv('HF_SPEC_STUB', 'on')
    restoreAllMocks()
    assert.equal(Object.hasOwn(process.env, 'HF_SPEC_STUB'), false)
  })

  it('puts a variable that existed back on restore', () => {
    process.env['HF_SPEC_STUB_SHELL'] = 'shell'
    stubEnv('HF_SPEC_STUB_SHELL', undefined)
    restoreAllMocks()
    const restored = process.env['HF_SPEC_STUB_SHELL']
    delete process.env['HF_SPEC_STUB_SHELL']
    assert.equal(restored, 'shell')
  })
})

describe('stubGlobal', () => {
  afterEach(() => restoreAllMocks())

  it('defines a global that did not exist', () => {
    stubGlobal('hfSpecGlobal', 42)
    assert.equal((globalThis as Record<string, unknown>)['hfSpecGlobal'], 42)
  })

  it('removes a global that did not exist on restore', () => {
    stubGlobal('hfSpecGlobal', 42)
    restoreAllMocks()
    assert.equal(Object.hasOwn(globalThis, 'hfSpecGlobal'), false)
  })

  it('replaces a global that existed', () => {
    const fake = class FakeUrl {}
    stubGlobal('URL', fake)
    const seen = globalThis.URL as unknown
    restoreAllMocks()
    assert.equal(seen, fake)
  })

  it('puts a global that existed back on restore', () => {
    const real = globalThis.URL
    stubGlobal('URL', class FakeUrl {})
    restoreAllMocks()
    assert.equal(globalThis.URL, real)
  })
})
