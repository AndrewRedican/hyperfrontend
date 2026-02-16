const { join } = require('node:path')

const isProduction = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Only use static export for production builds
  ...(isProduction && { output: 'export' }),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: join(__dirname, '../../'),
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Allow Codespaces proxy
  allowedDevOrigins: ['*.app.github.dev'],
}

module.exports = nextConfig
