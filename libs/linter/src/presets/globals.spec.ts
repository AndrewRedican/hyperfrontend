import { describe, expect, it } from '@hyperfrontend/testing'
import { BROWSER_AND_NODE_GLOBALS } from './globals'

describe('BROWSER_AND_NODE_GLOBALS', () => {
  it('holds the window, Node and shared globals, each read-only', () => {
    expect([BROWSER_AND_NODE_GLOBALS['window'], BROWSER_AND_NODE_GLOBALS['process'], BROWSER_AND_NODE_GLOBALS['fetch']]).toEqual([
      'readonly',
      'readonly',
      'readonly',
    ])
  })

  it('leaves out the names the language defines', () => {
    expect(BROWSER_AND_NODE_GLOBALS['Array']).toBeUndefined()
  })
})
