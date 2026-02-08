export interface Location {
  path: [string, ...string[]]
}

export interface Target {
  path: string[]
}

export interface ICircularReference {
  readonly location: Location
  readonly target: Target
  readonly depth: number
}

export class CircularReference implements ICircularReference {
  public readonly location: Location
  public readonly target: Target
  public readonly keyDelimiter = '\u00B7' // Middle dot
  private readonly delimiter = ' \u2192 ' // Right arrow

  constructor(location: Location['path'], target: Target['path']) {
    if (!Array.isArray(location) || location.length === 0) {
      throw new Error(`Expected location to be a list with at list one string value.`)
    }
    if (!Array.isArray(target)) {
      throw new Error(`Expected target to be a list.`)
    }
    this.location = { path: location }
    this.target = { path: target }
  }

  get depth(): number {
    return this.location.path.length - this.target.path.length
  }

  public readonly toString = (): string => `${this.join(this.location)}${this.delimiter}${this.join(this.target)}`

  public readonly toJSON = (): string => this.toString()

  private readonly join = ({ path }: Location | Target): string => path.join(this.keyDelimiter)
}
