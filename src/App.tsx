/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ArrowLeft,
  Check,
  Cloud,
  Copy,
  Download,
  Images,
  LayoutGrid,
  ListTree,
  Loader2,
  Lock,
  Plus,
  Radio,
  Search,
  Share2,
  Sparkles,
  Table2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiSummaryPanel } from './components/AiSummaryPanel';
import { DataTransferView } from './components/DataTransferView';
import { LiveSessionPanel } from './components/LiveSessionPanel';
import { ObservationAlbumView } from './components/ObservationAlbumView';
import { ObservationDetailModal } from './components/ObservationDetailModal';
import { ObservationFormDrawer } from './components/ObservationFormDrawer';
import { ObservationGalleryView } from './components/ObservationGalleryView';
import { ObservationGridView } from './components/ObservationGridView';
import type { DraftBroadcast } from './components/ObservationGridView';
import { ObservationTimelineView } from './components/ObservationTimelineView';
import { resolvePublicLiveUrl, ShareModal } from './components/ShareModal';
import { TelemetryStrip } from './components/TelemetryStrip';
import { TopBar } from './components/TopBar';
import { WmoTaxonomyView } from './components/WmoTaxonomyView';
import type {
  AiSummaryReport,
  CloudEtage,
  CloudObservation,
  GenusCode,
  LiveDraftState,
  LiveRoomState,
  LiveStreamNote,
  LiveWriterDraft,
  SharedLedgerPayload,
  SortDirection,
  SortField,
  ViewMode,
  WorkspaceTab,
} from './types/cloud';
import {
  hydrateLedgerFromAllStores,
  loadLocalSnapshotSync,
  loadSavedViewMode,
  persistLedgerToAllStores,
  saveViewMode,
} from './utils/ledgerStorage';

type EtageFilter = 'All' | 'High' | 'Middle' | 'Low' | 'Vertical';

const ETAGE_FILTERS: Array<{ id: EtageFilter; label: string; match?: CloudEtage }> = [
  { id: 'All', label: 'All' },
  { id: 'High', label: 'High (CH)', match: 'High (CH > 6 km)' },
  { id: 'Middle', label: 'Middle (CM)', match: 'Middle (CM 2–6 km)' },
  { id: 'Low', label: 'Low (CL)', match: 'Low (CL < 2 km)' },
  { id: 'Vertical', label: 'Vertical', match: 'Vertical (Multi-level)' },
];

interface PasscodeChallenge {
  shareId: string;
  title: string;
  sharedBy: string;
  count: number;
  error?: string;
}

interface LivePasscodeChallenge {
  liveId: string;
  title: string;
  hostName: string;
  error?: string;
}

interface LiveWritingDraftInput {
  cloudName: string;
  abbreviation: string;
  text: string;
  source: string;
}

