/** Characters that would otherwise be read as markup, and what they become. */
const REPLACEMENTS: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

/**
 * Escape text so it renders as itself inside a stage's markup.
 *
 * A stage builds HTML, and a script is free to contain the characters HTML is
 * made of: a terminal recording of a command with a redirect or a generic in it
 * would otherwise silently lose part of the line it is there to show.
 *
 * @param text - Text to render literally.
 * @returns The same text, safe to place in markup.
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => REPLACEMENTS[character] ?? character)
}
