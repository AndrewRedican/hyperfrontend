import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import '@/lib/dev-logger'
import '@/styles/globals.css'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'

export const metadata: Metadata = {
  metadataBase: createURL('https://hyperfrontend.dev'),
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
    description: 'Compose your existing apps together securely — like Lego bricks.',
    url: 'https://hyperfrontend.dev',
    siteName: 'HyperFrontend',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HyperFrontend',
    description: 'Compose your existing apps together securely — like Lego bricks.',
    creator: '@andrew_redican',
  },
  alternates: {
    canonical: './',
  },
  icons: {
    icon: [
      { url: '/hf-light.svg', media: '(prefers-color-scheme: light)', type: 'image/svg+xml' },
      { url: '/hf-dark.svg', media: '(prefers-color-scheme: dark)', type: 'image/svg+xml' },
    ],
    shortcut: '/hf-light.svg',
    apple: '/hf-light.svg',
  },
}

type RootLayoutProps = { children: React.ReactNode }

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
