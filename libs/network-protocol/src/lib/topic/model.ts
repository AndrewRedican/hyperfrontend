export interface Topic {
  readonly name: string
  readonly id: string
}

export interface TopicStore {
  readonly create: (...name: string[]) => void
  readonly add: (...topic: Topic[]) => void
  readonly existsByName: (name: string) => boolean
  readonly existsById: (id: string) => boolean
  readonly removeByName: (...name: string[]) => void
  readonly removeById: (...id: string[]) => void
  readonly clear: () => void
  readonly getByName: (name: string) => Topic | null
  readonly getById: (id: string) => Topic | null
  readonly list: readonly Topic[]
}
