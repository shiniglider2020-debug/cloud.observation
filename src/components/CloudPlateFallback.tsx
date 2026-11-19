import type { GenusCode } from '../types/cloud';

interface CloudPlateFallbackProps {
  genusCode: GenusCode;
  title: string;
  compact?: boolean;
}

export function CloudPlateFallback({ genusCode, title, compact = false }: CloudPlateFallbackProps) {
  if (compact) {
    return (
      <div className="flex h-10 w-14 shrink-0 items-center justify-center border border-slate-200 bg-slate-100 font-mono text-[11px] font-semibold text-slate-500">
        {genusCode === 'Unknown' ? '—' : genusCode}
      </div>
    );
  }

  return (
    <div
      aria-label={`No visual plate recorded for ${title}`}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-slate-100 text-slate-400 select-none"
    >
      {/* Subtle scientific coordinate reticle */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-slate-200/80"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid-reticle" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.75" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-reticle)" />
      </svg>
      <div className="relative z-10 flex flex-col items-center gap-1 px-4 text-center">
        <span className="font-mono text-xl font-semibold tracking-tight text-slate-500">
          {genusCode === 'Unknown' ? 'OBS' : genusCode}
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          No visual plate recorded
        </span>
      </div>
    </div>
  );
}
