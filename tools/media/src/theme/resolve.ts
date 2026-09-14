import type { MediaTheme, ThemeId, ThemeOverride, ThemeOverrides } from '../models/theme'
import { builtInTheme } from './themes'

/**
 * Retint the tokens that carry a scene's hue.
 *
 * The documentation site tints the atmosphere behind each package's pages with
 * a hue of that package's own, so a scene handed the same hue takes it in the
 * same place: the ground, and nothing that has to be read. Saturation and
 * lightness are the theme's; the scene decides only where on the wheel it sits,
 * which is the smallest say a colour can have without making anything harder
 * to read.
 *
 * @param theme - The theme being tinted.
 * @param hue - A hue in degrees.
 * @returns The tokens that change, ready to be spread over the theme.
 */
function tint(theme: MediaTheme, hue: number): ThemeOverride {
  if (theme.id === 'dark') {
    return {
      backdrop: `radial-gradient(120% 130% at 50% -10%, hsl(${hue} 44% 17%) 0%, #0b1220 58%, #070b14 100%)`,
    }
  }
  if (theme.id === 'light') {
    // why: the same composition as the dark ground, a wash of the hue at the top thinning into the page, read in daylight: pale rather than deep, and never so strong that a chip or a rule sitting on it loses contrast
    return {
      backdrop: `radial-gradient(120% 130% at 50% -10%, hsl(${hue} 58% 91%) 0%, hsl(${hue} 45% 96%) 58%, hsl(${hue} 30% 98%) 100%)`,
    }
  }
  // why: a portable plate must not read as belonging to any page, so the hue is barely there: enough to tell two packages apart side by side, not enough to clash with a page of its own colour
  return {
    plate: `radial-gradient(120% 130% at 50% -10%, hsl(${hue} 18% 17%) 0%, hsl(${hue} 9% 12%) 58%, hsl(${hue} 9% 10%) 100%)`,
    plateBorder: `hsl(${hue} 8% 33%)`,
    surface: `hsl(${hue} 10% 16%)`,
    surfaceRaised: `hsl(${hue} 10% 20%)`,
    border: `hsl(${hue} 9% 29%)`,
    rule: `hsl(${hue} 9% 25%)`,
  }
}

/**
 * Lay one set of overrides over a theme.
 *
 * @param theme - The theme being changed.
 * @param override - What changes.
 * @returns A new theme.
 */
function apply(theme: MediaTheme, override: ThemeOverride | undefined): MediaTheme {
  if (override === undefined) {
    return theme
  }
  const { text, tones, syntax, chrome, fonts, ...flat } = override
  return {
    ...theme,
    ...flat,
    text: { ...theme.text, ...text },
    tones: { ...theme.tones, ...tones },
    syntax: { ...theme.syntax, ...syntax },
    chrome: { ...theme.chrome, ...chrome },
    fonts: { ...theme.fonts, ...fonts },
  }
}

/**
 * Resolve the theme one variant of a scene is drawn with.
 *
 * Built-in first, then the scene's hue, then the scene's overrides for every
 * variant, then its overrides for this one. Each layer sees the one before, so
 * a scene can retint a caret in every theme and still darken it in the light
 * one alone.
 *
 * @param id - The variant being rendered.
 * @param hue - The scene's hue in degrees, or undefined to keep the theme's own ground.
 * @param overrides - What the scene changes.
 * @returns The theme to draw with.
 * @example A scene with the site's blue and a teal caret everywhere
 * ```ts
 * resolveTheme('dark', 217, { all: { accent: '#5eead4' } })
 * ```
 */
export function resolveTheme(id: ThemeId, hue: number | undefined, overrides: ThemeOverrides | undefined): MediaTheme {
  const base = builtInTheme(id)
  const tinted = hue === undefined ? base : apply(base, tint(base, hue))
  return apply(apply(tinted, overrides?.all), overrides?.[id])
}
