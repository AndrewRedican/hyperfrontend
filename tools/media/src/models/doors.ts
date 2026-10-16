/** Something that imports the package, drawn as a card on the left. */
export interface DoorsCaller {
  /** The small capitals over the card. */
  caption: string
  /** The import, set in the mono face. */
  code: string
}

/** One condition in the package's `exports` map, drawn as a door on the right. */
export interface DoorsEntry {
  /** The condition, set in the mono face, such as `"require"`. */
  condition: string
  /** The file the condition points at. */
  file: string
}

/** Everything a scene tells the doors stage. */
export interface DoorsConfig {
  /** The suite that says it tests the ESM build. */
  suite: DoorsCaller
  /** A consumer that really loads the ESM build. */
  consumer: DoorsCaller
  /** The name on the transform the suite runs through. */
  transform: string
  /** The label at the head of the package, set in the mono face. */
  packageLabel: string
  /** The door that works, which the transform sends the suite through. */
  working: DoorsEntry
  /** The door that is broken, which only the consumer reaches. */
  broken: DoorsEntry
}
