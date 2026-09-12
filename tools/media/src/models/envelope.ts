import type { Mark } from './banner'

/** The two package calls the frame names. */
export interface EnvelopeApi {
  /** The call that seals a secret, named top left from the first frame. */
  encrypt: string
  /** The call that opens a sealed one, named top right once a key is on its way. */
  decrypt: string
  /** The package's mark, drawn beside both names. */
  mark: Mark
}

/** One run of random material the call writes around the secret. */
export interface EnvelopeSegment {
  /** What the run is called under the strip, such as `salt`. */
  name: string
  /** How many bytes the run is, which is how many blocks are drawn for it. */
  bytes: number
}

/** Everything a scene tells the envelope stage. */
export interface EnvelopeConfig {
  /** The calls whose behaviour the sealing and unsealing shows. */
  api: EnvelopeApi
  /** The plaintext, one character per cell; the cipher is the same length. */
  secret: string
  /** The random run written before everything else. */
  salt: EnvelopeSegment
  /** The random run written between the salt and the cipher. */
  iv: EnvelopeSegment
  /** The run written last, the one the lock hangs off. */
  tag: EnvelopeSegment
  /** What the scrambled cells are called under the strip, such as `ciphertext`. */
  cipherName: string
  /** How long the plain secret is shown before the first call seals it. */
  plainMs?: number
  /** How long the frame holds after the wrong key is refused. */
  restMs?: number
}
