import { Breadcrumb } from '@/components/breadcrumb'
import { DocsChrome } from '@/components/docs-chrome'
import { buildGuideRequestUrl } from '@/lib/guide-request'
import { getPageMetadata } from '@/lib/metadata'
import { REPO_URL, SUPPORT_EMAIL } from '@/lib/site'
import { buildSupportMailto, SUPPORT_ROUTE } from '@/lib/support'
import Link from 'next/link'

export const metadata = getPageMetadata({
  title: 'Support',
  description:
    'Questions, feedback, onboarding help, and an honest read on whether HyperFrontend fits your architecture: write to the project, and see how to support it back.',
  path: SUPPORT_ROUTE,
})

/** One thing a reader might write in about, and what to expect back. */
interface Prompt {
  /** The question a reader arrives with */
  lead: string
  /** What writing in gets them */
  body: string
}

/**
 * What the mail is for. Written as the questions readers actually arrive
 * with rather than as service categories, so a reader recognizes their own
 * before deciding whether to write.
 */
const PROMPTS: Prompt[] = [
  {
    lead: 'Have a question?',
    body: 'About a package, the protocol, the security model, or something the documentation left unsaid.',
  },
  {
    lead: 'Getting started?',
    body: 'A first feature, a first host, or a build that will not come together: describe where you are and what you see.',
  },
  {
    lead: 'Wondering whether it fits?',
    body: 'Sketch your architecture and the constraints around it. The answer is honest, and sometimes it is that you need something else.',
  },
  {
    lead: 'Found something confusing?',
    body: 'A page that lost you, an example that did not run, a name that means two things. Say where; the documentation gets fixed.',
  },
  {
    lead: 'Have feedback?',
    body: 'What worked, what did not, what you expected instead. It shapes what gets built next.',
  },
]

/** Link classes shared by the ways-to-help list. */
const HELP_LINK = 'font-medium text-primary-600 underline-offset-2 hover:underline dark:text-primary-400'

export default function SupportPage() {
  const mailto = buildSupportMailto()

  return (
    <DocsChrome>
      <Breadcrumb />

      {/* why: a reading measure for a page that is prose from top to bottom, aligned with the breadcrumb above it the way every other page in the shell is */}
      <div className="max-w-3xl">
        <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Support</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-400">
          Questions, feedback, and a hand getting started are all welcome. HyperFrontend is an open-source project, and mail to it is read
          and answered by the people who build it.
        </p>

        {/* why: the one action the page exists for, drawn large enough to be found from across the room; a plain mailto so it works without scripting and hands off to whatever mail client the reader has */}
        <div className="support-well mt-10">
          <a href={mailto} className="support-cta">
            <MailIcon className="support-cta__mark" />
            <span className="support-cta__label">Write to the project</span>
            <span className="support-cta__arrow" aria-hidden="true">
              →
            </span>
          </a>
          <p className="support-well__address">
            Opens your mail client with the subject filled in. Or write to{' '}
            <a href={mailto} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
              {SUPPORT_EMAIL}
            </a>{' '}
            directly.
          </p>
        </div>

        <section className="mt-14" aria-labelledby="support-prompts">
          <h2 id="support-prompts" className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            What to write in about
          </h2>
          <ul className="support-prompts mt-6">
            {PROMPTS.map((prompt) => (
              <li key={prompt.lead} className="support-prompt">
                <span className="support-prompt__mark" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{prompt.lead}</p>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">{prompt.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14" aria-labelledby="support-back">
          <h2 id="support-back" className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Supporting the project
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            The project is built in the open and paid for in time. The ways to give some of that back are small and all of them help:
          </p>
          <ul className="mt-5 space-y-3 text-slate-600 dark:text-slate-400">
            <li>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={HELP_LINK}>
                Star the repository
              </a>{' '}
              on GitHub, which is how other people find it.
            </li>
            <li>
              <a href={`${REPO_URL}/issues/new/choose`} target="_blank" rel="noopener noreferrer" className={HELP_LINK}>
                Open an issue
              </a>{' '}
              for a bug or a feature; the templates ask for exactly what a fix needs.
            </li>
            <li>
              <a href={buildGuideRequestUrl()} target="_blank" rel="noopener noreferrer" className={HELP_LINK}>
                Suggest a guide
              </a>{' '}
              for the task you could not find written up.
            </li>
            <li>
              <Link href="/docs/contributing" className={HELP_LINK}>
                Contribute
              </Link>{' '}
              a fix, a test, a sentence of documentation, or a demo of your own.
            </li>
            <li>
              <Link href="/docs/is-hyperfrontend-right-for-you" className={HELP_LINK}>
                Take the fit assessment
              </Link>{' '}
              before you write in; if it answers your question, that is a reply you did not have to wait for.
            </li>
          </ul>
        </section>

        <p className="mt-14 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          There is no support contract behind this address and no response time to promise. What there is, is a person who reads it.
        </p>
      </div>
    </DocsChrome>
  )
}

type IconProps = { className?: string }

function MailIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  )
}
