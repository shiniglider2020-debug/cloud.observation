import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CloudObservation } from '../types/cloud';
import { formatCalendarDate, formatTimeOnly, formatWeatherCompact } from '../utils/csvAndImage';
import { CloudPlateFallback } from './CloudPlateFallback';
import { StarRating } from './StarRating';

interface ObservationTimelineViewProps {
  observations: CloudObservation[];
  readOnly?: boolean;
  onSelectObservation: (obs: CloudObservation) => void;
  onDeleteObservation: (id: string) => void;
  onAddNew: () => void;
}

export function ObservationTimelineView({
  observations,
  readOnly = false,
  onSelectObservation,
  onDeleteObservation,
  onAddNew,
}: ObservationTimelineViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = [...observations].sort(
    (a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime()
  );

  const groups = new Map<string, CloudObservation[]>();
  sorted.forEach((obs) => {
    const key = obs.observedAt ? obs.observedAt.slice(0, 10) : 'Undated';
    const existing = groups.get(key) ?? [];
    existing.push(obs);
    groups.set(key, existing);
  });

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-600 hover:text-sky-700"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add Observation
          </button>
        </div>
      )}

      {Array.from(groups.entries()).map(([dateKey, items]) => {
        const chronologicalItems = [...items].sort(
          (a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime()
        );
        return (
          <section
            key={dateKey}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                {formatCalendarDate(dateKey)}
              </h3>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {chronologicalItems.length}{' '}
                {chronologicalItems.length === 1 ? 'observation' : 'observations'}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {chronologicalItems.map((obs) => {
                const weatherLine = formatWeatherCompact(obs.weather);
                const isConfirming = confirmDeleteId === obs.id;
                return (
                  <div
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
                    className="flex cursor-pointer flex-col gap-4 px-5 py-4 transition-colors hover:bg-sky-50/30 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3 sm:w-48 shrink-0">
                      <span className="font-mono text-sm font-semibold text-sky-800 tabular-nums">
                        {formatTimeOnly(obs.observedAt)}
                      </span>
                      <span className="font-mono text-xs text-slate-600">
                        {obs.abbreviation || (obs.genusCode === 'Unknown' ? 'OBS' : obs.genusCode)}
                      </span>
                      {obs.oktas !== null && (
                        <span className="font-mono text-xs text-slate-500 tabular-nums">
                          {obs.oktas}/8
                        </span>
                      )}
                    </div>

                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                      {obs.photoDataUrl ? (
                        <img
                          src={obs.photoDataUrl}
                          alt={obs.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <CloudPlateFallback
                          genusCode={obs.genusCode}
                          title={obs.title}
                          compact
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="font-display text-sm font-semibold text-slate-900">
                          {obs.title}
                        </h4>
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <StarRating value={obs.rating} size="sm" />
                          {!readOnly && (
                            isConfirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteObservation(obs.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-rose-700"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(obs.id)}
                                aria-label={`Delete ${obs.title}`}
                                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {obs.description || 'No field notes recorded.'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>{obs.etage}</span>
                        <span aria-hidden="true">·</span>
                        <span>Observer: {obs.observer || '—'}</span>
                        {obs.location && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{obs.location}</span>
                          </>
                        )}
                        {weatherLine && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-slate-600 tabular-nums">
                              {weatherLine}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
