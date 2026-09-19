import { anatomyStage } from '../src/anatomy/stage'
import { defineScriptedScene } from '../src/scene/define-scene'
import { packageIdentity, workspaceIdentity } from './lib/identity'
import { readmeProfile } from './lib/readme'

/** The workspace's hue. */
const identity = workspaceIdentity()

/**
 * The repository readme's architecture figure: the runtime seam between a
 * host and a hostee, and the packages the channel between them runs on.
 *
 * Replaces a flowchart. The top half is the shape a reader has to remember,
 * a host, the shell it loads a feature through, and the hostee inside the
 * boundary the shell draws, numbered with the four ideas the legend names.
 * The bottom half exposes the channel as a cross-section: `features` is the
 * layer a host and a feature touch, `nexus` the session underneath it,
 * `network-protocol` the sealed envelope under that, and `cryptography` the
 * core. Verified against the library stack in `ARCHITECTURE.md`.
 *
 * Recorded in the portable theme only, for the readme on GitHub.
 */
export default defineScriptedScene({
  slug: 'readme-anatomy',
  asset: 'figure',
  outputs: ['still'],
  profile: readmeProfile(624),
  themes: ['portable'],
  hue: identity.hue,
  stage: anatomyStage,
  stills: [{ name: 'figure', atMs: 0, format: 'png', quality: 90, maxBytes: 220_000 }],
  config: {
    hostCaption: 'Host application',
    hostOrigin: 'https://app.example.com',
    shellLabel: 'feature shell',
    shellMark: packageIdentity('features').mark,
    boundaryCaption: 'Browsing context',
    hosteeCaption: 'Feature application',
    hosteeOrigin: 'https://checkout.team-b.dev',
    channelLabel: 'contract messages',
    layers: [
      { name: 'features', mark: packageIdentity('features').mark, note: 'shell, display modes, session lifecycle' },
      { name: 'nexus', mark: packageIdentity('nexus').mark, note: 'handshake, contract, heartbeat' },
      { name: 'network-protocol', mark: packageIdentity('network-protocol').mark, note: 'sealed session envelope' },
      { name: 'cryptography', mark: packageIdentity('cryptography').mark, note: 'AES-GCM, ECDH, HKDF' },
    ],
    annotations: ['Runtime loading', 'Isolation boundary', 'Typed, validated contract', 'Independent deployment'],
  },
})
