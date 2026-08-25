import { describe, expect, it } from 'vitest'
import { removeBadges } from './content'

const BADGES = [
  '<p align="center">',
  '  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend"><img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg" alt="Coverage"></a>',
  '</p>',
].join('\n')

const HERO = [
  '<p align="center">',
  '  <img width="560" src="https://www.hyperfrontend.dev/media/koi-pond/hero.gif" alt="Eight framework apps in one scene">',
  '</p>',
].join('\n')

describe('removeBadges', () => {
  it('strips a centered paragraph of badges', () => {
    expect(removeBadges(`# Title\n\n${BADGES}\n\nProse.`)).not.toContain('codecov.io')
  })

  it('keeps a centered paragraph that carries a demo capture', () => {
    expect(removeBadges(`# Title\n\n${BADGES}\n\n${HERO}\n\nProse.`)).toContain('media/koi-pond/hero.gif')
  })

  it('strips a linked badge image on its own line', () => {
    expect(removeBadges('# Title\n\n[![Build](https://img.shields.io/x.svg)](https://example.com)\n\nProse.')).not.toContain(
      'img.shields.io'
    )
  })
})
