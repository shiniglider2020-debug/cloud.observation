/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ArrowLeft,
  Cloud,
  Download,
  Images,
  LayoutGrid,
  ListTree,
  Loader2,
  Lock,
  Plus,
  Search,
  Share2,
  Sparkles,
  Table2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AiSummaryPanel } from './components/AiSummaryPanel';
import { DataTransferView } from './components/DataTransferView';
import { ObservationAlbumView } from './components/ObservationAlbumView';
import { ObservationDetailModal } from './components/ObservationDetailModal';
import { ObservationFormDrawer } from './components/ObservationFormDrawer';
import { ObservationGalleryView } from './components/ObservationGalleryView';
import { ObservationGridView } from './components/ObservationGridView';
import { ObservationTimelineView } from './components/ObservationTimelineView';
import { ShareModal } from './components/ShareModal';
import { TelemetryStrip } from './components/TelemetryStrip';
import { TopBar } from './components/TopBar';
import { WmoTaxonomyView } from './components/WmoTaxonomyView';
import type {
  AiSummaryReport,
  CloudEtage,
  CloudObservation,
  GenusCode,
  SharedLedgerPayload,
  SortDirection,
  SortField,
  ViewMode,
  WorkspaceTab,
} from './types/cloud';

const STORAGE_KEY = 'nephos_observations_v1';
const LAST_OBSERVER_KEY = 'nephos_last_observer_v1';

type EtageFilter = 'All' | 'High' | 'Middle' | 'Low' | 'Vertical';

const ETAGE_FILTERS: Array<{ id: EtageFilter; label: string; match?: CloudEtage }> = [
  { id: 'All', label: 'All' },
  { id: 'High', label: 'High (CH)', match: 'High (CH > 6 km)' },
  { id: 'Middle', label: 'Middle (CM)', match: 'Middle (CM 2–6 km)' },
  { id: 'Low', label: 'Low (CL)', match: 'Low (CL < 2 km)' },
  { id: 'Vertical', label: 'Vertical', match: 'Vertical (Multi-level)' },
];

function loadSavedObservations(): CloudObservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface PasscodeChallenge {
  shareId: string;
  title: string;
  sharedBy: string;
  count: number;
  error?: string;
}

