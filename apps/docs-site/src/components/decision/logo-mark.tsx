/** Props for {@link LogoMark}. */
export interface LogoMarkProps {
  /** Stable id of the thing being marked, used to derive a consistent hue. */
  id: string
  /** Display name the monogram is taken from. */
  name: string
  /** Pixel size of the square mark. */
  size?: number
}

/**
 * Derives a stable hue from an id so a project keeps the same mark colour
 * across renders and reloads.
 * @param id - The stable id to hash.
 * @returns A hue in degrees.
 */
function hueFor(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) % 360
  return hash
}

/**
 * Reduces a project name to one or two letters for the mark.
 * @param name - The display name.
 * @returns The monogram text.
 */
function monogramFor(name: string): string {
  const words = name
    .replace(/[()]/g, '')
    .split(/[\s.-]+/)
    .filter((word) => /^[A-Za-z0-9]/.test(word))
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2)
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * A generated identity mark for a project in the implementation catalogue.
 *
 * These are monograms rather than official brand logos on purpose: the page is
 * statically exported and makes no third-party requests, so hotlinking vendor
 * assets would both leak reader traffic and reuse marks we have no licence to
 * redistribute. The colour derives from the project id, so a project looks the
 * same everywhere it appears.
 * @param props - See {@link LogoMarkProps}.
 * @param props.id
 * @param props.name
 * @param props.size
 * @returns The mark.
 * @example
 * ```tsx
 * <LogoMark id="impl.podium" name="Podium" />
 * ```
 */
export function LogoMark({ id, name, size = 32 }: LogoMarkProps) {
  const hue = hueFor(id)
  const text = monogramFor(name)
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-lg font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        color: `hsl(${hue} 70% 30%)`,
        background: `linear-gradient(140deg, hsl(${hue} 75% 88%), hsl(${(hue + 40) % 360} 75% 80%))`,
        border: `1px solid hsl(${hue} 45% 72%)`,
      }}
    >
      {text}
    </span>
  )
}
