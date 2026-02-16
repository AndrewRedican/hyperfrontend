import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'HyperFrontend - Micro-Frontend Architecture',
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
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
