/** What one panel says about itself. */
export interface NegotiationPanel {
  /** The small capitals at the panel's top left. */
  caption: string
  /** The line after the caption, saying what the panel shows. */
  note: string
}

/** One stop on the evolution strip under the panels. */
export interface NegotiationStop {
  /** The stop's name, set in the mono face. */
  label: string
  /** The line under it. */
  note: string
}

/** Everything a scene tells the negotiation stage. */
export interface NegotiationConfig {
  /** The panel in which the channel activates itself. */
  before: NegotiationPanel
  /** The panel in which the channel waits for a handshake. */
  after: NegotiationPanel
  /** The label on the host's card. */
  host: string
  /** The label on the hostee's card. */
  hostee: string
  /** What the hostee's state reads while it is still starting. */
  booting: string
  /** What a peer's state reads once it is up. */
  ready: string
  /** What the host's state reads while its greeting is unanswered. */
  waiting: string
  /** The label on the lost message's mark. */
  lost: string
  /** The label on the session badge once the handshake completes. */
  session: string
  /** The small capitals over the strip. */
  stripCaption: string
  /** The stops on the strip, left to right. */
  stops: readonly NegotiationStop[]
}
