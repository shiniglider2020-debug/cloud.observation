import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Image as ImageIcon,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CloudObservation } from '../types/cloud';
import { formatObservedTimestamp, formatWeatherCompact } from '../utils/csvAndImage';
import { CloudPlateFallback } from './CloudPlateFallback';
import { StarRating } from './StarRating';

interface ObservationAlbumViewProps {
  observations: CloudObservation[];
  readOnly?: boolean;
  onSelectObservation: (obs: CloudObservation) => void;
  onDeleteObservation: (id: string) => void;
  onShareAlbum: (albumName: string, items: CloudObservation[]) => void;
  onAddNew: () => void;
}

interface AlbumCollection {
  id: string;
  name: string;
  kind: 'custom' | 'etage';
  items: CloudObservation[];
  coverPhoto: string | null;
}

export function ObservationAlbumView({
  observations,
  readOnly = false,
  onSelectObservation,
  onDeleteObservation,
  onShareAlbum,
  onAddNew,
}: ObservationAlbumViewProps) {
  const [albumSubTab, setAlbumSubTab] = useState<'photos' | 'albums'>('photos');
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(null);
  const [includeNoPhoto, setIncludeNoPhoto] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDeleteLightbox, setConfirmDeleteLightbox] = useState(false);

  const albumCollections = useMemo<AlbumCollection[]>(() => {
    const customMap = new Map<string, CloudObservation[]>();
    const etageMap = new Map<string, CloudObservation[]>();

    observations.forEach((obs) => {
      if (obs.album && obs.album.trim()) {
        const key = obs.album.trim();
        const existing = customMap.get(key) ?? [];
        existing.push(obs);
        customMap.set(key, existing);
      }
      const etageKey = obs.etage;
      const existingEtage = etageMap.get(etageKey) ?? [];
      existingEtage.push(obs);
      etageMap.set(etageKey, existingEtage);
    });

    const collections: AlbumCollection[] = [];

    customMap.forEach((items, name) => {
      const firstPhoto = items.find((i) => i.photoDataUrl)?.photoDataUrl ?? null;
      collections.push({
        id: `custom:${name}`,
        name,
        kind: 'custom',
        items,
        coverPhoto: firstPhoto,
      });
    });

    etageMap.forEach((items, name) => {
      const firstPhoto = items.find((i) => i.photoDataUrl)?.photoDataUrl ?? null;
      collections.push({
        id: `etage:${name}`,
        name,
        kind: 'etage',
        items,
        coverPhoto: firstPhoto,
      });
    });

    return collections;
  }, [observations]);

  const activeCollection = useMemo(
    () => albumCollections.find((c) => c.id === activeAlbumId) ?? null,
    [albumCollections, activeAlbumId]
  );

  const displayedItems = useMemo(() => {
    const source = activeCollection ? activeCollection.items : observations;
    if (includeNoPhoto) return source;
    return source.filter((item) => Boolean(item.photoDataUrl));
  }, [activeCollection, observations, includeNoPhoto]);

  useEffect(() => {
    setConfirmDeleteLightbox(false);
  }, [lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % displayedItems.length
        );
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + displayedItems.length) % displayedItems.length
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, displayedItems.length]);

  const activeLightboxObs =
    lightboxIndex !== null && displayedItems[lightboxIndex]
      ? displayedItems[lightboxIndex]
      : null;

  if (observations.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-10 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sky-700">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-3 font-display text-base font-bold text-slate-900">
          Sky Photo Album is Blank
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
          Upload sky photographs (or generate AI sky plates) when logging cloud observations to browse them here as a Photos-style gallery and organized albums.
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={onAddNew}
            className="mt-5 rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
          >
            Add Observation with Photo
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Album Sub-Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          {activeCollection ? (
            <button
              type="button"
              onClick={() => setActiveAlbumId(null)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              All Albums
            </button>
          ) : (
            <div className="inline-flex items-center rounded-md bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setAlbumSubTab('photos')}
                className={`rounded px-3 py-1 font-medium whitespace-nowrap transition-colors ${
                  albumSubTab === 'photos'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Photo Stream
              </button>
              <button
                type="button"
                onClick={() => setAlbumSubTab('albums')}
                className={`rounded px-3 py-1 font-medium whitespace-nowrap transition-colors ${
                  albumSubTab === 'albums'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Albums ({albumCollections.length})
              </button>
            </div>
          )}

          {activeCollection && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span aria-hidden="true">/</span>
              <span className="font-display font-semibold text-slate-900">
                {activeCollection.name}
              </span>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                ({activeCollection.items.length})
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(albumSubTab === 'photos' || activeCollection) && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600 select-none">
              <input
                type="checkbox"
                checked={includeNoPhoto}
                onChange={(e) => setIncludeNoPhoto(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
              />
              Include entries without photo
            </label>
          )}

          {activeCollection && (
            <button
              type="button"
              onClick={() => onShareAlbum(activeCollection.name, activeCollection.items)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
              Share Album
            </button>
          )}

          {!readOnly && (
            <button
              type="button"
              onClick={onAddNew}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add Photo
            </button>
          )}
        </div>
      </div>

      {/* Albums Folder Grid */}
      {!activeCollection && albumSubTab === 'albums' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {albumCollections.map((collection) => {
            const photoCount = collection.items.filter((i) => Boolean(i.photoDataUrl)).length;
            return (
              <div
                key={collection.id}
                onClick={() => setActiveAlbumId(collection.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveAlbumId(collection.id);
                  }
                }}
                tabIndex={0}
                role="button"
                className="group cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-sky-600/60"
              >
                <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-200 bg-slate-100">
                  {collection.coverPhoto ? (
                    <img
                      src={collection.coverPhoto}
                      alt={collection.name}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400">
                      <FolderOpen className="h-7 w-7" aria-hidden="true" />
                      <span className="text-[11px] font-medium">No cover plate yet</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-slate-500">
                      {collection.kind === 'custom' ? 'Custom Album' : 'Étage Collection'}
                    </div>
                    <h3 className="mt-0.5 truncate font-display text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                      {collection.name}
                    </h3>
                    <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                      {collection.items.length} entries · {photoCount} photos
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShareAlbum(collection.name, collection.items);
                    }}
                    aria-label={`Share album ${collection.name}`}
                    className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-sky-700"
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            No sky photographs in this view yet.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Upload photos to your observations or enable &ldquo;Include entries without photo&rdquo; above.
          </p>
        </div>
      ) : (
        /* Photos-app Style Photo Stream Grid */
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {displayedItems.map((obs, index) => (
            <button
              key={obs.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              {obs.photoDataUrl ? (
                <img
                  src={obs.photoDataUrl}
                  alt={obs.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
              ) : (
                <CloudPlateFallback genusCode={obs.genusCode} title={obs.title} />
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent p-3 pt-8 text-white opacity-95 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                <div className="truncate font-display text-xs font-semibold">
                  {obs.title}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[10px] text-slate-200 tabular-nums">
                  <span>{formatObservedTimestamp(obs.observedAt)}</span>
                  <span>{obs.abbreviation || obs.genusCode}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Photos Lightbox Viewer */}
      {activeLightboxObs && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-white"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo lightbox for ${activeLightboxObs.title}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                {lightboxIndex + 1} / {displayedItems.length} ·{' '}
                {formatObservedTimestamp(activeLightboxObs.observedAt)}
                {activeLightboxObs.album ? ` · Album: ${activeLightboxObs.album}` : ''}
              </div>
              <h3 className="truncate font-display text-sm font-semibold text-white">
                {activeLightboxObs.title}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!readOnly && (
                confirmDeleteLightbox ? (
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = activeLightboxObs.id;
                        setLightboxIndex(null);
                        onDeleteObservation(targetId);
                      }}
                      className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteLightbox(false)}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteLightbox(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-slate-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => onShareAlbum(activeLightboxObs.title, [activeLightboxObs])}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                Share
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = activeLightboxObs;
                  setLightboxIndex(null);
                  onSelectObservation(target);
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Inspect Details
              </button>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Close photo lightbox"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-8">
            {displayedItems.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex(
                    (lightboxIndex - 1 + displayedItems.length) % displayedItems.length
                  )
                }
                aria-label="Previous sky photo"
                className="absolute left-3 z-10 rounded-full border border-slate-700 bg-slate-900/80 p-2.5 text-white transition-colors hover:bg-slate-800"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            {activeLightboxObs.photoDataUrl ? (
              <img
                src={activeLightboxObs.photoDataUrl}
                alt={activeLightboxObs.title}
                className="max-h-full max-w-full rounded object-contain"
              />
            ) : (
              <div className="h-80 w-full max-w-lg overflow-hidden rounded-lg border border-slate-800">
                <CloudPlateFallback
                  genusCode={activeLightboxObs.genusCode}
                  title={activeLightboxObs.title}
                />
              </div>
            )}

            {displayedItems.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((lightboxIndex + 1) % displayedItems.length)
                }
                aria-label="Next sky photo"
                className="absolute right-3 z-10 rounded-full border border-slate-700 bg-slate-900/80 p-2.5 text-white transition-colors hover:bg-slate-800"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="border-t border-slate-800 bg-slate-900/70 px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sky-400">
                  {activeLightboxObs.abbreviation || activeLightboxObs.genusCode}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeLightboxObs.etage}</span>
                <span aria-hidden="true">·</span>
                <span>Observer: {activeLightboxObs.observer || '—'}</span>
                {activeLightboxObs.oktas !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {activeLightboxObs.oktas}/8 oktas
                    </span>
                  </>
                )}
                {formatWeatherCompact(activeLightboxObs.weather) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-200 tabular-nums">
                      {formatWeatherCompact(activeLightboxObs.weather)}
                    </span>
                  </>
                )}
              </div>
              <div className="rounded bg-white px-2 py-0.5">
                <StarRating value={activeLightboxObs.rating} size="sm" />
              </div>
            </div>
            {activeLightboxObs.description && (
              <p className="mx-auto mt-1.5 max-w-5xl text-xs leading-relaxed text-slate-300">
                {activeLightboxObs.description}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
