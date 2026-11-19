import { Edit3, Share2, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { CloudObservation } from '../types/cloud';
import { formatObservedTimestamp, hasAnyWeatherData } from '../utils/csvAndImage';
import { CloudPlateFallback } from './CloudPlateFallback';
import { StarRating } from './StarRating';

interface ObservationDetailModalProps {
  observation: CloudObservation | null;
  readOnly?: boolean;
  onClose: () => void;
  onEdit: (obs: CloudObservation) => void;
  onDelete: (id: string) => void;
  onShare: (obs: CloudObservation) => void;
}

export function ObservationDetailModal({
  observation,
  readOnly = false,
  onClose,
  onEdit,
  onDelete,
  onShare,
}: ObservationDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!observation) return null;

  const weather = observation.weather;
  const showWeather = hasAnyWeatherData(weather);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0 pr-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
              <span>
                {observation.abbreviation ||
                  (observation.genusCode === 'Unknown' ? 'OBS' : observation.genusCode)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{observation.etage}</span>
              {observation.oktas !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{observation.oktas}/8 oktas</span>
                </>
              )}
              {observation.album && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Album: {observation.album}</span>
                </>
              )}
            </div>
            <h2
              id="detail-modal-title"
              className="mt-1 font-display text-lg font-bold text-slate-900"
            >
              {observation.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close specimen inspector"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="aspect-[16/10] w-full border-b border-slate-200 bg-slate-100">
            {observation.photoDataUrl ? (
              <img
                src={observation.photoDataUrl}
                alt={observation.title}
                referrerPolicy="no-referrer"
                className="h-full w-full bg-slate-950 object-contain"
              />
            ) : (
              <CloudPlateFallback genusCode={observation.genusCode} title={observation.title} />
            )}
          </div>

          <div className="space-y-5 p-6">
            <dl className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-5 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Observed Date</dt>
                <dd className="mt-1 font-mono text-slate-900 tabular-nums">
                  {formatObservedTimestamp(observation.observedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Observer (Person)</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {observation.observer || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Station / Location</dt>
                <dd className="mt-1 text-slate-900">{observation.location || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-slate-400">Est. Base Altitude</dt>
                <dd className="mt-1 font-mono text-slate-900 tabular-nums">
                  {observation.altitudeEstimate || '—'}
                </dd>
              </div>
            </dl>

            {showWeather && weather && (
              <div className="border-b border-slate-100 pb-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700">
                    Surface Weather Conditions
                  </h3>
                  <span className="font-mono text-[11px] text-slate-400">
                    {weather.source === 'auto' ? 'Geolocation Telemetry' : 'Manual Entry'}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] font-medium text-slate-400">Temperature</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {weather.temperatureC !== null ? `${weather.temperatureC} °C` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-400">Rel. Humidity</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {weather.humidityPct !== null ? `${weather.humidityPct} %` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-400">Wind</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {weather.windSpeedKmh !== null
                        ? `${weather.windSpeedKmh} km/h${weather.windDirection ? ` ${weather.windDirection}` : ''}`
                        : weather.windDirection || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-400">Barometric Pressure</dt>
                    <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {weather.pressureHpa !== null ? `${weather.pressureHpa} hPa` : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-xs font-medium text-slate-500">Clarity Rating (0–5)</span>
              <StarRating value={observation.rating} size="md" />
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-700">Field Description</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {observation.description || 'No field notes recorded for this observation.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          {!readOnly ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-rose-700">Delete this entry?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(observation.id);
                    onClose();
                  }}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </button>
            )
          ) : (
            <span className="text-xs text-slate-500">Shared read-only specimen</span>
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onShare(observation);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              Share
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(observation);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
              >
                <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                Edit Entry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
