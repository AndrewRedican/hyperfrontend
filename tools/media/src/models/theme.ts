/**
 * The presentation variants every scripted scene is rendered in.
 *
 * `dark` and `light` are the documentation site's two themes and are drawn
 * edge to edge, because the page around them supplies the ground. `portable`
 * is for surfaces nobody here controls, a package listing or a readme rendered
 * by someone else's markdown, and assumes nothing about what is behind it.
 */
export type ThemeId = 'dark' | 'light' | 'portable'

/** Every colour a run of text can take, named for what the text means. */
export interface ThemeText {
  /** Headings and the one line a frame is about. */
  strong: string
  /** Ordinary text. */
  plain: string
  /** Secondary text: notes, subtitles, the line under a label. */
  muted: string
  /** Tertiary text: margins, counts, chrome. */
  faint: string
}

/**
 * The semantic tones a stage colours things with.
 *
 * A scene says `success` or `danger` and never names a colour, so the same
 * scene reads correctly in every theme and a theme is free to disagree about
 * what green is.
 */
export interface ThemeTones {
  /** No particular meaning. */
  plain: string
  /** Something less important than its neighbours. */
  muted: string
  /** The thing the frame is drawing attention to. */
  accent: string
  /** Something that went right. */
  success: string
  /** Something to be careful of. */
  warning: string
  /** Something that went wrong. */
  danger: string
}

/** What the code tokeniser paints each kind of run with. */
export interface ThemeSyntax {
  /** Anything from `//` to the end of the line. */
  comment: string
  /** A quoted or backticked run. */
  string: string
  /** A bare number. */
  number: string
  /** One of the language's own words. */
  keyword: string
  /** A name immediately before an opening parenthesis. */
  call: string
  /** Braces, brackets, commas and operators. */
  punctuation: string
}

/** The window chrome a terminal or a session panel is drawn with. */
export interface ThemeChrome {
  /** The bar's surface. */
  bar: string
  /** The three window buttons, left to right. */
  buttons: readonly [string, string, string]
  /** The title text in the bar. */
  title: string
}

/** The faces a theme sets its type in. */
export interface ThemeFonts {
  /** Labels, notes and prose. */
  sans: string
  /** Source, values and anything that has to line up. */
  mono: string
}

/**
 * Every visual token a stage draws with.
 *
 * A theme is data rather than a stylesheet: one stage implementation carries
 * every look, a scene never names a colour, and the three variants of an asset
 * differ only in what this table says. The tokens are named for the role they
 * play in a composition, so a stage that needs a rule between two things asks
 * for `rule` and gets whatever the theme thinks a rule should be here.
 */
export interface MediaTheme {
  /** Name a variant is written under. */
  id: ThemeId
  /**
   * Whether the canvas outside the plate is see-through.
   *
   * A transparent canvas is what makes an asset portable: the plate carries
   * its own ground, and whatever page it lands on shows through around it.
   */
  transparent: boolean
  /** The ground the whole frame is drawn on, or `transparent`. */
  backdrop: string
  /**
   * The opaque plate a transparent frame draws itself on.
   *
   * Empty when the backdrop is the ground, which is the case for a frame
   * composed for a page whose theme is known.
   */
  plate: string
  /** The edge of the plate, drawn so the plate has one on a page the same colour as it. */
  plateBorder: string
  /** A panel, a card, a window body. */
  surface: string
  /** A surface that has to sit above another surface. */
  surfaceRaised: string
  /** The outline of a surface. */
  border: string
  /** A rule inside a surface: under a title, between rows. */
  rule: string
  /** The outline of a surface that is doing something right now. */
  borderActive: string
  /** The `box-shadow` a surface casts, or `none`. */
  shadow: string
  /** The one colour that means "this": packets, carets, links, the lit band. */
  accent: string
  /** The accent at a strength a whole row can sit on. */
  accentSoft: string
  /** Text colours by role. */
  text: ThemeText
  /** Colours by meaning. */
  tones: ThemeTones
  /** Colours the code tokeniser paints with. */
  syntax: ThemeSyntax
  /** Window chrome. */
  chrome: ThemeChrome
  /** Typefaces. */
  fonts: ThemeFonts
}

/**
 * What a scene may change about a theme, one variant at a time or all at once.
 *
 * The overrides are shallow at the top level and one level deep inside the
 * grouped tokens, which is enough to retint a caret or swap one tone without
 * restating the rest of the table.
 */
export interface ThemeOverride extends Partial<Omit<MediaTheme, 'id' | 'text' | 'tones' | 'syntax' | 'chrome' | 'fonts'>> {
  /** Text colours to replace. */
  text?: Partial<ThemeText>
  /** Tones to replace. */
  tones?: Partial<ThemeTones>
  /** Syntax colours to replace. */
  syntax?: Partial<ThemeSyntax>
  /** Chrome colours to replace. */
  chrome?: Partial<ThemeChrome>
  /** Typefaces to replace. */
  fonts?: Partial<ThemeFonts>
}

/**
 * Per-variant overrides a scene states beside its configuration.
 *
 * `all` applies to every variant before the variant's own entry does, so a
 * scene that wants one caret colour everywhere and a different lit band only
 * in the light theme says both in one object.
 */
export type ThemeOverrides = Partial<Record<ThemeId | 'all', ThemeOverride>>