export default function App() {
  const [observations, setObservations] = useState<CloudObservation[]>(() =>
    loadSavedObservations()
  );
  const [lastObserver, setLastObserver] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_OBSERVER_KEY) || '';
    } catch {
      return '';
    }
  });

  const [sharedLedger, setSharedLedger] = useState<SharedLedgerPayload | null>(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [passcodeChallenge, setPasscodeChallenge] = useState<PasscodeChallenge | null>(null);
  const [unlockPasscode, setUnlockPasscode] = useState('');

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('observations');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [etageFilter, setEtageFilter] = useState<EtageFilter>('All');
  const [sortField, setSortField] = useState<SortField>('observedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingObservation, setEditingObservation] = useState<CloudObservation | null>(null);
  const [defaultGenusForNew, setDefaultGenusForNew] = useState<GenusCode | null>(null);
  const [inspectingObservation, setInspectingObservation] = useState<CloudObservation | null>(null);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [sharePresetTitle, setSharePresetTitle] = useState<string | undefined>(undefined);
  const [sharePresetItems, setSharePresetItems] = useState<CloudObservation[] | null>(null);

  const [aiReport, setAiReport] = useState<AiSummaryReport | null>(null);

  const fetchSharedLedger = async (shareId: string, passcode?: string) => {
    setSharedLoading(true);
    setSharedError(null);
    try {
      const headers: Record<string, string> = {};
      if (passcode) {
        headers['x-share-passcode'] = passcode;
      }
      const res = await fetch(`/api/shares/${encodeURIComponent(shareId)}`, { headers });
      const data = await res.json();
      if (res.status === 401 && data.requiresPasscode) {
        setPasscodeChallenge({
          shareId,
          title: data.title || 'Private Cloud Observation Ledger',
          sharedBy: data.sharedBy || 'Observer',
          count: data.count || 0,
          error: passcode ? data.error : undefined,
        });
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Shared observation list not found.');
      }
      setPasscodeChallenge(null);
      setUnlockPasscode('');
      setSharedLedger(data as SharedLedgerPayload);
    } catch (err) {
      setSharedError(
        err instanceof Error ? err.message : 'Unable to load shared observation list.'
      );
    } finally {
      setSharedLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    if (!shareId) return;
    fetchSharedLedger(shareId);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(observations));
    } catch {
      // Ignore quota errors cleanly
    }
  }, [observations]);

  const activeObservations = sharedLedger ? sharedLedger.observations : observations;
  const activeAiReport = sharedLedger ? sharedLedger.summaryReport : aiReport;
  const isViewingShared = Boolean(sharedLedger);

  const existingAlbums = useMemo(() => {
    const set = new Set<string>();
    observations.forEach((o) => {
      if (o.album && o.album.trim()) set.add(o.album.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [observations]);

  const filteredObservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const etageDef = ETAGE_FILTERS.find((f) => f.id === etageFilter);

    const filtered = activeObservations.filter((obs) => {
      if (etageDef?.match && obs.etage !== etageDef.match) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        obs.title,
        obs.abbreviation,
        obs.genusCode,
        obs.etage,
        obs.observer,
        obs.location,
        obs.album,
        obs.description,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'observedAt') {
        cmp = new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime();
      } else if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (sortField === 'rating') {
        cmp = a.rating - b.rating;
      } else if (sortField === 'oktas') {
        cmp = (a.oktas ?? -1) - (b.oktas ?? -1);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [activeObservations, searchQuery, etageFilter, sortField, sortDirection]);

  const handleOpenNewObservation = (genus?: GenusCode) => {
    if (isViewingShared || passcodeChallenge) {
      handleExitSharedView();
    }
    setEditingObservation(null);
    setDefaultGenusForNew(genus ?? null);
    setIsFormOpen(true);
  };

  const handleSaveObservation = (record: CloudObservation) => {
    setObservations((prev) => {
      const exists = prev.some((item) => item.id === record.id);
      if (exists) {
        return prev.map((item) => (item.id === record.id ? record : item));
      }
      return [record, ...prev];
    });
    if (record.observer && record.observer !== '-') {
      setLastObserver(record.observer);
      try {
        localStorage.setItem(LAST_OBSERVER_KEY, record.observer);
      } catch {
        // Ignore
      }
    }
    setActiveTab('observations');
  };

  const handleDeleteObservation = (id: string) => {
    setObservations((prev) => prev.filter((item) => item.id !== id));
  };

  const handleBulkDeleteObservations = (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setObservations((prev) => prev.filter((item) => !idSet.has(item.id)));
  };

  const handleQuickAddObservation = (record: CloudObservation) => {
    handleSaveObservation(record);
  };

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'title' ? 'asc' : 'desc');
    }
  };

  const handleImportObservations = (items: CloudObservation[]) => {
    setObservations((prev) => [...items, ...prev]);
  };

  const handleClearAll = () => {
    setObservations([]);
    setAiReport(null);
    setSearchQuery('');
    setEtageFilter('All');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setEtageFilter('All');
  };

  const handleOpenShare = (presetTitle?: string, presetItems?: CloudObservation[]) => {
    setSharePresetTitle(presetTitle);
    setSharePresetItems(presetItems ?? null);
    setIsShareOpen(true);
  };

  const handleExitSharedView = () => {
    setSharedLedger(null);
    setSharedError(null);
    setPasscodeChallenge(null);
    setUnlockPasscode('');
    const url = new URL(window.location.href);
    url.searchParams.delete('share');
    window.history.replaceState({}, '', url.toString());
  };

  const handleImportSharedCopy = () => {
    if (!sharedLedger) return;
    const copied = sharedLedger.observations.map((obs, idx) => ({
      ...obs,
      id: `shared-copy-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    }));
    setObservations((prev) => [...copied, ...prev]);
    if (sharedLedger.summaryReport) {
      setAiReport(sharedLedger.summaryReport);
    }
    handleExitSharedView();
    setActiveTab('observations');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onNewObservation={() => handleOpenNewObservation()}
      />

      {sharedLoading && (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-xs font-medium text-sky-900">
          <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Loading shared cloud observation ledger...
        </div>
      )}

      {sharedError && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2.5">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 text-xs text-rose-800 sm:px-2">
            <span>{sharedError}</span>
            <button
              type="button"
              onClick={handleExitSharedView}
              className="font-semibold underline hover:text-rose-950 whitespace-nowrap"
            >
              Return to My Ledger
            </button>
          </div>
        </div>
      )}

      {sharedLedger && (
        <div className="border-b border-sky-200 bg-sky-50/80 px-4 py-3">
          <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-3 sm:flex-row sm:items-center sm:px-2">
            <div className="text-xs text-sky-950">
              <span className="font-display font-semibold">{sharedLedger.title}</span>
              <span className="mx-2 text-sky-400" aria-hidden="true">
                ·
              </span>
              <span>Shared by {sharedLedger.sharedBy}</span>
              <span className="mx-2 text-sky-400" aria-hidden="true">
                ·
              </span>
              <span className="font-mono tabular-nums">
                {sharedLedger.observations.length} observations
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleImportSharedCopy}
                className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Save Copy to My List
              </button>
              <button
                type="button"
                onClick={handleExitSharedView}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to My List
              </button>
            </div>
          </div>
        </div>
      )}

      <TelemetryStrip
        totalCount={activeObservations.length}
        filteredCount={filteredObservations.length}
        observations={activeObservations}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
        {passcodeChallenge ? (
          <section className="mx-auto mt-8 max-w-md rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2.5 text-sky-800">
              <Lock className="h-5 w-5" aria-hidden="true" />
              <h1 className="font-display text-base font-bold text-slate-900">
                Passcode Required
              </h1>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">{passcodeChallenge.title}</span>{' '}
              ({passcodeChallenge.count} entries, shared by {passcodeChallenge.sharedBy}) is protected by an access passcode.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!unlockPasscode.trim()) return;
                fetchSharedLedger(passcodeChallenge.shareId, unlockPasscode.trim());
              }}
              className="mt-4 space-y-3"
            >
              {passcodeChallenge.error && (
                <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {passcodeChallenge.error}
                </div>
              )}
              <input
                type="password"
                value={unlockPasscode}
                onChange={(e) => setUnlockPasscode(e.target.value)}
                placeholder="Enter passcode..."
                aria-label="Share link passcode"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleExitSharedView}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Cancel &amp; return to my list
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
                >
                  Unlock List
                </button>
              </div>
            </form>
          </section>
        ) : (
          <>
            {activeTab === 'observations' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-1 flex-wrap items-center gap-2.5">
                    <div className="relative min-w-[210px] flex-1 sm:max-w-xs">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter by genus, abbr, album, observer..."
                        aria-label="Search cloud observations"
                        className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                      />
                    </div>

                    <div
                      role="group"
                      aria-label="Filter by cloud étage"
                      className="flex flex-wrap items-center gap-1 rounded-md bg-slate-100 p-1"
                    >
                      {ETAGE_FILTERS.map((item) => {
                        const active = etageFilter === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setEtageFilter(item.id)}
                            className={`rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                              active
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 xl:justify-end">
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor="sort-select"
                        className="text-xs text-slate-500 whitespace-nowrap"
                      >
                        Sort:
                      </label>
                      <select
                        id="sort-select"
                        value={`${sortField}:${sortDirection}`}
                        onChange={(e) => {
                          const [field, dir] = e.target.value.split(':') as [
                            SortField,
                            SortDirection,
                          ];
                          setSortField(field);
                          setSortDirection(dir);
                        }}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-sky-600 focus:outline-none"
                      >
                        <option value="observedAt:desc">Date (Newest)</option>
                        <option value="observedAt:asc">Date (Oldest)</option>
                        <option value="title:asc">Title (A–Z)</option>
                        <option value="rating:desc">Rating (High–Low)</option>
                        <option value="oktas:desc">Sky Cover (High–Low)</option>
                      </select>
                    </div>

                    <div
                      role="group"
                      aria-label="List view mode"
                      className="inline-flex items-center rounded-md bg-slate-100 p-1"
                    >
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                          viewMode === 'grid'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Columns
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('gallery')}
                        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                          viewMode === 'gallery'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                        Gallery
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('album')}
                        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                          viewMode === 'album'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Images className="h-3.5 w-3.5" aria-hidden="true" />
                        Album
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('timeline')}
                        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                          viewMode === 'timeline'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
                        Timeline
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={activeObservations.length === 0}
                        onClick={() => handleOpenShare()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Share
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('summary')}
                        className="inline-flex items-center gap-1.5 rounded-md border border-sky-700 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 whitespace-nowrap shrink-0"
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        AI Summarize
                      </button>
                    </div>
                  </div>
                </div>

                {viewMode === 'grid' ? (
                  <ObservationGridView
                    observations={filteredObservations}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    readOnly={isViewingShared}
                    lastObserver={lastObserver}
                    onToggleSort={handleToggleSort}
                    onSelectObservation={setInspectingObservation}
                    onDeleteObservation={handleDeleteObservation}
                    onBulkDeleteObservations={handleBulkDeleteObservations}
                    onQuickAddObservation={handleQuickAddObservation}
                    onAddNew={() => handleOpenNewObservation()}
                    onOpenImport={() => setActiveTab('import-export')}
                    isFilteredEmpty={
                      activeObservations.length > 0 && filteredObservations.length === 0
                    }
                    onResetFilters={resetFilters}
                  />
                ) : viewMode === 'album' ? (
                  <ObservationAlbumView
                    observations={filteredObservations}
                    readOnly={isViewingShared}
                    onSelectObservation={setInspectingObservation}
                    onDeleteObservation={handleDeleteObservation}
                    onShareAlbum={(albumName, items) => handleOpenShare(albumName, items)}
                    onAddNew={() => handleOpenNewObservation()}
                  />
                ) : filteredObservations.length === 0 ? (
                  <section className="rounded-lg border border-slate-200 bg-white p-10 text-center">
                    {activeObservations.length > 0 ? (
                      <>
                        <p className="text-sm font-medium text-slate-800">
                          No observations match your active search or étage filter.
                        </p>
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="mt-3 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Reset Filters
                        </button>
                      </>
                    ) : (
                      <div className="mx-auto max-w-md space-y-3">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sky-700">
                          <Cloud className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <h1 className="font-display text-base font-bold text-slate-900">
                          Observation list is blank
                        </h1>
                        <p className="text-xs leading-relaxed text-slate-600">
                          Log your first cloud specimen or import an existing CSV / JSON list.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleOpenNewObservation()}
                            className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Add Observation
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('import-export')}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                            Import CSV / JSON
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                ) : viewMode === 'gallery' ? (
                  <ObservationGalleryView
                    observations={filteredObservations}
                    readOnly={isViewingShared}
                    onSelectObservation={setInspectingObservation}
                    onDeleteObservation={handleDeleteObservation}
                    onAddNew={() => handleOpenNewObservation()}
                  />
                ) : (
                  <ObservationTimelineView
                    observations={filteredObservations}
                    readOnly={isViewingShared}
                    onSelectObservation={setInspectingObservation}
                    onDeleteObservation={handleDeleteObservation}
                    onAddNew={() => handleOpenNewObservation()}
                  />
                )}
              </div>
            )}

            {activeTab === 'summary' && (
              <AiSummaryPanel
                allObservations={activeObservations}
                filteredObservations={filteredObservations}
                report={activeAiReport}
                onReportGenerated={setAiReport}
                onOpenNewObservation={() => handleOpenNewObservation()}
              />
            )}

            {activeTab === 'taxonomy' && (
              <WmoTaxonomyView onLogGenus={(code) => handleOpenNewObservation(code)} />
            )}

            {activeTab === 'import-export' && (
              <DataTransferView
                observations={observations}
                onImportObservations={handleImportObservations}
                onClearAll={handleClearAll}
                onReturnToObservations={() => setActiveTab('observations')}
              />
            )}
          </>
        )}
      </main>

      <ObservationFormDrawer
        isOpen={isFormOpen}
        editingObservation={editingObservation}
        defaultGenus={defaultGenusForNew}
        lastObserver={lastObserver}
        existingAlbums={existingAlbums}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveObservation}
      />

      <ObservationDetailModal
        observation={inspectingObservation}
        readOnly={isViewingShared}
        onClose={() => setInspectingObservation(null)}
        onEdit={(obs) => {
          setEditingObservation(obs);
          setDefaultGenusForNew(null);
          setIsFormOpen(true);
        }}
        onDelete={handleDeleteObservation}
        onShare={(obs) => handleOpenShare(obs.title, [obs])}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        allObservations={activeObservations}
        filteredObservations={filteredObservations}
        aiReport={activeAiReport}
        defaultAuthor={lastObserver}
        presetTitle={sharePresetTitle}
        presetObservations={sharePresetItems}
      />
    </div>
  );
}
