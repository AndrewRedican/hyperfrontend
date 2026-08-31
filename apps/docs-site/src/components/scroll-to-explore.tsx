'use client'

export function ScrollToExplore() {
  // why: animate-bounce's keyframes overwrite the element's transform every frame, which silently drops a -translate-x-1/2 on the same element and leaves the button half a width right of centre — so a wrapper owns the centring and only the inner button bounces.
  return (
    <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 lg:block">
      <button
        onClick={() => document.getElementById('learn')?.scrollIntoView({ behavior: 'smooth' })}
        className="flex animate-bounce cursor-pointer flex-col items-center gap-2 border-none bg-transparent"
      >
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Scroll to explore</span>
        <ChevronDownIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
      </button>
    </div>
  )
}

type ChevronDownIconProps = { className?: string }

function ChevronDownIcon({ className }: ChevronDownIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}
