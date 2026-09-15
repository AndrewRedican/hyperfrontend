import { defineScriptedScene } from '../src/scene/define-scene'
import { seamStage } from '../src/seam/stage'
import { articleProfile } from './lib/article'
import { packageIdentity, workspaceIdentity } from './lib/identity'

/** The workspace's hue. */
const identity = workspaceIdentity()

/**
 * The runtime shape "The Long Way Around" asks a conference audience to
 * remember: a host, the shell it loads a feature through, and the hostee
 * running inside the boundary the shell draws.
 *
 * Four badges carry the four ideas and nothing else is annotated: the
 * shell loads at runtime, the boundary isolates, the channel carries a
 * typed and validated contract, and the hostee's own origin says it is
 * deployed on its own.
 */
export default defineScriptedScene({
  slug: 'long-way-host-shell-hostee',
  asset: 'figure',
  outputs: ['still'],
  profile: articleProfile(464),
  hue: identity.hue,
  stage: seamStage,
  stills: [{ name: 'figure', atMs: 0, format: 'webp', quality: 84, maxBytes: 140_000 }],
  config: {
    hostCaption: 'Host application',
    hostOrigin: 'https://app.example.com',
    shellLabel: 'feature shell',
    shellMark: packageIdentity('features').mark,
    boundaryCaption: 'Browsing context',
    hosteeCaption: 'Hostee application',
    hosteeOrigin: 'https://checkout.team-b.dev',
    channelLabel: 'contract messages',
    annotations: [
      { label: 'Runtime loading' },
      { label: 'Isolation boundary' },
      { label: 'Typed, validated contract' },
      { label: 'Independent deployment' },
    ],
  },
})
