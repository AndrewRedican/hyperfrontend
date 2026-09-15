import type { Mark } from './banner'

/** A group of placeholders the repository root declared, drawn as a row of empty tiles. */
export interface RoadmapPlaceholderGroup {
  /** How many tiles the row has. */
  count: number
  /** What the row stands for, set beside it. */
  label: string
  /** The mark drawn faintly inside each tile, for a group whose package has one. */
  mark?: Mark
}

/** The moment the map was drawn: every slot the repository would later fill, stated on its first day. */
export interface RoadmapMap {
  /** The day, as `YYYY-MM-DD`. */
  date: string
  /** The small capitals over the cluster. */
  caption: string
  /** The line under the caption, naming the day. */
  note: string
  /** The rows of placeholders, top to bottom. */
  groups: readonly RoadmapPlaceholderGroup[]
}

/** A stretch of the year with one thing to say about it. */
export interface RoadmapSpan {
  /** First day, as `YYYY-MM-DD`. */
  from: string
  /** Last day, as `YYYY-MM-DD`. */
  to: string
  /** What happened along it. */
  label: string
}

/** One thing that shipped, hung from the line on the day it did. */
export interface RoadmapMilestone {
  /** The day, as `YYYY-MM-DD`. */
  date: string
  /** The day as a reader says it, such as `Jun 25`. */
  when: string
  /** What shipped. */
  label: string
  /** How far under the line the tile hangs, 1 for the nearest row; neighbours alternate so their labels clear each other. */
  depth: number
  /** The mark drawn inside the tile. */
  mark?: Mark
}

/** The repository's several first commits, drawn as faint stubs under the line. */
export interface RoadmapRoots {
  /** The days, as `YYYY-MM-DD`, one per root. */
  dates: readonly string[]
  /** What the stubs are. */
  label: string
  /** What is not known about them. */
  note: string
}

/** Everything a scene tells the roadmap stage. */
export interface RoadmapConfig {
  /** First day on the line, as `YYYY-MM-DD`. */
  axisStart: string
  /** Last day on the line, as `YYYY-MM-DD`. */
  axisEnd: string
  /** Month names along the line, one per month from the first, such as `Jan`. */
  months: readonly string[]
  /** The map, drawn above the line. */
  map: RoadmapMap
  /** The small capitals at the top right, over the months that shipped things. */
  roadCaption: string
  /** The line under that caption. */
  roadNote: string
  /** The stretch drawn as a band above the line. */
  span: RoadmapSpan
  /** What shipped, hung under the line. */
  milestones: readonly RoadmapMilestone[]
  /** The first commits, as stubs under the line. */
  roots: RoadmapRoots
}
