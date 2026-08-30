import Link from 'next/link'

const quickLinks = [
  {
    title: 'Getting Started',
    description: 'Install and create your first hyperfrontend feature in minutes.',
    href: '/docs',
  },
  {
    title: 'Core Libraries',
    description: 'Explore the nexus, network-protocol, and other core packages.',
    href: '/docs/libraries',
  },
  {
    title: 'Live Demos',
    description: 'See hyperfrontend in action with interactive examples.',
    href: '/demos',
  },
  {
    title: 'Architecture',
    description: 'Understand the monorepo structure and design decisions.',
    href: '/architecture',
  },
]

export function QuickLinks() {
  return (
    <section className="bg-slate-50 py-24 dark:bg-slate-800/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Quick Links</h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Jump right in or explore the documentation.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.title}
              href={link.href}
              className="group rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-primary-500 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-500 dark:hover:bg-primary-950/50"
            >
              <h3 className="font-display text-lg font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                {link.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
