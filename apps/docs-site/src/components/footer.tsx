import { TrackedLink } from '@/components/analytics/tracked-link'
import { ConsentSettingsButton } from '@/components/consent/consent-settings-button'
import Link from 'next/link'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'

const FOOTER_LINK_CLASSES = 'text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &copy; {createDate().getFullYear()} HyperFrontend.{' '}
            <a
              href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 hover:underline dark:hover:text-white"
            >
              MIT License
            </a>
            .
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <TrackedLink
              href="https://github.com/AndrewRedican/hyperfrontend"
              event={{ kind: 'repo', location: 'footer' }}
              external
              className={FOOTER_LINK_CLASSES}
            >
              GitHub
            </TrackedLink>
            <a href="https://github.com/sponsors/AndrewRedican" target="_blank" rel="noopener noreferrer" className={FOOTER_LINK_CLASSES}>
              Sponsor
            </a>
            <a href="/feed.xml" className={FOOTER_LINK_CLASSES}>
              Articles feed
            </a>
            {/* note: Agents probe /llms.txt directly rather than reading footers; the link is here so a person can find the Markdown corpus too. */}
            <a href="/llms.txt" className={FOOTER_LINK_CLASSES}>
              Docs for LLMs
            </a>
            <Link href="/privacy" className={FOOTER_LINK_CLASSES}>
              Privacy
            </Link>
            {/* note: The persistent way back into the consent dialog; renders nothing while measurement is dormant. */}
            <ConsentSettingsButton className={FOOTER_LINK_CLASSES} />
          </div>
        </div>
      </div>
    </footer>
  )
}
