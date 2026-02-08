// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Callback = (...args: any[]) => void

export type Unsubscribe = () => void

export interface Callstack<T extends Callback = Callback> {
  size: number
  add: (...callbacks: T[]) => Unsubscribe
  call: (remove: boolean, ...args: unknown[]) => void
  clear: () => void
}
