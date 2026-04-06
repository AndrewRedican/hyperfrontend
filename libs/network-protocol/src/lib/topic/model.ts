/** Represents a named topic with a unique identifier */
export interface Topic {
  /** Human-readable topic name */
  readonly name: string
  /** Unique identifier for this topic */
  readonly id: string
}

/** Store for managing topics with lookup by name or ID */
export interface TopicStore {
  /** Creates new topics by name */
  readonly create: (...name: string[]) => void
  /** Adds existing topic objects */
  readonly add: (...topic: Topic[]) => void
  /** Checks if a topic exists by name */
  readonly existsByName: (name: string) => boolean
  /** Checks if a topic exists by ID */
  readonly existsById: (id: string) => boolean
  /** Removes topics by name */
  readonly removeByName: (...name: string[]) => void
  /** Removes topics by ID */
  readonly removeById: (...id: string[]) => void
  /** Removes all topics */
  readonly clear: () => void
  /** Retrieves a topic by name */
  readonly getByName: (name: string) => Topic | null
  /** Retrieves a topic by ID */
  readonly getById: (id: string) => Topic | null
  /** List of all registered topics */
  readonly list: readonly Topic[]
}
