import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'

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
          <div className="flex gap-6">
            <a
              href="https://github.com/AndrewRedican/hyperfrontend"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              GitHub
            </a>
            <a
              href="https://github.com/sponsors/AndrewRedican"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              Sponsor
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
