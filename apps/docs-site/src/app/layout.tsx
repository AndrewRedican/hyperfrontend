import type { Metadata, Viewport } from 'next'
import { Analytics } from '@/components/analytics/analytics'
import { ConsentBanner } from '@/components/consent/consent-banner'
import { JsonLd } from '@/components/json-ld'
import { ThemeProvider } from '@/components/theme-provider'
import '@/lib/dev-logger'
import { DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata'
import { SITE_URL } from '@/lib/site'
import '@/styles/globals.css'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'

export const metadata: Metadata = {
  metadataBase: createURL(SITE_URL),
  title: {
    default: 'HyperFrontend - Micro-Frontend Architecture',
    template: '%s | HyperFrontend',
  },
  description:
    'A hybrid micro-frontend pattern to embed live web applications with communication protocols, lifecycle, and contract standards.',
  keywords: ['micro-frontend', 'microfrontend', 'web components', 'iframe', 'react', 'angular', 'vue', 'svelte'],
  authors: [{ name: 'Andrew Redican' }],
  openGraph: {
    title: 'HyperFrontend',
    description: 'Compose your existing apps together securely, like Lego bricks.',
    url: SITE_URL,
    siteName: 'HyperFrontend',
    type: 'website',
    locale: 'en_US',
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HyperFrontend',
    description: 'Compose your existing apps together securely, like Lego bricks.',
    creator: '@andrew_redican',
    images: [DEFAULT_TWITTER_IMAGE],
  },
  alternates: {
    canonical: './',
    types: {
      'application/atom+xml': [{ url: '/feed.xml', title: 'HyperFrontend Articles' }],
    },
  },
  verification: {
    google: process.env['NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION'],
  },
  icons: {
    // why: configuring icons suppresses Next's file-convention icon links, so the src/app icon files must be referenced here explicitly
    icon: [
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/hf-light.svg', media: '(prefers-color-scheme: light)', type: 'image/svg+xml' },
      { url: '/hf-dark.svg', media: '(prefers-color-scheme: dark)', type: 'image/svg+xml' },
    ],
    shortcut: '/hf-light.svg',
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

type RootLayoutProps = { children: React.ReactNode }

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'HyperFrontend',
            url: SITE_URL,
            description:
              'A hybrid micro-frontend pattern to embed live web applications with communication protocols, lifecycle, and contract standards.',
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
        <ConsentBanner />
      </body>
    </html>
  )
}
