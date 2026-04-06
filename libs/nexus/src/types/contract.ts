/** Describes an action that can be sent or received on a channel */
export interface IActionDescription {
  /** Unique identifier for the action type */
  type: string
  /** Human-readable description of the action */
  description?: string
  /** JSON schema for validating action payload */
  schema?: object
}

/** Contract defining the actions a channel can emit and accept */
export interface IChannelContract {
  /** Actions that can be emitted by this channel */
  emitted: IActionDescription[]
  /** Actions that can be accepted by this channel */
  accepted: IActionDescription[]
}
