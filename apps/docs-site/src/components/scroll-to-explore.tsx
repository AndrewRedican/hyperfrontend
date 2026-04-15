'use client'

export function ScrollToExplore() {
  return (
    <button
      onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
      className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 cursor-pointer flex-col items-center gap-2 animate-bounce border-none bg-transparent lg:flex"
    >
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Scroll to explore</span>
      <ChevronDownIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
    </button>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}
