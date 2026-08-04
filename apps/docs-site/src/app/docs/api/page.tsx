import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

// why: the static export renders this redirect as a meta-refresh stub page, which search engines should never index
export const metadata: Metadata = {
  robots: { index: false },
}

export default function ApiReferencePage() {
  redirect('/docs/libraries')
}
