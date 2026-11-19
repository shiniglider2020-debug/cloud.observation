import type { AiSummaryReport, CloudObservation, ViewMode } from '../types/cloud';

const LEGACY_OBS_KEY = 'nephos_observations_v1';
const LEGACY_OBSERVER_KEY = 'nephos_last_observer_v1';
const LOCAL_ENVELOPE_KEY = 'nephos_ledger_v2';
const VIEW_MODE_KEY = 'nephos_view_mode_v1';

const IDB_NAME = 'nephos_ledger_db';
const IDB_VERSION = 1;
const IDB_STORE = 'ledger';
const IDB_RECORD_KEY = 'primary';

export interface PersistedLedgerSnapshot {
  updatedAt: string | null;
  observations: CloudObservation[];
  aiReport: AiSummaryReport | null;
  lastObserver: string;
}

function normalizeSnapshot(raw: unknown): PersistedLedgerSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.observations)) return null;
  return {
    updatedAt: typeof obj.updatedAt === 'string' && obj.updatedAt ? obj.updatedAt : null,
    observations: obj.observations as CloudObservation[],
    aiReport: (obj.aiReport as AiSummaryReport | null) ?? null,
    lastObserver: typeof obj.lastObserver === 'string' ? obj.lastObserver : '',
  };
}

export function loadLocalSnapshotSync(): PersistedLedgerSnapshot {
  try {
    const rawEnvelope = localStorage.getItem(LOCAL_ENVELOPE_KEY);
    if (rawEnvelope) {
      const parsed = normalizeSnapshot(JSON.parse(rawEnvelope));
      if (parsed) return parsed;
    }

    // Legacy v1 migration
    const legacyObsRaw = localStorage.getItem(LEGACY_OBS_KEY);
    const legacyObserver = localStorage.getItem(LEGACY_OBSERVER_KEY) || '';
    if (legacyObsRaw) {
      const parsedObs = JSON.parse(legacyObsRaw);
      if (Array.isArray(parsedObs) && parsedObs.length > 0) {
        return {
          updatedAt: null,
          observations: parsedObs as CloudObservation[],
          aiReport: null,
          lastObserver: legacyObserver,
        };
      }
    }

    return {
      updatedAt: null,
      observations: [],
      aiReport: null,
      lastObserver: legacyObserver,
    };
  } catch {
    return {
      updatedAt: null,
      observations: [],
      aiReport: null,
      lastObserver: '',
    };
  }
}

export function saveLocalSnapshotSync(snapshot: PersistedLedgerSnapshot): void {
  try {
    localStorage.setItem(LOCAL_ENVELOPE_KEY, JSON.stringify(snapshot));
    localStorage.setItem(LEGACY_OBS_KEY, JSON.stringify(snapshot.observations));
    if (snapshot.lastObserver) {
      localStorage.setItem(LEGACY_OBSERVER_KEY, snapshot.lastObserver);
    }
  } catch {
    // QuotaExceededError or restricted storage in iframe — IndexedDB & server still persist full data
    try {
      if (snapshot.lastObserver) {
        localStorage.setItem(LEGACY_OBSERVER_KEY, snapshot.lastObserver);
      }
    } catch {
      // Ignore
    }
  }
}

function openLedgerDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadIdbSnapshot(): Promise<PersistedLedgerSnapshot | null> {
  try {
    const db = await openLedgerDb();
    return await new Promise<PersistedLedgerSnapshot | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_RECORD_KEY);
      req.onsuccess = () => {
        resolve(normalizeSnapshot(req.result));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveIdbSnapshot(snapshot: PersistedLedgerSnapshot): Promise<void> {
  try {
    const db = await openLedgerDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(snapshot, IDB_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB failure
  }
}

export async function loadServerSnapshot(): Promise<PersistedLedgerSnapshot | null> {
  try {
    const res = await fetch('/api/ledger', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeSnapshot(data);
  } catch {
    return null;
  }
}

export async function saveServerSnapshot(snapshot: PersistedLedgerSnapshot): Promise<void> {
  try {
    await fetch('/api/ledger', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
  } catch {
    // Offline or transient failure — local/IndexedDB backup retained
  }
}

function getTimestampMs(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function pickLatestSnapshot(
  candidates: Array<PersistedLedgerSnapshot | null | undefined>
): PersistedLedgerSnapshot {
  const valid = candidates.filter((c): c is PersistedLedgerSnapshot => Boolean(c));
  if (valid.length === 0) {
    return { updatedAt: null, observations: [], aiReport: null, lastObserver: '' };
  }

  let best = valid[0];
  for (let i = 1; i < valid.length; i++) {
    const candidate = valid[i];
    const bestTime = getTimestampMs(best.updatedAt);
    const candTime = getTimestampMs(candidate.updatedAt);

    if (candTime > bestTime) {
      best = candidate;
    } else if (candTime === bestTime) {
      // If neither has a timestamp (e.g. legacy localStorage vs blank server), prefer whichever has data
      if (candidate.observations.length > best.observations.length) {
        best = candidate;
      } else if (!best.aiReport && candidate.aiReport) {
        best = candidate;
      }
    }
  }
  return best;
}

export async function hydrateLedgerFromAllStores(
  localSnapshot: PersistedLedgerSnapshot
): Promise<{
  winner: PersistedLedgerSnapshot;
  needsBackfill: boolean;
}> {
  const [idbSnapshot, serverSnapshot] = await Promise.all([
    loadIdbSnapshot(),
    loadServerSnapshot(),
  ]);

  const winner = pickLatestSnapshot([localSnapshot, idbSnapshot, serverSnapshot]);

  // If legacy local data existed without updatedAt or stores are out of sync, backfill
  const winnerTime = getTimestampMs(winner.updatedAt);
  const needsBackfill =
    (winner.observations.length > 0 && winnerTime === 0) ||
    getTimestampMs(serverSnapshot?.updatedAt ?? null) < winnerTime ||
    getTimestampMs(idbSnapshot?.updatedAt ?? null) < winnerTime;

  return { winner, needsBackfill };
}

export async function persistLedgerToAllStores(
  snapshot: PersistedLedgerSnapshot
): Promise<void> {
  saveLocalSnapshotSync(snapshot);
  await Promise.all([saveIdbSnapshot(snapshot), saveServerSnapshot(snapshot)]);
}

export function loadSavedViewMode(): ViewMode {
  try {
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    if (raw === 'grid' || raw === 'gallery' || raw === 'album' || raw === 'timeline') {
      return raw;
    }
  } catch {
    // Ignore
  }
  return 'grid';
}

export function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // Ignore
  }
}
