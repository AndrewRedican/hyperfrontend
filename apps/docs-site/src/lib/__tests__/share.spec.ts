import { describe, expect, it } from 'vitest'
import { buildShareDescriptor, buildShareTargets, SITE_ONE_LINER } from '../share'

describe('buildShareDescriptor', () => {
  it('builds the canonical absolute URL with a trailing slash', () => {
    expect(buildShareDescriptor('/docs/guides/example', 'Example').url).toBe('https://hyperfrontend.dev/docs/guides/example/')
  })

  it('does not double a trailing slash the caller already provided', () => {
    expect(buildShareDescriptor('/articles/example/', 'Example').url).toBe('https://hyperfrontend.dev/articles/example/')
  })

  it('composes the text as positioning line, page line, then URL', () => {
    const descriptor = buildShareDescriptor('/articles/example/', 'Example', 'Why example matters.')
    expect(descriptor.text.split('\n')).toEqual([SITE_ONE_LINER, 'Why example matters.', descriptor.url])
  })

  it('falls back to the title when no page line is given', () => {
    expect(buildShareDescriptor('/articles/example/', 'Example').text.split('\n')[1]).toBe('Example')
  })
})

describe('buildShareTargets', () => {
  const descriptor = buildShareDescriptor('/docs/guides/a b/', 'A & B', 'Line with spaces & symbols')
  const targets = buildShareTargets(descriptor)

  it('offers LinkedIn, X, and WhatsApp in that order', () => {
    expect(targets.map((target) => target.id)).toEqual(['linkedin', 'x', 'whatsapp'])
  })

  it('gives LinkedIn only the encoded canonical URL', () => {
    expect(targets[0].href).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(descriptor.url)}`)
  })

  it('encodes the composed text for X and WhatsApp', () => {
    expect(targets.slice(1).map((target) => target.href)).toEqual([
      `https://x.com/intent/post?text=${encodeURIComponent(descriptor.text)}`,
      `https://wa.me/?text=${encodeURIComponent(descriptor.text)}`,
    ])
  })

  it('produces hrefs without raw spaces or ampersands from page content', () => {
    expect(targets.every((target) => !target.href.includes(' ') && !target.href.split('?')[1].includes('&'))).toBe(true)
  })
})