export default function App() {
  const initialLocalSnapshotRef = useRef(loadLocalSnapshotSync());
  const userMutatedRef = useRef(false);

  const [observations, setObservations] = useState<CloudObservation[]>(
    () => initialLocalSnapshotRef.current.observations
  );
  const [lastObserver, setLastObserver] = useState<string>(
    () => initialLocalSnapshotRef.current.lastObserver
  );

  // Live Real-Time Writing Session state (completely separate from saved entries)
  const [liveRoomId, setLiveRoomId] = useState<string | null>(null);
  const [liveRoom, setLiveRoom] = useState<LiveRoomState | null>(null);
  const [liveConnected, setLiveConnected] = useState<boolean>(false);
  const [liveClientId, setLiveClientId] = useState<string | null>(null);
  const [livePasscode, setLivePasscode] = useState<string>('');
  const [liveHints, setLiveHints] = useState<{ title?: string; host?: string }>({});
  const [liveShareUrl, setLiveShareUrl] = useState<string>('');
  const [isLiveGuestView, setIsLiveGuestView] = useState<boolean>(false);
  const [liveLoading, setLiveLoading] = useState<boolean>(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [livePasscodeChallenge, setLivePasscodeChallenge] =
    useState<LivePasscodeChallenge | null>(null);
  const [liveUnlockPasscode, setLiveUnlockPasscode] = useState<string>('');

  const liveWsRef = useRef<WebSocket | null>(null);
  const liveClientIdRef = useRef<string | null>(null);
  const liveWritingThrottleRef = useRef<number | null>(null);
  const latestLiveWritingRef = useRef<LiveWritingDraftInput | null>(null);
  const livePadThrottleRef = useRef<number | null>(null);
  const latestLivePadRef = useRef<string | null>(null);

  const [sharedLedger, setSharedLedger] = useState<SharedLedgerPayload | null>(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [sharedPasscode, setSharedPasscode] = useState<string>('');
  const [collaboratorsCount, setCollaboratorsCount] = useState<number>(1);
  const [shareLiveConnected, setShareLiveConnected] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);
  const [liveDrafts, setLiveDrafts] = useState<LiveDraftState[]>([]);
  const [passcodeChallenge, setPasscodeChallenge] = useState<PasscodeChallenge | null>(null);
  const [unlockPasscode, setUnlockPasscode] = useState('');

  const shareWsRef = useRef<WebSocket | null>(null);
  const myClientIdRef = useRef<string | null>(null);
  const draftThrottleTimerRef = useRef<number | null>(null);
  const latestDraftRef = useRef<DraftBroadcast | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('observations');
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadSavedViewMode());
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

  const [aiReport, setAiReport] = useState<AiSummaryReport | null>(
    () => initialLocalSnapshotRef.current.aiReport
  );

  const observationsRef = useRef<CloudObservation[]>(observations);
  const aiReportRef = useRef<AiSummaryReport | null>(aiReport);
  const lastObserverRef = useRef<string>(lastObserver);
  observationsRef.current = observations;
  aiReportRef.current = aiReport;
  lastObserverRef.current = lastObserver;

  const commitLedgerUpdate = (
    nextObservations: CloudObservation[],
    nextAiReport: AiSummaryReport | null = aiReportRef.current,
    nextObserver: string = lastObserverRef.current
  ) => {
    userMutatedRef.current = true;
    observationsRef.current = nextObservations;
    aiReportRef.current = nextAiReport;
    lastObserverRef.current = nextObserver;

    setObservations(nextObservations);
    setAiReport(nextAiReport);
    setLastObserver(nextObserver);

    void persistLedgerToAllStores({
      updatedAt: new Date().toISOString(),
      observations: nextObservations,
      aiReport: nextAiReport,
      lastObserver: nextObserver,
    });
  };

  const fetchSharedLedger = useCallback(async (shareId: string, passcode?: string) => {
    setSharedLoading(true);
    setSharedError(null);

    let effectivePasscode = passcode;
    if (!effectivePasscode) {
      try {
        effectivePasscode = sessionStorage.getItem(`nephos_share_pass_${shareId}`) || undefined;
      } catch {
        // Ignore sessionStorage restrictions
      }
    }

    try {
      const headers: Record<string, string> = {};
      if (effectivePasscode) {
        headers['x-share-passcode'] = effectivePasscode;
      }
      const res = await fetch(`/api/shares/${encodeURIComponent(shareId)}`, {
        headers,
        cache: 'no-store',
      });
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
      if (effectivePasscode) {
        try {
          sessionStorage.setItem(`nephos_share_pass_${shareId}`, effectivePasscode);
        } catch {
          // Ignore
        }
      }
      setSharedPasscode(effectivePasscode || '');
      setPasscodeChallenge(null);
      setUnlockPasscode('');
      setSharedLedger({
        ...(data as SharedLedgerPayload),
        collaborative: Boolean(data.collaborative),
      });
      setActiveTab('observations');
    } catch (err) {
      setSharedError(
        err instanceof Error ? err.message : 'Unable to load shared observation list.'
      );
    } finally {
      setSharedLoading(false);
    }
  }, []);

  const fetchLiveRoom = useCallback(
    async (
      id: string,
      passcode?: string,
      hints?: { title?: string; host?: string },
      asGuest = true
    ) => {
      setLiveLoading(true);
      setLiveError(null);

      let effectivePasscode = passcode;
      if (!effectivePasscode) {
        try {
          effectivePasscode = sessionStorage.getItem(`nephos_live_pass_${id}`) || undefined;
        } catch {
          // Ignore sessionStorage restrictions
        }
      }

      try {
        const headers: Record<string, string> = {};
        if (effectivePasscode) {
          headers['x-share-passcode'] = effectivePasscode;
        }
        const query = new URLSearchParams();
        if (hints?.title) query.set('title', hints.title);
        if (hints?.host) query.set('host', hints.host);
        const qs = query.toString();

        const res = await fetch(`/api/live/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`, {
          headers,
          cache: 'no-store',
        });
        const data = await res.json();

        if (res.status === 401 && data.requiresPasscode) {
          setLiveHints(hints || {});
          setIsLiveGuestView(asGuest);
          setLivePasscodeChallenge({
            liveId: id,
            title: data.title || hints?.title || 'Live Sky Watch',
            hostName: data.hostName || hints?.host || 'Observer',
            error: passcode ? data.error : undefined,
          });
          return;
        }

        if (!res.ok) {
          throw new Error(data.error || 'This live writing session has ended.');
        }

        if (effectivePasscode) {
          try {
            sessionStorage.setItem(`nephos_live_pass_${id}`, effectivePasscode);
          } catch {
            // Ignore
          }
        }

        const roomData = data as LiveRoomState;
        setLivePasscode(effectivePasscode || '');
        setLivePasscodeChallenge(null);
        setLiveUnlockPasscode('');
        setLiveHints({
          title: roomData.title || hints?.title,
          host: roomData.hostName || hints?.host,
        });
        setLiveRoom(roomData);
        setLiveRoomId(roomData.id);
        setLiveShareUrl(
          resolvePublicLiveUrl(roomData.id, roomData.title, roomData.hostName)
        );
        setIsLiveGuestView(asGuest);
      } catch (err) {
        setLiveError(
          err instanceof Error ? err.message : 'Unable to open live writing session.'
        );
      } finally {
        setLiveLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    hydrateLedgerFromAllStores(initialLocalSnapshotRef.current).then(
      ({ winner, needsBackfill }) => {
        if (cancelled || userMutatedRef.current) return;
        observationsRef.current = winner.observations;
        aiReportRef.current = winner.aiReport;
        lastObserverRef.current = winner.lastObserver;
        setObservations(winner.observations);
        setAiReport(winner.aiReport);
        setLastObserver(winner.lastObserver);

        if (needsBackfill) {
          void persistLedgerToAllStores({
            updatedAt: winner.updatedAt || new Date().toISOString(),
            observations: winner.observations,
            aiReport: winner.aiReport,
            lastObserver: winner.lastObserver,
          });
        }
      }
    );

    const params = new URLSearchParams(window.location.search);
    const liveParam = params.get('live');
    if (liveParam) {
      void fetchLiveRoom(
        liveParam,
        undefined,
        {
          title: params.get('title') || undefined,
          host: params.get('host') || undefined,
        },
        true
      );
    } else {
      const shareId = params.get('share');
      if (shareId) {
        void fetchSharedLedger(shareId);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [fetchSharedLedger, fetchLiveRoom]);

  // Real-time WebSocket subscription for Live Writing Sessions (/ws/live)
  useEffect(() => {
    if (!liveRoomId) {
      if (liveWsRef.current) {
        liveWsRef.current.close();
        liveWsRef.current = null;
      }
      setLiveConnected(false);
      setLiveClientId(null);
      liveClientIdRef.current = null;
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    const connectLive = () => {
      if (cancelled) return;
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = new URL(`${wsProto}//${window.location.host}/ws/live`);
      url.searchParams.set('room', liveRoomId);
      if (livePasscode) url.searchParams.set('passcode', livePasscode);
      if (liveHints.title) url.searchParams.set('title', liveHints.title);
      if (liveHints.host) url.searchParams.set('host', liveHints.host);

      const ws = new WebSocket(url.toString());
      liveWsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        if (!cancelled) {
          setLiveConnected(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type?: string;
            clientId?: string;
            room?: LiveRoomState;
            onlineCount?: number;
            drafts?: LiveWriterDraft[];
            sharedNote?: string;
            senderId?: string;
            entry?: LiveStreamNote;
            id?: string;
          };

          if (msg.type === 'live:init' && msg.room) {
            if (msg.clientId) {
              liveClientIdRef.current = msg.clientId;
              setLiveClientId(msg.clientId);
            }
            setLiveRoom(msg.room);
          } else if (msg.type === 'live:presence' && typeof msg.onlineCount === 'number') {
            setLiveRoom((prev) =>
              prev ? { ...prev, onlineCount: msg.onlineCount as number } : prev
            );
          } else if (msg.type === 'live:drafts' && Array.isArray(msg.drafts)) {
            setLiveRoom((prev) => (prev ? { ...prev, drafts: msg.drafts || [] } : prev));
          } else if (msg.type === 'live:pad' && typeof msg.sharedNote === 'string') {
            if (msg.senderId && msg.senderId === liveClientIdRef.current) return;
            setLiveRoom((prev) =>
              prev ? { ...prev, sharedNote: msg.sharedNote as string } : prev
            );
          } else if (msg.type === 'live:post' && msg.entry) {
            const incoming = msg.entry;
            setLiveRoom((prev) => {
              if (!prev) return prev;
              if (prev.messages.some((m) => m.id === incoming.id)) return prev;
              return { ...prev, messages: [incoming, ...prev.messages] };
            });
          } else if (msg.type === 'live:delete_post' && msg.id) {
            const targetId = msg.id;
            setLiveRoom((prev) =>
              prev
                ? { ...prev, messages: prev.messages.filter((m) => m.id !== targetId) }
                : prev
            );
          } else if (msg.type === 'live:ended') {
            setLiveError('This live writing session was ended by the host.');
            setLiveRoom(null);
            setLiveRoomId(null);
          }
        } catch {
          // Ignore malformed WS message
        }
      };

      ws.onclose = (ev) => {
        if (liveWsRef.current === ws) {
          liveWsRef.current = null;
        }
        if (!cancelled) {
          setLiveConnected(false);
          if (ev.code === 4004) {
            setLiveError('This live writing session has ended.');
            setLiveRoom(null);
            setLiveRoomId(null);
            return;
          }
          const delay = Math.min(8000, 1000 * Math.pow(2, attempt));
          attempt++;
          reconnectTimer = window.setTimeout(connectLive, delay);
        }
      };
    };

    connectLive();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (liveWsRef.current) {
        liveWsRef.current.close();
        liveWsRef.current = null;
      }
      setLiveConnected(false);
    };
  }, [liveRoomId, livePasscode, liveHints.title, liveHints.host]);

  // Real-time WebSocket subscription when viewing a shared list
  const activeShareId = sharedLedger?.id ?? null;
  useEffect(() => {
    if (!activeShareId) {
      if (shareWsRef.current) {
        shareWsRef.current.close();
        shareWsRef.current = null;
      }
      setShareLiveConnected(false);
      setCollaboratorsCount(1);
      setLiveDrafts([]);
      myClientIdRef.current = null;
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    const connect = () => {
      if (cancelled) return;
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = new URL(`${wsProto}//${window.location.host}/ws/shares`);
      url.searchParams.set('share', activeShareId);
      if (sharedPasscode) {
        url.searchParams.set('passcode', sharedPasscode);
      }

      const ws = new WebSocket(url.toString());
      shareWsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        if (!cancelled) {
          setShareLiveConnected(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            clientId?: string;
            drafts?: LiveDraftState[];
            payload?: SharedLedgerPayload & { collaboratorsCount?: number };
            collaboratorsCount?: number;
            observation?: CloudObservation;
            observations?: CloudObservation[];
            id?: string;
            ids?: string[];
            summaryReport?: AiSummaryReport | null;
            updatedAt?: string;
          };

          if (msg.type === 'init' && msg.payload) {
            if (msg.clientId) {
              myClientIdRef.current = msg.clientId;
            }
            if (Array.isArray(msg.drafts)) {
              setLiveDrafts(msg.drafts);
            }
            const payload = msg.payload;
            setSharedLedger({
              id: payload.id,
              title: payload.title,
              sharedBy: payload.sharedBy,
              createdAt: payload.createdAt,
              updatedAt: payload.updatedAt,
              collaborative: Boolean(payload.collaborative),
              observations: Array.isArray(payload.observations) ? payload.observations : [],
              summaryReport: payload.summaryReport ?? null,
            });
            if (typeof payload.collaboratorsCount === 'number') {
              setCollaboratorsCount(payload.collaboratorsCount);
            }
          } else if (msg.type === 'writing:state' && Array.isArray(msg.drafts)) {
            setLiveDrafts(msg.drafts);
          } else if (msg.type === 'presence' && typeof msg.collaboratorsCount === 'number') {
            setCollaboratorsCount(msg.collaboratorsCount);
          } else if (msg.type === 'observation:upsert' && msg.observation) {
            const incoming = msg.observation;
            setSharedLedger((prev) => {
              if (!prev) return prev;
              const exists = prev.observations.some((o) => o.id === incoming.id);
              const nextObs = exists
                ? prev.observations.map((o) => (o.id === incoming.id ? incoming : o))
                : [incoming, ...prev.observations];
              return { ...prev, observations: nextObs, updatedAt: msg.updatedAt };
            });
          } else if (msg.type === 'observation:delete' && msg.id) {
            const targetId = msg.id;
            setSharedLedger((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                observations: prev.observations.filter((o) => o.id !== targetId),
                updatedAt: msg.updatedAt,
              };
            });
          } else if (msg.type === 'observation:bulk_delete' && Array.isArray(msg.ids)) {
            const idSet = new Set(msg.ids);
            setSharedLedger((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                observations: prev.observations.filter((o) => !idSet.has(o.id)),
                updatedAt: msg.updatedAt,
              };
            });
          } else if (msg.type === 'observation:import' && Array.isArray(msg.observations)) {
            const incomingList = msg.observations;
            setSharedLedger((prev) => {
              if (!prev) return prev;
              const existingIds = new Set(prev.observations.map((o) => o.id));
              const unique = incomingList.filter((o) => !existingIds.has(o.id));
              if (unique.length === 0) return prev;
              return {
                ...prev,
                observations: [...unique, ...prev.observations],
                updatedAt: msg.updatedAt,
              };
            });
          } else if (msg.type === 'summary:update') {
            setSharedLedger((prev) =>
              prev
                ? { ...prev, summaryReport: msg.summaryReport ?? null, updatedAt: msg.updatedAt }
                : prev
            );
          } else if (msg.type === 'ledger:clear') {
            setSharedLedger((prev) =>
              prev
                ? { ...prev, observations: [], summaryReport: null, updatedAt: msg.updatedAt }
                : prev
            );
          } else if (msg.type === 'share:revoked') {
            setSharedError('This shared list was revoked by its owner.');
            setSharedLedger(null);
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        if (shareWsRef.current === ws) {
          shareWsRef.current = null;
        }
        if (!cancelled) {
          setShareLiveConnected(false);
          const delay = Math.min(8000, 1000 * Math.pow(2, attempt));
          attempt++;
          reconnectTimer = window.setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (shareWsRef.current) {
        shareWsRef.current.close();
        shareWsRef.current = null;
      }
      setShareLiveConnected(false);
    };
  }, [activeShareId, sharedPasscode]);

  useEffect(() => {
    saveViewMode(viewMode);
  }, [viewMode]);

  const activeObservations = sharedLedger ? sharedLedger.observations : observations;
  const activeAiReport = sharedLedger ? sharedLedger.summaryReport : aiReport;
  const isViewingShared = Boolean(sharedLedger);
  const isCollaborativeShared = Boolean(sharedLedger?.collaborative);
  const isReadOnlyShared = Boolean(sharedLedger && !sharedLedger.collaborative);

  const existingAlbums = useMemo(() => {
    const set = new Set<string>();
    activeObservations.forEach((o) => {
      if (o.album && o.album.trim()) set.add(o.album.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeObservations]);

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

  const sendCollaborativeEvent = async (event: Record<string, unknown>) => {
    if (!sharedLedger || !sharedLedger.collaborative) return;
    const ws = shareWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
      return;
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sharedPasscode) {
        headers['x-share-passcode'] = sharedPasscode;
      }
      await fetch(`/api/shares/${encodeURIComponent(sharedLedger.id)}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
      });
    } catch {
      // Server sync failed transiently; WebSocket reconnects and reconciles
    }
  };

  const handleOpenNewObservation = (genus?: GenusCode) => {
    if (isReadOnlyShared || passcodeChallenge) {
      handleExitSharedView();
    }
    setEditingObservation(null);
    setDefaultGenusForNew(genus ?? null);
    setIsFormOpen(true);
  };

  const handleSaveObservation = (record: CloudObservation) => {
    if (record.observer && record.observer !== '-') {
      lastObserverRef.current = record.observer;
      setLastObserver(record.observer);
    }

    if (isCollaborativeShared && sharedLedger) {
      setSharedLedger((prev) => {
        if (!prev) return prev;
        const exists = prev.observations.some((item) => item.id === record.id);
        const nextObs = exists
          ? prev.observations.map((item) => (item.id === record.id ? record : item))
          : [record, ...prev.observations];
        return { ...prev, observations: nextObs };
      });
      void sendCollaborativeEvent({ type: 'observation:upsert', observation: record });
      setActiveTab('observations');
      return;
    }

    const prev = observationsRef.current;
    const exists = prev.some((item) => item.id === record.id);
    const nextObservations = exists
      ? prev.map((item) => (item.id === record.id ? record : item))
      : [record, ...prev];
    const nextObserver =
      record.observer && record.observer !== '-' ? record.observer : lastObserverRef.current;

    commitLedgerUpdate(nextObservations, aiReportRef.current, nextObserver);
    setActiveTab('observations');
  };

  const handleDeleteObservation = (id: string) => {
    if (isCollaborativeShared && sharedLedger) {
      setSharedLedger((prev) =>
        prev ? { ...prev, observations: prev.observations.filter((item) => item.id !== id) } : prev
      );
      void sendCollaborativeEvent({ type: 'observation:delete', id });
      return;
    }

    const nextObservations = observationsRef.current.filter((item) => item.id !== id);
    commitLedgerUpdate(nextObservations);
  };

  const handleBulkDeleteObservations = (ids: string[]) => {
    if (ids.length === 0) return;
    if (isCollaborativeShared && sharedLedger) {
      const idSet = new Set(ids);
      setSharedLedger((prev) =>
        prev
          ? { ...prev, observations: prev.observations.filter((item) => !idSet.has(item.id)) }
          : prev
      );
      void sendCollaborativeEvent({ type: 'observation:bulk_delete', ids });
      return;
    }

    const idSet = new Set(ids);
    const nextObservations = observationsRef.current.filter((item) => !idSet.has(item.id));
    commitLedgerUpdate(nextObservations);
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
    if (isCollaborativeShared && sharedLedger) {
      setSharedLedger((prev) => {
        if (!prev) return prev;
        const existingIds = new Set(prev.observations.map((o) => o.id));
        const unique = items.filter((o) => !existingIds.has(o.id));
        return { ...prev, observations: [...unique, ...prev.observations] };
      });
      void sendCollaborativeEvent({ type: 'observation:import', observations: items });
      return;
    }

    const nextObservations = [...items, ...observationsRef.current];
    commitLedgerUpdate(nextObservations);
  };

  const handleClearAll = () => {
    if (isCollaborativeShared && sharedLedger) {
      setSharedLedger((prev) =>
        prev ? { ...prev, observations: [], summaryReport: null } : prev
      );
      void sendCollaborativeEvent({ type: 'ledger:clear' });
      setSearchQuery('');
      setEtageFilter('All');
      return;
    }

    commitLedgerUpdate([], null, lastObserverRef.current);
    setSearchQuery('');
    setEtageFilter('All');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setEtageFilter('All');
  };

  const handleOpenShare = (presetTitle?: string) => {
    setSharePresetTitle(presetTitle);
    setIsShareOpen(true);
  };

  const sendLiveWriting = useCallback((draft: LiveWritingDraftInput | null) => {
    latestLiveWritingRef.current = draft;

    const emit = (payload: LiveWritingDraftInput | null) => {
      const ws = liveWsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (!payload) {
        ws.send(JSON.stringify({ type: 'live:writing', isWriting: false }));
        return;
      }
      ws.send(
        JSON.stringify({
          type: 'live:writing',
          isWriting: true,
          author: lastObserverRef.current.trim() || 'Observer',
          cloudName: payload.cloudName,
          abbreviation: payload.abbreviation,
          text: payload.text,
          source: payload.source,
        })
      );
    };

    if (!draft) {
      if (liveWritingThrottleRef.current !== null) {
        window.clearTimeout(liveWritingThrottleRef.current);
        liveWritingThrottleRef.current = null;
      }
      emit(null);
      return;
    }

    if (liveWritingThrottleRef.current === null) {
      emit(draft);
      liveWritingThrottleRef.current = window.setTimeout(() => {
        liveWritingThrottleRef.current = null;
        if (latestLiveWritingRef.current) {
          emit(latestLiveWritingRef.current);
        }
      }, 75);
    }
  }, []);

  const handleLivePostNote = useCallback(
    (note: { cloudName: string; abbreviation: string; text: string }) => {
      const ws = liveWsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const id = `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const author = lastObserverRef.current.trim() || 'Observer';
      const entry: LiveStreamNote = {
        id,
        author,
        cloudName: note.cloudName,
        abbreviation: note.abbreviation,
        text: note.text,
        createdAt: new Date().toISOString(),
      };
      setLiveRoom((prev) =>
        prev
          ? {
              ...prev,
              messages: [entry, ...prev.messages.filter((m) => m.id !== id)],
            }
          : prev
      );
      ws.send(
        JSON.stringify({
          type: 'live:post',
          id,
          author,
          cloudName: note.cloudName,
          abbreviation: note.abbreviation,
          text: note.text,
        })
      );
    },
    []
  );

  const handleLiveDeletePost = useCallback((id: string) => {
    setLiveRoom((prev) =>
      prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== id) } : prev
    );
    const ws = liveWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'live:delete_post', id }));
    }
  }, []);

  const handleLivePadChange = useCallback((nextText: string) => {
    setLiveRoom((prev) => (prev ? { ...prev, sharedNote: nextText } : prev));
    latestLivePadRef.current = nextText;

    const emitPad = (value: string) => {
      const ws = liveWsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          type: 'live:pad',
          sharedNote: value,
          author: lastObserverRef.current.trim() || 'Observer',
        })
      );
    };

    if (livePadThrottleRef.current === null) {
      emitPad(nextText);
      livePadThrottleRef.current = window.setTimeout(() => {
        livePadThrottleRef.current = null;
        if (latestLivePadRef.current !== null) {
          emitPad(latestLivePadRef.current);
        }
      }, 75);
    }
  }, []);

  const handleStartLiveSession = useCallback(
    (session: {
      liveId: string;
      title: string;
      hostName: string;
      passcode?: string;
      shareUrl: string;
    }) => {
      if (session.hostName.trim()) {
        lastObserverRef.current = session.hostName.trim();
        setLastObserver(session.hostName.trim());
      }
      setLiveError(null);
      setLivePasscodeChallenge(null);
      setLivePasscode(session.passcode || '');
      setLiveHints({ title: session.title, host: session.hostName });
      setLiveShareUrl(session.shareUrl);
      setIsLiveGuestView(false);
      setLiveRoom({
        id: session.liveId,
        title: session.title,
        hostName: session.hostName,
        createdAt: new Date().toISOString(),
        sharedNote: '',
        messages: [],
        drafts: [],
        onlineCount: 1,
      });
      setLiveRoomId(session.liveId);
    },
    []
  );

  const handleLeaveOrEndLive = useCallback(async () => {
    const activeId = liveRoomId;
    const wasGuest = isLiveGuestView;

    if (!wasGuest && activeId) {
      try {
        await fetch(`/api/live/${encodeURIComponent(activeId)}`, { method: 'DELETE' });
      } catch {
        // Proceed clearing local state
      }
      try {
        const raw = localStorage.getItem('nephos_my_live_rooms_v1');
        if (raw) {
          const parsed = JSON.parse(raw) as Array<{ liveId: string }>;
          localStorage.setItem(
            'nephos_my_live_rooms_v1',
            JSON.stringify(parsed.filter((r) => r.liveId !== activeId))
          );
        }
      } catch {
        // Ignore storage error
      }
    }

    setLiveRoom(null);
    setLiveRoomId(null);
    setLiveError(null);
    setLivePasscode('');
    setLivePasscodeChallenge(null);
    setLiveShareUrl('');
    setIsLiveGuestView(false);

    const url = new URL(window.location.href);
    url.searchParams.delete('live');
    url.searchParams.delete('title');
    url.searchParams.delete('host');
    window.history.replaceState({}, '', url.toString());
  }, [liveRoomId, isLiveGuestView]);

  const handleDraftChange = useCallback(
    (draft: DraftBroadcast | null) => {
      if (liveRoomId && liveWsRef.current?.readyState === WebSocket.OPEN) {
        if (!draft) {
          sendLiveWriting(null);
        } else {
          sendLiveWriting({
            cloudName: draft.title,
            abbreviation: draft.abbreviation,
            text: draft.notes,
            source: draft.field,
          });
        }
      }

      if (!isCollaborativeShared) return;
      latestDraftRef.current = draft;

      const emitDraft = (payload: DraftBroadcast | null) => {
        const ws = shareWsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (!payload) {
          ws.send(JSON.stringify({ type: 'writing:update', isWriting: false }));
          return;
        }
        ws.send(
          JSON.stringify({
            type: 'writing:update',
            isWriting: true,
            author: payload.author || lastObserverRef.current || 'Collaborator',
            field: payload.field,
            title: payload.title,
            abbreviation: payload.abbreviation,
            notes: payload.notes,
          })
        );
      };

      if (!draft) {
        if (draftThrottleTimerRef.current !== null) {
          window.clearTimeout(draftThrottleTimerRef.current);
          draftThrottleTimerRef.current = null;
        }
        emitDraft(null);
        return;
      }

      if (draftThrottleTimerRef.current === null) {
        emitDraft(draft);
        draftThrottleTimerRef.current = window.setTimeout(() => {
          draftThrottleTimerRef.current = null;
          if (latestDraftRef.current) {
            emitDraft(latestDraftRef.current);
          }
        }, 120);
      }
    },
    [isCollaborativeShared, liveRoomId, sendLiveWriting]
  );

  const remoteLiveDrafts = useMemo(
    () => liveDrafts.filter((d) => d.clientId !== myClientIdRef.current),
    [liveDrafts]
  );

  const handleExitSharedView = () => {
    setSharedLedger(null);
    setSharedError(null);
    setSharedPasscode('');
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
    const nextObservations = [...copied, ...observationsRef.current];
    const nextReport = sharedLedger.summaryReport ?? aiReportRef.current;
    commitLedgerUpdate(nextObservations, nextReport);
    handleExitSharedView();
    setActiveTab('observations');
  };

  const handleReportGenerated = (report: AiSummaryReport) => {
    if (isCollaborativeShared && sharedLedger) {
      setSharedLedger((prev) => (prev ? { ...prev, summaryReport: report } : prev));
      void sendCollaborativeEvent({ type: 'summary:update', summaryReport: report });
      return;
    }
    if (isViewingShared) {
      setAiReport(report);
      return;
    }
    commitLedgerUpdate(observationsRef.current, report);
  };

  const handleCopyCurrentShareLink = async () => {
    if (!sharedLedger) return;
    const url = `${window.location.origin}/?share=${sharedLedger.id}`;
    await navigator.clipboard.writeText(url);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-950">
              <span className="font-display font-semibold">{sharedLedger.title}</span>
              <span className="text-sky-400" aria-hidden="true">
                ·
              </span>
              <span>
                {sharedLedger.collaborative
                  ? shareLiveConnected
                    ? `Live Together (${collaboratorsCount} online)`
                    : 'Reconnecting live sync...'
                  : `Read-Only Snapshot by ${sharedLedger.sharedBy}`}
              </span>
              <span className="text-sky-400" aria-hidden="true">
                ·
              </span>
              <span className="font-mono tabular-nums">
                {sharedLedger.observations.length} observations
              </span>
              {sharedLedger.collaborative && (
                <>
                  <span className="text-sky-400" aria-hidden="true">
                    ·
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-slate-700">
                    <span>Your name:</span>
                    <input
                      type="text"
                      value={lastObserver}
                      onChange={(e) => {
                        lastObserverRef.current = e.target.value;
                        setLastObserver(e.target.value);
                      }}
                      placeholder="Observer name"
                      className="w-28 rounded border border-sky-300 bg-white px-2 py-0.5 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                    />
                  </label>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyCurrentShareLink}
                className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-50 whitespace-nowrap"
              >
                {copiedShareLink ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Link Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy Share Link
                  </>
                )}
              </button>
              {isReadOnlyShared && (
                <button
                  type="button"
                  onClick={handleImportSharedCopy}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Save Copy to My List
                </button>
              )}
              <button
                type="button"
                onClick={handleExitSharedView}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                {sharedLedger.collaborative ? 'Exit Live Share' : 'Back to My List'}
              </button>
            </div>
          </div>

          {sharedLedger.collaborative && remoteLiveDrafts.length > 0 && (
            <div className="mx-auto mt-2.5 max-w-[1440px] space-y-1.5 border-t border-sky-200/80 pt-2.5 sm:px-2">
              {remoteLiveDrafts.map((draft) => (
                <div
                  key={draft.clientId}
                  className="flex flex-wrap items-baseline gap-2 rounded-md border border-sky-200 bg-white px-3 py-2 text-xs text-slate-800"
                >
                  <span className="font-semibold text-sky-800">
                    {draft.author} is writing ({draft.field}):
                  </span>
                  {draft.title && (
                    <span className="font-display font-semibold text-slate-900">
                      {draft.title}
                    </span>
                  )}
                  {draft.abbreviation && (
                    <span className="font-mono text-[11px] text-sky-700">
                      {draft.abbreviation}
                    </span>
                  )}
                  {draft.notes && (
                    <span className="text-slate-600">&ldquo;{draft.notes}&rdquo;</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {liveLoading && (
        <div className="border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-xs font-medium text-sky-900">
          <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Joining live writing session...
        </div>
      )}

      {liveError && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2.5">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 text-xs text-rose-800 sm:px-2">
            <span>{liveError}</span>
            <button
              type="button"
              onClick={() => void handleLeaveOrEndLive()}
              className="font-semibold underline hover:text-rose-950 whitespace-nowrap"
            >
              Open My Ledger
            </button>
          </div>
        </div>
      )}

      {liveRoom && !livePasscodeChallenge && (
        <LiveSessionPanel
          room={liveRoom}
          myClientId={liveClientId}
          connected={liveConnected}
          isGuestView={isLiveGuestView}
          shareUrl={liveShareUrl}
          myName={lastObserver}
          onChangeMyName={(name) => {
            lastObserverRef.current = name;
            setLastObserver(name);
          }}
          onWritingChange={sendLiveWriting}
          onPostNote={handleLivePostNote}
          onDeletePost={handleLiveDeletePost}
          onSharedPadChange={handleLivePadChange}
          onLeaveOrEnd={() => void handleLeaveOrEndLive()}
        />
      )}

      {!isLiveGuestView && (
        <TelemetryStrip
          totalCount={activeObservations.length}
          filteredCount={filteredObservations.length}
          observations={activeObservations}
        />
      )}

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
        {livePasscodeChallenge ? (
          <section className="mx-auto mt-8 max-w-md rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2.5 text-sky-800">
              <Lock className="h-5 w-5" aria-hidden="true" />
              <h1 className="font-display text-base font-bold text-slate-900">
                Passcode Required
              </h1>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">{livePasscodeChallenge.title}</span>{' '}
              (hosted by {livePasscodeChallenge.hostName}) is protected by an access passcode.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!liveUnlockPasscode.trim()) return;
                void fetchLiveRoom(
                  livePasscodeChallenge.liveId,
                  liveUnlockPasscode.trim(),
                  liveHints,
                  isLiveGuestView
                );
              }}
              className="mt-4 space-y-3"
            >
              {livePasscodeChallenge.error && (
                <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {livePasscodeChallenge.error}
                </div>
              )}
              <input
                type="password"
                value={liveUnlockPasscode}
                onChange={(e) => setLiveUnlockPasscode(e.target.value)}
                placeholder="Enter passcode..."
                aria-label="Live session passcode"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void handleLeaveOrEndLive()}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Cancel &amp; open my ledger
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
                >
                  Join Live Session
                </button>
              </div>
            </form>
          </section>
        ) : isLiveGuestView && liveRoom ? null : passcodeChallenge ? (
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
                        onClick={() => handleOpenShare()}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          liveRoom
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {liveRoom ? (
                          <>
                            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                            Live Share Active
                          </>
                        ) : (
                          <>
                            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Share Together
                          </>
                        )}
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
                    readOnly={isReadOnlyShared}
                    lastObserver={lastObserver}
                    onToggleSort={handleToggleSort}
                    onSelectObservation={setInspectingObservation}
                    onDeleteObservation={handleDeleteObservation}
                    onBulkDeleteObservations={handleBulkDeleteObservations}
                    onQuickAddObservation={handleQuickAddObservation}
                    onDraftChange={handleDraftChange}
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
                    readOnly={isReadOnlyShared}
                    onSelectObservation={setInspectingObservation}
                    onDeleteObservation={handleDeleteObservation}
                    onShareAlbum={(albumName) => handleOpenShare(albumName)}
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
                    readOnly={isReadOnlyShared}
                    onSelectObservation={setInspectingObservation}
                    onDeleteObservation={handleDeleteObservation}
                    onAddNew={() => handleOpenNewObservation()}
                  />
                ) : (
                  <ObservationTimelineView
                    observations={filteredObservations}
                    readOnly={isReadOnlyShared}
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
                onReportGenerated={handleReportGenerated}
                onOpenNewObservation={() => handleOpenNewObservation()}
              />
            )}

            {activeTab === 'taxonomy' && (
              <WmoTaxonomyView onLogGenus={(code) => handleOpenNewObservation(code)} />
            )}

            {activeTab === 'import-export' && (
              <DataTransferView
                observations={isCollaborativeShared ? activeObservations : observations}
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
        onDraftChange={handleDraftChange}
      />

      <ObservationDetailModal
        observation={inspectingObservation}
        readOnly={isReadOnlyShared}
        onClose={() => setInspectingObservation(null)}
        onEdit={(obs) => {
          setEditingObservation(obs);
          setDefaultGenusForNew(null);
          setIsFormOpen(true);
        }}
        onDelete={handleDeleteObservation}
        onShare={(obs) => handleOpenShare(obs.title)}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        defaultAuthor={lastObserver}
        presetTitle={sharePresetTitle}
        activeLiveSession={
          liveRoom
            ? {
                liveId: liveRoom.id,
                title: liveRoom.title,
                shareUrl: liveShareUrl,
              }
            : null
        }
        onStartLiveSession={handleStartLiveSession}
        onEndLiveSession={(endedId) => {
          if (endedId === liveRoomId) {
            void handleLeaveOrEndLive();
          }
        }}
      />
    </div>
  );
}
