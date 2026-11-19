import { ArrowDown, ArrowUp, Check, Plus, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { inferAbbreviationFromTitle, inferGenusFromTitle } from '../data/wmoTaxonomy';
import type { CloudObservation, SortDirection, SortField } from '../types/cloud';
import { formatObservedTimestamp, formatWeatherCompact } from '../utils/csvAndImage';
import { CloudPlateFallback } from './CloudPlateFallback';
import { StarRating } from './StarRating';

export interface DraftBroadcast {
  field: string;
  title: string;
  abbreviation: string;
  notes: string;
  author?: string;
}

interface ObservationGridViewProps {
  observations: CloudObservation[];
  sortField: SortField;
  sortDirection: SortDirection;
  readOnly?: boolean;
  lastObserver?: string;
  onToggleSort: (field: SortField) => void;
  onSelectObservation: (obs: CloudObservation) => void;
  onDeleteObservation: (id: string) => void;
  onBulkDeleteObservations?: (ids: string[]) => void;
  onQuickAddObservation?: (obs: CloudObservation) => void;
  onDraftChange?: (draft: DraftBroadcast | null) => void;
  onAddNew: () => void;
  onOpenImport: () => void;
  isFilteredEmpty?: boolean;
  onResetFilters?: () => void;
}

function getLocalDatetimeString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

export function ObservationGridView({
  observations,
  sortField,
  sortDirection,
  readOnly = false,
  lastObserver = '',
  onToggleSort,
  onSelectObservation,
  onDeleteObservation,
  onBulkDeleteObservations,
  onQuickAddObservation,
  onDraftChange,
  onAddNew,
  onOpenImport,
  isFilteredEmpty = false,
  onResetFilters,
}: ObservationGridViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Inline quick-add row state
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAbbr, setQuickAbbr] = useState('');
  const [quickDate, setQuickDate] = useState(getLocalDatetimeString());
  const [quickPerson, setQuickPerson] = useState(lastObserver);
  const [quickStation, setQuickStation] = useState('');
  const [quickAlbum, setQuickAlbum] = useState('');
  const [quickOktas, setQuickOktas] = useState('');
  const [quickRating, setQuickRating] = useState(3);
  const [quickDesc, setQuickDesc] = useState('');

  useEffect(() => {
    if (!onDraftChange) return;
    if (!isQuickAdding) {
      onDraftChange(null);
      return;
    }
    onDraftChange({
      field: 'Quick Add Row',
      title: quickTitle,
      abbreviation: quickAbbr,
      notes: quickDesc,
      author: quickPerson.trim() || lastObserver,
    });
  }, [isQuickAdding, quickTitle, quickAbbr, quickDesc, quickPerson, lastObserver, onDraftChange]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp className="inline h-3 w-3 text-sky-700" aria-hidden="true" />
    ) : (
      <ArrowDown className="inline h-3 w-3 text-sky-700" aria-hidden="true" />
    );
  };

  const allSelected =
    observations.length > 0 && observations.every((obs) => selectedIds.includes(obs.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(observations.map((o) => o.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const startQuickAdd = () => {
    setQuickTitle('');
    setQuickAbbr('');
    setQuickDate(getLocalDatetimeString());
    setQuickPerson(lastObserver);
    setQuickStation('');
    setQuickAlbum('');
    setQuickOktas('');
    setQuickRating(3);
    setQuickDesc('');
    setIsQuickAdding(true);
  };

  const handleSaveQuickAdd = () => {
    const trimmed = quickTitle.trim();
    if (!trimmed || !onQuickAddObservation) return;
    const inferred = inferGenusFromTitle(trimmed);
    const parsedOktas =
      quickOktas.trim() !== '' && !Number.isNaN(Number(quickOktas))
        ? Math.min(8, Math.max(0, Math.round(Number(quickOktas))))
        : null;

    const record: CloudObservation = {
      id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: trimmed,
      abbreviation:
        quickAbbr.trim() || inferAbbreviationFromTitle(trimmed, inferred.genusCode),
      genusCode: inferred.genusCode,
      etage: inferred.etage,
      observedAt: quickDate || getLocalDatetimeString(),
      observer: quickPerson.trim() || '-',
      location: quickStation.trim(),
      album: quickAlbum.trim(),
      oktas: parsedOktas,
      altitudeEstimate: '',
      weather: null,
      rating: quickRating,
      description: quickDesc.trim(),
      photoDataUrl: null,
      createdAt: new Date().toISOString(),
    };

    onQuickAddObservation(record);
    setIsQuickAdding(false);
  };

  const colSpanCount = readOnly ? 12 : 14;

  return (
    <div className="space-y-2.5">
      {/* Bulk Selection Action Bar */}
      {!readOnly && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs">
          <span className="font-mono font-semibold text-sky-900 tabular-nums">
            {selectedIds.length} {selectedIds.length === 1 ? 'row' : 'rows'} selected
          </span>
          <div className="flex items-center gap-2">
            {confirmBulkDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onBulkDeleteObservations?.(selectedIds);
                    setSelectedIds([]);
                    setConfirmBulkDelete(false);
                  }}
                  className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  Confirm Delete ({selectedIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(false)}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete Selected
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1260px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-wide text-slate-600">
                {!readOnly && (
                  <th className="w-10 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      disabled={observations.length === 0}
                      aria-label="Select all observations"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                    />
                  </th>
                )}
                <th className="w-16 px-3 py-2.5">Plate</th>
                <th className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleSort('title')}
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-sky-700 whitespace-nowrap"
                  >
                    Title (WMO Classification) {renderSortIcon('title')}
                  </button>
                </th>
                <th className="w-28 px-3 py-2.5 whitespace-nowrap">Abbrev.</th>
                <th className="w-24 px-3 py-2.5 whitespace-nowrap">Étage</th>
                <th className="w-36 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleSort('observedAt')}
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-sky-700 whitespace-nowrap"
                  >
                    Date {renderSortIcon('observedAt')}
                  </button>
                </th>
                <th className="w-28 px-3 py-2.5 whitespace-nowrap">Person</th>
                <th className="w-28 px-3 py-2.5 whitespace-nowrap">Station</th>
                <th className="w-28 px-3 py-2.5 whitespace-nowrap">Album</th>
                <th className="w-44 px-3 py-2.5 whitespace-nowrap">Weather</th>
                <th className="w-20 px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onToggleSort('oktas')}
                    className="inline-flex items-center justify-end gap-1 font-semibold text-slate-700 hover:text-sky-700 whitespace-nowrap"
                  >
                    Oktas {renderSortIcon('oktas')}
                  </button>
                </th>
                <th className="w-32 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleSort('rating')}
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-sky-700 whitespace-nowrap"
                  >
                    Rating (0–5) {renderSortIcon('rating')}
                  </button>
                </th>
                <th className="px-3 py-2.5">Description</th>
                {!readOnly && <th className="w-24 px-3 py-2.5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {observations.length === 0 && !isQuickAdding ? (
                <tr>
                  <td colSpan={colSpanCount} className="px-6 py-14 text-center">
                    {isFilteredEmpty ? (
                      <div className="space-y-2.5">
                        <p className="text-sm font-medium text-slate-700">
                          No observations match the active search or étage filter.
                        </p>
                        {onResetFilters && (
                          <button
                            type="button"
                            onClick={onResetFilters}
                            className="rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Reset Filters
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mx-auto max-w-md space-y-3">
                        <p className="font-display text-sm font-semibold text-slate-900">
                          Observation list is blank
                        </p>
                        <p className="text-xs leading-relaxed text-slate-500">
                          Add your first sky observation row directly in the columns or open the full form with photo, weather telemetry, and AI generation.
                        </p>
                        {!readOnly && (
                          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={onAddNew}
                              className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              Add Observation
                            </button>
                            {onQuickAddObservation && (
                              <button
                                type="button"
                                onClick={startQuickAdd}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                              >
                                Quick Add Row
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={onOpenImport}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                              Import CSV / JSON
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                observations.map((obs) => {
                  const isConfirming = confirmDeleteId === obs.id;
                  const isSelected = selectedIds.includes(obs.id);
                  const weatherText = formatWeatherCompact(obs.weather);
                  return (
                    <tr
                      key={obs.id}
                      onClick={() => onSelectObservation(obs)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-sky-50/70' : 'hover:bg-sky-50/40'
                      }`}
                    >
                      {!readOnly && (
                        <td
                          className="px-3 py-2 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(obs.id)}
                            aria-label={`Select ${obs.title}`}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        {obs.photoDataUrl ? (
                          <img
                            src={obs.photoDataUrl}
                            alt={obs.title}
                            referrerPolicy="no-referrer"
                            className="h-10 w-14 border border-slate-200 object-cover"
                          />
                        ) : (
                          <CloudPlateFallback genusCode={obs.genusCode} title={obs.title} compact />
                        )}
                      </td>
                      <td className="px-3 py-2 font-display text-xs font-semibold text-slate-900">
                        {obs.title}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] font-medium text-sky-800 whitespace-nowrap">
                        {obs.abbreviation || (obs.genusCode === 'Unknown' ? '—' : obs.genusCode)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {obs.etage.split(' (')[0]}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-700 tabular-nums whitespace-nowrap">
                        {formatObservedTimestamp(obs.observedAt)}
                      </td>
                      <td className="px-3 py-2 text-slate-700 truncate max-w-[120px]">
                        {obs.observer || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]">
                        {obs.location || '—'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[120px]">
                        {obs.album || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                        {weatherText || '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {obs.oktas !== null ? `${obs.oktas}/8` : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <StarRating value={obs.rating} size="sm" />
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-slate-600">
                        {obs.description || '—'}
                      </td>
                      {!readOnly && (
                        <td
                          className="px-3 py-2 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isConfirming ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteObservation(obs.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                              >
                                Delete
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
                              aria-label={`Delete observation ${obs.title}`}
                              className="inline-flex items-center justify-center rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}

              {/* Inline Quick-Add Row */}
              {!readOnly && isQuickAdding && (
                <tr className="bg-sky-50/40">
                  <td className="px-3 py-2 text-center font-mono text-[11px] text-sky-700">+</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-400">—</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={quickTitle}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuickTitle(val);
                        const inf = inferGenusFromTitle(val);
                        const abbr = inferAbbreviationFromTitle(val, inf.genusCode);
                        if (abbr) setQuickAbbr(abbr);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveQuickAdd();
                        if (e.key === 'Escape') setIsQuickAdding(false);
                      }}
                      placeholder="Cloud name..."
                      className="w-full min-w-[160px] rounded border border-sky-400 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={quickAbbr}
                      onChange={(e) => setQuickAbbr(e.target.value)}
                      placeholder="Cu hum"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-slate-900 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500">Auto</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="datetime-local"
                      value={quickDate}
                      onChange={(e) => setQuickDate(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 font-mono text-[11px] text-slate-900"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={quickPerson}
                      onChange={(e) => setQuickPerson(e.target.value)}
                      placeholder="Observer"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={quickStation}
                      onChange={(e) => setQuickStation(e.target.value)}
                      placeholder="Station"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={quickAlbum}
                      onChange={(e) => setQuickAlbum(e.target.value)}
                      placeholder="Album"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-400">—</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      max="8"
                      value={quickOktas}
                      onChange={(e) => setQuickOktas(e.target.value)}
                      placeholder="0-8"
                      className="w-14 rounded border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs text-slate-900"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <StarRating value={quickRating} onChange={setQuickRating} size="sm" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={quickDesc}
                      onChange={(e) => setQuickDesc(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveQuickAdd();
                      }}
                      placeholder="Notes..."
                      className="w-full min-w-[140px] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!quickTitle.trim()}
                        onClick={handleSaveQuickAdd}
                        aria-label="Save quick row"
                        className="rounded bg-sky-700 p-1 text-white hover:bg-sky-800 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsQuickAdding(false)}
                        aria-label="Cancel quick row"
                        className="rounded border border-slate-300 bg-white p-1 text-slate-600 hover:bg-slate-50"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!readOnly && (observations.length > 0 || isQuickAdding) && (
          <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50/70 px-3 py-2">
            {!isQuickAdding && onQuickAddObservation && (
              <button
                type="button"
                onClick={startQuickAdd}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-900"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Quick add row
              </button>
            )}
            <button
              type="button"
              onClick={onAddNew}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Open full form (with photo, weather &amp; AI)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
