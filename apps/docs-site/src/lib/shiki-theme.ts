import type { ThemeRegistrationRaw } from 'shiki'

/**
 * What each kind of token is coloured, in one place per theme.
 *
 * Written as roles rather than as scopes because a scope list is long and a
 * palette is short: the roles are what a reader actually distinguishes, and
 * keeping them named means the light and dark themes can be checked against
 * each other by eye instead of by counting hex values.
 */
interface CodePalette {
  /** Text with no more specific role: identifiers, parameters, properties. */
  foreground: string
  /** Brackets, commas, semicolons and the rest of the syntax scaffolding. */
  punctuation: string
  /** Comments, set apart by weight rather than by hue. */
  comment: string
  /** Keywords, control flow and storage: `import`, `const`, `return`, `async`. */
  keyword: string
  /** Operators, including the arrow and the spread. */
  operator: string
  /** String and template literals. */
  string: string
  /** Numbers, booleans, `null`, and language constants. */
  constant: string
  /** Function and method names, at their declaration and at their call. */
  function: string
  /** Types, classes, interfaces and namespaces. */
  type: string
  /** Regular expressions and escape sequences inside strings. */
  regexp: string
  /** Markup a grammar has marked as wrong. */
  invalid: string
  /** Tag names in HTML and JSX. */
  tag: string
  /** Attribute names in HTML and JSX. */
  attribute: string
}

/**
 * The dark palette.
 *
 * Magenta carries the keywords, because keywords are the skeleton of a sample
 * and the eye should find them first; two blues separate what a program calls
 * from what it holds; violet takes the literals; and one teal stands in for the
 * type system, which is the only role that needed a hue outside the family to
 * stay legible next to the rest. Nothing is a pure primary, so the block is
 * bright without any single token shouting over the others.
 */
const DARK: CodePalette = {
  foreground: '#cbd5f5',
  punctuation: '#8494bd',
  comment: '#7d8cb5',
  keyword: '#f472b6',
  operator: '#e879f9',
  string: '#7dd3fc',
  constant: '#a78bfa',
  function: '#60a5fa',
  type: '#5eead4',
  regexp: '#fda4af',
  invalid: '#fb7185',
  tag: '#f472b6',
  attribute: '#a5b4fc',
}

/**
 * The light palette.
 *
 * The same roles in the same hue families, taken down to the 700 band so every
 * one of them clears the contrast floor against a near-white block. A light
 * theme that simply reuses the dark hues is the usual way these two drift
 * apart; keeping the families and moving only the lightness is what makes the
 * two read as one language.
 */
const LIGHT: CodePalette = {
  foreground: '#1e293b',
  punctuation: '#64748b',
  comment: '#6b7280',
  keyword: '#be185d',
  operator: '#a21caf',
  string: '#0369a1',
  constant: '#6d28d9',
  function: '#1d4ed8',
  type: '#0f766e',
  regexp: '#be123c',
  invalid: '#b91c1c',
  tag: '#be185d',
  attribute: '#4338ca',
}

/**
 * Turn a palette into the scope table a TextMate theme is made of.
 *
 * The scope lists are the ones the grammars this site actually renders emit:
 * TypeScript, JavaScript, JSON, shell, HTML, CSS and markdown. A scope that is
 * missing falls back to the editor foreground, which is why the default is a
 * readable colour rather than a placeholder.
 *
 * @param palette - The colours each role takes.
 * @param name - Name the theme is registered under.
 * @param type - Whether the theme is the light or the dark one.
 * @returns A theme Shiki can highlight with.
 */
function buildTheme(palette: CodePalette, name: string, type: 'light' | 'dark'): ThemeRegistrationRaw {
  return {
    name,
    type,
    colors: {
      // why: the block's surface is painted by the stylesheet so it can be translucent and pick up the page, and a theme background here would sit on top of that as an opaque rectangle
      'editor.background': 'transparent',
      'editor.foreground': palette.foreground,
    },
    settings: [
      {
        scope: ['comment', 'punctuation.definition.comment', 'string.comment'],
        settings: { foreground: palette.comment, fontStyle: 'italic' },
      },
      {
        scope: [
          'keyword',
          'keyword.control',
          'keyword.operator.new',
          'keyword.operator.expression',
          'storage',
          'storage.type',
          'storage.modifier',
        ],
        settings: { foreground: palette.keyword },
      },
      { scope: ['keyword.operator', 'punctuation.accessor', 'meta.arrow'], settings: { foreground: palette.operator } },
      {
        scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string', 'meta.embedded.assembly'],
        settings: { foreground: palette.string },
      },
      { scope: ['constant.character.escape', 'string.regexp', 'constant.other.character-class'], settings: { foreground: palette.regexp } },
      {
        scope: ['constant', 'constant.numeric', 'constant.language', 'variable.language', 'support.constant'],
        settings: { foreground: palette.constant },
      },
      {
        scope: [
          'entity.name.function',
          'support.function',
          'meta.function-call.generic',
          'variable.function',
          'meta.definition.method entity.name.function',
        ],
        settings: { foreground: palette.function },
      },
      {
        scope: [
          'entity.name.type',
          'entity.name.class',
          'entity.name.namespace',
          'support.type',
          'support.class',
          'entity.other.inherited-class',
        ],
        settings: { foreground: palette.type },
      },
      { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: palette.tag } },
      { scope: ['entity.other.attribute-name', 'meta.attribute'], settings: { foreground: palette.attribute } },
      {
        scope: ['variable', 'variable.other', 'variable.parameter', 'meta.object-literal.key', 'support.variable'],
        settings: { foreground: palette.foreground },
      },
      {
        scope: ['punctuation', 'meta.brace', 'punctuation.separator', 'punctuation.terminator', 'punctuation.definition.parameters'],
        settings: { foreground: palette.punctuation },
      },
      { scope: ['invalid', 'invalid.illegal', 'markup.deleted'], settings: { foreground: palette.invalid } },
      { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: palette.function, fontStyle: 'bold' } },
      { scope: ['markup.bold'], settings: { foreground: palette.foreground, fontStyle: 'bold' } },
      { scope: ['markup.italic'], settings: { foreground: palette.foreground, fontStyle: 'italic' } },
      { scope: ['markup.inline.raw', 'markup.fenced_code'], settings: { foreground: palette.string } },
      { scope: ['markup.underline.link', 'string.other.link'], settings: { foreground: palette.attribute } },
      { scope: ['markup.inserted'], settings: { foreground: palette.type } },
      { scope: ['support.type.property-name.css', 'support.type.property-name.json'], settings: { foreground: palette.attribute } },
      { scope: ['entity.name.function.shell', 'support.function.builtin.shell'], settings: { foreground: palette.function } },
    ],
  }
}

/** The light theme, registered under a name of this site's own. */
export const CODE_THEME_LIGHT: ThemeRegistrationRaw = buildTheme(LIGHT, 'hyperfrontend-light', 'light')

/** The dark theme, registered under a name of this site's own. */
export const CODE_THEME_DARK: ThemeRegistrationRaw = buildTheme(DARK, 'hyperfrontend-dark', 'dark')

/**
 * The pair every highlighter in the site is configured with.
 *
 * Both entry points reach for this rather than naming themes of their own, so
 * a code sample rendered from a README and one written into a page component
 * cannot end up in two different palettes.
 */
export const CODE_THEMES = { light: CODE_THEME_LIGHT, dark: CODE_THEME_DARK }
