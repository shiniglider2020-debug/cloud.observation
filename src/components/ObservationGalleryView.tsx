import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CloudObservation } from '../types/cloud';
import { formatObservedTimestamp, formatWeatherCompact } from '../utils/csvAndImage';
import { CloudPlateFallback } from './CloudPlateFallback';
import { StarRating } from './StarRating';

interface ObservationGalleryViewProps {
  observations: CloudObservation[];
  readOnly?: boolean;
  onSelectObservation: (obs: CloudObservation) => void;
  onDeleteObservation: (id: string) => void;
  onAddNew: () => void;
}

export function ObservationGalleryView({
  observations,
  readOnly = false,
  onSelectObservation,
  onDeleteObservation,
  onAddNew,
}: ObservationGalleryViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {observations.map((obs) => {
        const shortEtage = obs.etage.split(' (')[0];
        const weatherLine = formatWeatherCompact(obs.weather);
        const isConfirming = confirmDeleteId === obs.id;

        return (
          <article
            key={obs.id}
            onClick={() => onSelectObservation(obs)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectObservation(obs);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Inspect observation ${obs.title}`}
            className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-sky-600/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
          >
            {/* Visual Plate (4:3) */}
            <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-200 bg-slate-100">
              {obs.photoDataUrl ? (
                <img
                  src={obs.photoDataUrl}
                  alt={obs.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
              ) : (
                <CloudPlateFallback genusCode={obs.genusCode} title={obs.title} />
              )}
            </div>

            {/* Structured Scientific Specimen Fields */}
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-slate-500">
                  <span className="text-sky-800">
                    {obs.abbreviation || (obs.genusCode === 'Unknown' ? 'OBS' : obs.genusCode)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{shortEtage}</span>
                  {obs.oktas !== null && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{obs.oktas}/8 oktas</span>
                    </>
                  )}
                </div>
                <h3
                  title={obs.title}
                  className="mt-1 truncate font-display text-sm font-semibold text-slate-900 group-hover:text-sky-700"
                >
                  {obs.title}
                </h3>
              </div>

              <dl className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-2.5 text-xs">
                <div>
                  <dt className="text-[11px] font-medium text-slate-400">Date</dt>
                  <dd className="mt-0.5 font-mono text-xs text-slate-800 tabular-nums">
                    {formatObservedTimestamp(obs.observedAt)}
                  </dd>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-[11px] font-medium text-slate-400">Person</dt>
                    <dd className="mt-0.5 truncate text-xs text-slate-800">
                      {obs.observer || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-400">Station</dt>
                    <dd className="mt-0.5 truncate text-xs text-slate-800">
                      {obs.location || '—'}
                    </dd>
                  </div>
                </div>

                {weatherLine && (
                  <div>
                    <dt className="text-[11px] font-medium text-slate-400">Surface Weather</dt>
                    <dd className="mt-0.5 truncate font-mono text-[11px] text-slate-700 tabular-nums">
                      {weatherLine}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-[11px] font-medium text-slate-400">Rating (0–5)</dt>
                  <dd className="mt-0.5">
                    <StarRating value={obs.rating} size="sm" />
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-medium text-slate-400">Description</dt>
                  <dd className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
                    {obs.description || 'No field notes recorded.'}
                  </dd>
                </div>
              </dl>

              {!readOnly && (
                <div
                  className="mt-auto flex items-center justify-end border-t border-slate-100 pt-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteObservation(obs.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(obs.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        );
      })}

      {!readOnly && (
        <button
          type="button"
          onClick={onAddNew}
          className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white/70 p-6 text-center text-slate-500 transition-colors hover:border-sky-600 hover:bg-sky-50/40 hover:text-sky-800"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
          <span className="font-display text-xs font-semibold">Add Observation</span>
        </button>
      )}
    </div>
  );
}
