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
}

module.exports = nextConfig
