import type { Article } from './articles'

/**
 * Escape a string for use in XML text or attribute content.
 *
 * @param text - Raw text
 * @returns XML-safe text
 */
function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/**
 * Convert an ISO YYYY-MM-DD date to the RFC 3339 timestamp Atom requires.
 *
 * @param date - Date in YYYY-MM-DD form
 * @returns RFC 3339 timestamp at midnight UTC
 */
function toRfc3339(date: string): string {
  return `${date}T00:00:00.000Z`
}

/**
 * Serialize the Articles corpus as an Atom 1.0 feed.
 *
 * Entries are the site's chronologically published editorial material; every
 * link is the canonical on-site URL. The feed's own updated stamp is the most
 * recent article revision, not the build time, so unchanged content produces
 * an unchanged feed.
 *
 * @param articles - Articles, any order; the feed sorts newest first
 * @param siteUrl - Absolute site origin without a trailing slash
 * @returns The serialized Atom XML document
 */
export function buildArticlesFeed(articles: Article[], siteUrl: string): string {
  const sorted = [...articles].sort((a, b) => b.date.localeCompare(a.date))
  const newest = sorted
    .map((article) => article.updated || article.date)
    .sort()
    .at(-1)

  const entries = sorted
    .map((article) => {
      const url = `${siteUrl}/articles/${article.slug}/`
      const categories = [article.category, ...article.tags]
        .filter(Boolean)
        .map((term) => `    <category term="${escapeXml(term)}"/>`)
        .join('\n')
      return [
        '  <entry>',
        `    <title>${escapeXml(article.title)}</title>`,
        `    <link href="${escapeXml(url)}"/>`,
        `    <id>${escapeXml(url)}</id>`,
        `    <published>${toRfc3339(article.date)}</published>`,
        `    <updated>${toRfc3339(article.updated || article.date)}</updated>`,
        `    <author><name>${escapeXml(article.author)}</name></author>`,
        `    <summary>${escapeXml(article.description)}</summary>`,
        ...(categories ? [categories] : []),
        '  </entry>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '  <title>HyperFrontend Articles</title>',
    '  <subtitle>Long-form writing on microfrontend architecture and the reasoning behind HyperFrontend.</subtitle>',
    `  <link href="${escapeXml(`${siteUrl}/articles/`)}"/>`,
    `  <link rel="self" href="${escapeXml(`${siteUrl}/feed.xml`)}"/>`,
    `  <id>${escapeXml(`${siteUrl}/articles/`)}</id>`,
    `  <updated>${newest ? toRfc3339(newest) : toRfc3339('1970-01-01')}</updated>`,
    entries,
    '</feed>',
    '',
  ].join('\n')
}
