export interface IActionDescription {
  type: string
  description?: string
  schema?: object
}

export interface IChannelContract {
  emitted: IActionDescription[]
  accepted: IActionDescription[]
}
