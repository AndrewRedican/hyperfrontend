/**
 * Content type served for the machine-readable counterpart of every
 * documentation page.
 *
 * `text/plain` rather than `text/markdown`: browsers have no renderer for
 * `text/markdown` and download the file instead of showing it, which turns
 * "view this page as Markdown" into a save dialog. Command-line clients,
 * scripts, and agents read UTF-8 text either way, so plain text is the type
 * that works for every consumer rather than most of them.
 *
 * Vercel serves the exported site directly and never runs this config, so the
 * same rule is repeated in `vercel.json` for production.
 */
const MARKDOWN_CONTENT_TYPE = 'text/plain; charset=utf-8'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Only use static export on Vercel (VERCEL env var is set automatically)
  ...(process.env.VERCEL && { output: 'export' }),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Allow Codespaces proxy
  allowedDevOrigins: ['*.app.github.dev'],
  // Static export has no request pipeline to attach headers to, so this runs only for the local server build
  ...(!process.env.VERCEL && {
    async headers() {
      return [
        {
          source: '/:path*.md',
          headers: [{ key: 'Content-Type', value: MARKDOWN_CONTENT_TYPE }],
        },
      ]
    },
  }),
}

module.exports = nextConfig
