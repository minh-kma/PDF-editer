import { ShieldIcon } from './icons'

export function Header() {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-extrabold text-white shadow-soft">
            P
          </div>
          <div className="leading-tight">
            <span className="text-xl font-extrabold tracking-tight text-ink">
              PDF<span className="text-brand-500">demo</span>
            </span>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-ink-soft shadow-soft sm:flex">
          <ShieldIcon width={16} height={16} className="text-brand-500" />
          100% in your browser — files never uploaded
        </div>
      </div>
    </header>
  )
}
