import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));

interface ShareObservationItem {
  id: string;
  [key: string]: unknown;
}

interface StoredShare {
  id: string;
  title: string;
  sharedBy: string;
  passcodeHash: string | null;
  createdAt: string;
  updatedAt: string;
  collaborative: boolean;
  observations: ShareObservationItem[];
  summaryReport: unknown | null;
}

interface StoredLedger {
  updatedAt: string | null;
  observations: unknown[];
  aiReport: unknown | null;
  lastObserver: string;
}

const SHARE_DATA_DIR = path.resolve(__dirname, '.data');
const SHARE_DATA_FILE = path.join(SHARE_DATA_DIR, 'shares.json');
const LEDGER_DATA_FILE = path.join(SHARE_DATA_DIR, 'ledger.json');
const shareMemoryStore = new Map<string, StoredShare>();
const shareRooms = new Map<string, Set<WebSocket>>();
let ledgerMemoryStore: StoredLedger = {
  updatedAt: null,
  observations: [],
  aiReport: null,
  lastObserver: '',
};

function hashPasscode(passcode: string): string {
  return crypto.createHash('sha256').update(passcode).digest('hex');
}

function loadSharesFromDisk(): void {
  try {
    if (!fs.existsSync(SHARE_DATA_FILE)) return;
    const raw = fs.readFileSync(SHARE_DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, StoredShare>;
    Object.entries(parsed).forEach(([key, val]) => {
      shareMemoryStore.set(key, {
        ...val,
        updatedAt: typeof val.updatedAt === 'string' ? val.updatedAt : val.createdAt,
        collaborative: Boolean(val.collaborative),
        observations: Array.isArray(val.observations) ? val.observations : [],
      });
    });
  } catch {
    // Graceful fallback to memory-only if disk read fails
  }
}

function persistSharesToDisk(): void {
  try {
    if (!fs.existsSync(SHARE_DATA_DIR)) {
      fs.mkdirSync(SHARE_DATA_DIR, { recursive: true });
    }
    const obj: Record<string, StoredShare> = {};
    shareMemoryStore.forEach((val, key) => {
      obj[key] = val;
    });
    const tmpFile = `${SHARE_DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(obj), 'utf-8');
    fs.renameSync(tmpFile, SHARE_DATA_FILE);
  } catch {
    // Graceful fallback if filesystem is read-only
  }
}

function loadLedgerFromDisk(): void {
  try {
    if (!fs.existsSync(LEDGER_DATA_FILE)) return;
    const raw = fs.readFileSync(LEDGER_DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredLedger>;
    if (Array.isArray(parsed.observations)) {
      ledgerMemoryStore = {
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        observations: parsed.observations,
        aiReport: parsed.aiReport ?? null,
        lastObserver: typeof parsed.lastObserver === 'string' ? parsed.lastObserver : '',
      };
    }
  } catch {
    // Graceful fallback to memory-only if disk read fails
  }
}

function persistLedgerToDisk(): void {
  try {
    if (!fs.existsSync(SHARE_DATA_DIR)) {
      fs.mkdirSync(SHARE_DATA_DIR, { recursive: true });
    }
    const tmpFile = `${LEDGER_DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(ledgerMemoryStore), 'utf-8');
    fs.renameSync(tmpFile, LEDGER_DATA_FILE);
  } catch {
    // Graceful fallback if filesystem is read-only
  }
}

loadSharesFromDisk();
loadLedgerFromDisk();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : 'Unexpected server error.';
  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    return { status: 500, message: rawMessage };
  }
  if (rawMessage.includes('403') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Gemini API permission denied. Please verify your API key in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('400')) {
    return {
      status: 400,
      message: `Gemini API request rejected: ${rawMessage}`,
    };
  }
  if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'Gemini API rate limit reached. Please wait a moment and try again.',
    };
  }
  return { status: 500, message: rawMessage };
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return `${Math.round(deg)}° ${dirs[idx]}`;
}

app.get('/api/weather', async (req: Request, res: Response) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
      return;
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m'
    );
    url.searchParams.set('wind_speed_unit', 'kmh');
    url.searchParams.set('timezone', 'auto');

    const weatherRes = await fetch(url.toString());
    if (!weatherRes.ok) {
      throw new Error(`Weather station service returned HTTP ${weatherRes.status}`);
    }

    const payload = (await weatherRes.json()) as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        pressure_msl?: number;
        wind_speed_10m?: number;
        wind_direction_10m?: number;
      };
    };

    const current = payload.current;
    if (!current) {
      throw new Error('Weather data unavailable for these coordinates.');
    }

    res.json({
      temperatureC:
        typeof current.temperature_2m === 'number' ? Number(current.temperature_2m.toFixed(1)) : null,
      humidityPct:
        typeof current.relative_humidity_2m === 'number'
          ? Math.round(current.relative_humidity_2m)
          : null,
      windSpeedKmh:
        typeof current.wind_speed_10m === 'number' ? Number(current.wind_speed_10m.toFixed(1)) : null,
      windDirection:
        typeof current.wind_direction_10m === 'number'
          ? degreesToCompass(current.wind_direction_10m)
          : '',
      pressureHpa:
        typeof current.pressure_msl === 'number' ? Number(current.pressure_msl.toFixed(1)) : null,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to fetch local weather conditions.',
    });
  }
});

interface LiveDraftState {
  clientId: string;
  author: string;
  field: string;
  title: string;
  abbreviation: string;
  notes: string;
  updatedAt: string;
}

interface LiveWriterDraft {
  clientId: string;
  author: string;
  cloudName: string;
  abbreviation: string;
  text: string;
  source: string;
  updatedAt: string;
}

interface LiveStreamNote {
  id: string;
  author: string;
  cloudName: string;
  abbreviation: string;
  text: string;
  createdAt: string;
}

interface LiveRoomRecord {
  id: string;
  title: string;
  hostName: string;
  passcodeHash: string | null;
  createdAt: string;
  sharedNote: string;
  messages: LiveStreamNote[];
}

const LIVE_DATA_FILE = path.join(SHARE_DATA_DIR, 'live-rooms.json');
const liveMemoryStore = new Map<string, LiveRoomRecord>();
const endedLiveIds = new Set<string>();
const liveSockets = new Map<string, Set<WebSocket>>();
const liveDrafts = new Map<string, Map<string, LiveWriterDraft>>();

function loadLiveRoomsFromDisk(): void {
  try {
    if (!fs.existsSync(LIVE_DATA_FILE)) return;
    const raw = fs.readFileSync(LIVE_DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, LiveRoomRecord>;
    Object.entries(parsed).forEach(([key, val]) => {
      liveMemoryStore.set(key, {
        ...val,
        sharedNote: typeof val.sharedNote === 'string' ? val.sharedNote : '',
        messages: Array.isArray(val.messages) ? val.messages : [],
      });
    });
  } catch {
    // Fallback to memory
  }
}

function persistLiveRoomsToDisk(): void {
  try {
    if (!fs.existsSync(SHARE_DATA_DIR)) {
      fs.mkdirSync(SHARE_DATA_DIR, { recursive: true });
    }
    const obj: Record<string, LiveRoomRecord> = {};
    liveMemoryStore.forEach((val, key) => {
      obj[key] = val;
    });
    const tmpFile = `${LIVE_DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(obj), 'utf-8');
    fs.renameSync(tmpFile, LIVE_DATA_FILE);
  } catch {
    // Ignore read-only fs errors
  }
}

loadLiveRoomsFromDisk();

function getLiveDraftsList(liveId: string): LiveWriterDraft[] {
  const map = liveDrafts.get(liveId);
  return map ? Array.from(map.values()) : [];
}

function getLiveOnlineCount(liveId: string): number {
  const clients = liveSockets.get(liveId);
  if (!clients) return 0;
  let count = 0;
  clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) count++;
  });
  return count;
}

function broadcastToLiveRoom(liveId: string, message: unknown): void {
  const clients = liveSockets.get(liveId);
  if (!clients || clients.size === 0) return;
  const serialized = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  });
}

app.post('/api/live', (req: Request, res: Response) => {
  try {
    const { title, hostName, passcode } = req.body as {
      title?: string;
      hostName?: string;
      passcode?: string;
    };

    const cleanPasscode = passcode?.trim() ?? '';
    const liveId = crypto.randomBytes(10).toString('hex');
    const record: LiveRoomRecord = {
      id: liveId,
      title: (title || 'Live Sky Watch').trim(),
      hostName: (hostName || 'Observer').trim(),
      passcodeHash: cleanPasscode ? hashPasscode(cleanPasscode) : null,
      createdAt: new Date().toISOString(),
      sharedNote: '',
      messages: [],
    };

    liveMemoryStore.set(liveId, record);
    persistLiveRoomsToDisk();

    const envAppUrl =
      process.env.APP_URL && process.env.APP_URL.startsWith('http')
        ? process.env.APP_URL.replace(/\/+$/, '')
        : null;

    res.status(201).json({
      liveId: record.id,
      title: record.title,
      hostName: record.hostName,
      createdAt: record.createdAt,
      hasPasscode: Boolean(record.passcodeHash),
      appUrl: envAppUrl,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to create live session.',
    });
  }
});

app.get('/api/live/:id', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String(req.params.id || '').trim();
  if (!id || endedLiveIds.has(id)) {
    res.status(404).json({ error: 'This live sharing session has ended.' });
    return;
  }

  let record = liveMemoryStore.get(id);
  if (!record) {
    const titleHint = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const hostHint = typeof req.query.host === 'string' ? req.query.host.trim() : '';
    record = {
      id,
      title: titleHint || 'Live Sky Watch',
      hostName: hostHint || 'Observer',
      passcodeHash: null,
      createdAt: new Date().toISOString(),
      sharedNote: '',
      messages: [],
    };
    liveMemoryStore.set(id, record);
    persistLiveRoomsToDisk();
  }

  if (record.passcodeHash) {
    const providedPasscode = String(req.headers['x-share-passcode'] || '').trim();
    if (!providedPasscode || hashPasscode(providedPasscode) !== record.passcodeHash) {
      res.status(401).json({
        requiresPasscode: true,
        title: record.title,
        hostName: record.hostName,
        createdAt: record.createdAt,
        error: providedPasscode
          ? 'Incorrect passcode. Please try again.'
          : 'Passcode required to join this live session.',
      });
      return;
    }
  }

  res.json({
    id: record.id,
    title: record.title,
    hostName: record.hostName,
    createdAt: record.createdAt,
    sharedNote: record.sharedNote,
    messages: record.messages,
    drafts: getLiveDraftsList(id),
    onlineCount: getLiveOnlineCount(id),
  });
});

app.delete('/api/live/:id', (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  endedLiveIds.add(id);
  const deleted = liveMemoryStore.delete(id);
  if (deleted) {
    persistLiveRoomsToDisk();
    broadcastToLiveRoom(id, { type: 'live:ended' });
    liveDrafts.delete(id);
  }
  res.json({ ended: deleted });
});

const roomDrafts = new Map<string, Map<string, LiveDraftState>>();

function getRoomDraftsList(shareId: string): LiveDraftState[] {
  const map = roomDrafts.get(shareId);
  if (!map) return [];
  return Array.from(map.values());
}

function broadcastToShareRoom(shareId: string, message: unknown): void {
  const clients = shareRooms.get(shareId);
  if (!clients || clients.size === 0) return;
  const serialized = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  });
}

function getRoomCollaboratorsCount(shareId: string): number {
  const clients = shareRooms.get(shareId);
  if (!clients) return 0;
  let count = 0;
  clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) count++;
  });
  return count;
}

interface ShareEventPayload {
  type:
    | 'observation:upsert'
    | 'observation:delete'
    | 'observation:bulk_delete'
    | 'observation:import'
    | 'summary:update'
    | 'ledger:clear';
  observation?: ShareObservationItem;
  id?: string;
  ids?: string[];
  observations?: ShareObservationItem[];
  summaryReport?: unknown | null;
}

function applyShareEvent(
  record: StoredShare,
  event: ShareEventPayload
): { changed: boolean; broadcastPayload: Record<string, unknown> | null } {
  const nowIso = new Date().toISOString();

  if (event.type === 'observation:upsert' && event.observation && typeof event.observation.id === 'string') {
    const incoming = event.observation;
    const idx = record.observations.findIndex((o) => o.id === incoming.id);
    if (idx >= 0) {
      record.observations[idx] = incoming;
    } else {
      record.observations.unshift(incoming);
    }
    record.updatedAt = nowIso;
    persistSharesToDisk();
    return {
      changed: true,
      broadcastPayload: { type: 'observation:upsert', observation: incoming, updatedAt: nowIso },
    };
  }

  if (event.type === 'observation:delete' && typeof event.id === 'string') {
    const next = record.observations.filter((o) => o.id !== event.id);
    if (next.length !== record.observations.length) {
      record.observations = next;
      record.updatedAt = nowIso;
      persistSharesToDisk();
    }
    return {
      changed: true,
      broadcastPayload: { type: 'observation:delete', id: event.id, updatedAt: nowIso },
    };
  }

  if (event.type === 'observation:bulk_delete' && Array.isArray(event.ids)) {
    const idSet = new Set(event.ids.filter((id): id is string => typeof id === 'string'));
    const next = record.observations.filter((o) => !idSet.has(o.id));
    if (next.length !== record.observations.length) {
      record.observations = next;
      record.updatedAt = nowIso;
      persistSharesToDisk();
    }
    return {
      changed: true,
      broadcastPayload: {
        type: 'observation:bulk_delete',
        ids: Array.from(idSet),
        updatedAt: nowIso,
      },
    };
  }

  if (event.type === 'observation:import' && Array.isArray(event.observations)) {
    const existingIds = new Set(record.observations.map((o) => o.id));
    const uniqueIncoming = event.observations.filter(
      (item): item is ShareObservationItem =>
        Boolean(item) && typeof item.id === 'string' && !existingIds.has(item.id)
    );
    if (uniqueIncoming.length > 0) {
      record.observations = [...uniqueIncoming, ...record.observations];
      record.updatedAt = nowIso;
      persistSharesToDisk();
    }
    return {
      changed: true,
      broadcastPayload: {
        type: 'observation:import',
        observations: uniqueIncoming,
        updatedAt: nowIso,
      },
    };
  }

  if (event.type === 'summary:update') {
    record.summaryReport = event.summaryReport ?? null;
    record.updatedAt = nowIso;
    persistSharesToDisk();
    return {
      changed: true,
      broadcastPayload: {
        type: 'summary:update',
        summaryReport: record.summaryReport,
        updatedAt: nowIso,
      },
    };
  }

  if (event.type === 'ledger:clear') {
    record.observations = [];
    record.summaryReport = null;
    record.updatedAt = nowIso;
    persistSharesToDisk();
    return {
      changed: true,
      broadcastPayload: { type: 'ledger:clear', updatedAt: nowIso },
    };
  }

  return { changed: false, broadcastPayload: null };
}

app.post('/api/shares', (req: Request, res: Response) => {
  try {
    const { title, sharedBy, passcode, observations, summaryReport, collaborative } = req.body as {
      title?: string;
      sharedBy?: string;
      passcode?: string;
      observations?: ShareObservationItem[];
      summaryReport?: unknown;
      collaborative?: boolean;
    };

    if (!Array.isArray(observations)) {
      res.status(400).json({ error: 'observations array is required to create a share link.' });
      return;
    }

    const cleanPasscode = passcode?.trim() ?? '';
    const shareId = crypto.randomBytes(12).toString('hex');
    const nowIso = new Date().toISOString();
    const isCollaborative = collaborative !== false;

    const record: StoredShare = {
      id: shareId,
      title: (title || 'Private Cloud Observation Ledger').trim(),
      sharedBy: (sharedBy || 'Observer').trim(),
      passcodeHash: cleanPasscode ? hashPasscode(cleanPasscode) : null,
      createdAt: nowIso,
      updatedAt: nowIso,
      collaborative: isCollaborative,
      observations,
      summaryReport: summaryReport ?? null,
    };

    shareMemoryStore.set(shareId, record);
    persistSharesToDisk();

    const envAppUrl =
      process.env.APP_URL && process.env.APP_URL.startsWith('http')
        ? process.env.APP_URL.replace(/\/+$/, '')
        : null;

    res.status(201).json({
      shareId: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      hasPasscode: Boolean(record.passcodeHash),
      collaborative: record.collaborative,
      count: record.observations.length,
      appUrl: envAppUrl,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to create shareable ledger.',
    });
  }
});

app.get('/api/shares/:id', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String(req.params.id || '').trim();
  const record = shareMemoryStore.get(id);
  if (!record) {
    res.status(404).json({ error: 'Shared cloud observation link not found or revoked.' });
    return;
  }

  if (record.passcodeHash) {
    const providedPasscode = String(req.headers['x-share-passcode'] || '').trim();
    if (!providedPasscode || hashPasscode(providedPasscode) !== record.passcodeHash) {
      res.status(401).json({
        requiresPasscode: true,
        title: record.title,
        sharedBy: record.sharedBy,
        createdAt: record.createdAt,
        collaborative: record.collaborative,
        count: record.observations.length,
        error: providedPasscode
          ? 'Incorrect passcode. Please try again.'
          : 'Passcode required to open this private shared list.',
      });
      return;
    }
  }

  res.json({
    id: record.id,
    title: record.title,
    sharedBy: record.sharedBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    collaborative: record.collaborative,
    observations: record.observations,
    summaryReport: record.summaryReport,
  });
});

app.post('/api/shares/:id/events', (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  const record = shareMemoryStore.get(id);
  if (!record) {
    res.status(404).json({ error: 'Shared cloud observation link not found or revoked.' });
    return;
  }

  if (!record.collaborative) {
    res.status(403).json({ error: 'This shared list is read-only.' });
    return;
  }

  if (record.passcodeHash) {
    const providedPasscode = String(req.headers['x-share-passcode'] || '').trim();
    if (!providedPasscode || hashPasscode(providedPasscode) !== record.passcodeHash) {
      res.status(401).json({ error: 'Valid passcode required to modify this shared list.' });
      return;
    }
  }

  const event = req.body as ShareEventPayload;
  const { changed, broadcastPayload } = applyShareEvent(record, event);
  if (!changed || !broadcastPayload) {
    res.status(400).json({ error: 'Unsupported or malformed collaboration event.' });
    return;
  }

  broadcastToShareRoom(id, broadcastPayload);
  res.json({
    ok: true,
    updatedAt: record.updatedAt,
    observations: record.observations,
    summaryReport: record.summaryReport,
  });
});

app.delete('/api/shares/:id', (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  const deleted = shareMemoryStore.delete(id);
  if (deleted) {
    persistSharesToDisk();
    broadcastToShareRoom(id, { type: 'share:revoked' });
  }
  res.json({ revoked: deleted });
});

app.get('/api/ledger', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(ledgerMemoryStore);
});

app.put('/api/ledger', (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<StoredLedger>;
    if (!Array.isArray(body.observations)) {
      res.status(400).json({ error: 'observations array is required.' });
      return;
    }

    const incomingUpdatedAt =
      typeof body.updatedAt === 'string' && body.updatedAt.trim()
        ? body.updatedAt
        : new Date().toISOString();

    ledgerMemoryStore = {
      updatedAt: incomingUpdatedAt,
      observations: body.observations,
      aiReport: body.aiReport ?? null,
      lastObserver: typeof body.lastObserver === 'string' ? body.lastObserver : '',
    };

    persistLedgerToDisk();
    res.json({ ok: true, updatedAt: ledgerMemoryStore.updatedAt });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to persist observation ledger.',
    });
  }
});

app.post('/api/generate-observation', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      existingTitle,
      existingDescription,
      generateNameAndAbbr,
      generateFields,
      generatePicture,
    } = req.body as {
      prompt?: string;
      existingTitle?: string;
      existingDescription?: string;
      generateNameAndAbbr?: boolean;
      generateFields?: boolean;
      generatePicture?: boolean;
    };

    if (!generateNameAndAbbr && !generateFields && !generatePicture) {
      res.status(400).json({ error: 'Select at least one category to generate.' });
      return;
    }

    const ai = getGeminiClient();

    const contextLines = [
      prompt?.trim() ? `User prompt: "${prompt.trim()}"` : '',
      existingTitle?.trim() ? `Current cloud title: "${existingTitle.trim()}"` : '',
      existingDescription?.trim() ? `Current notes: "${existingDescription.trim()}"` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const schemaProperties: Record<string, object> = {};
    const requiredFields: string[] = [];

    if (generateNameAndAbbr) {
      schemaProperties.title = {
        type: Type.STRING,
        description:
          'Full WMO Latin cloud classification (genus + species + variety, e.g., Cumulus humilis radiatus, Cirrostratus fibratus fluctus).',
      };
      schemaProperties.abbreviation = {
        type: Type.STRING,
        description:
          'Standard WMO meteorological abbreviation (e.g., Cu hum rad, Cs fib flu, Sc cas, Cb cap inc).',
      };
      schemaProperties.genusCode = {
        type: Type.STRING,
        description: 'Exactly one of: Ci, Cc, Cs, Ac, As, Ns, Sc, St, Cu, Cb, Unknown',
      };
      schemaProperties.etage = {
        type: Type.STRING,
        description:
          'Exactly one of: High (CH > 6 km), Middle (CM 2–6 km), Low (CL < 2 km), Vertical (Multi-level), Unclassified',
      };
      requiredFields.push('title', 'abbreviation', 'genusCode', 'etage');
    }

    if (generateFields) {
      schemaProperties.oktas = {
        type: Type.INTEGER,
        description: 'Estimated sky cover in oktas from 0 to 8.',
      };
      schemaProperties.altitudeEstimate = {
        type: Type.STRING,
        description: 'Estimated cloud base altitude range in meters (e.g., 1,200 – 1,800 m).',
      };
      schemaProperties.album = {
        type: Type.STRING,
        description: 'Short, realistic scientific sky album collection name (e.g., Convective Afternoon, Dawn Wave Series).',
      };
      schemaProperties.rating = {
        type: Type.INTEGER,
        description: 'Taxonomic distinctiveness / clarity rating from 1 to 5.',
      };
      schemaProperties.description = {
        type: Type.STRING,
        description: 'Concise 2-sentence empirical meteorological field description of the cloud morphology and sky conditions.',
      };
      requiredFields.push('oktas', 'altitudeEstimate', 'album', 'rating', 'description');
    }

    if (generatePicture) {
      schemaProperties.svgMarkup = {
        type: Type.STRING,
        description:
          'A complete, self-contained, richly detailed 800x600 SVG illustration depicting the sky and exact cloud formation described. Use <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"> with atmospheric linear gradients, soft multi-layered bezier cloud shapes, subtle Gaussian blur filters (<feGaussianBlur>) for realistic cloud softness, horizon lighting, and zero text/labels inside the image.',
      };
      requiredFields.push('svgMarkup');
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        'Generate accurate WMO meteorological cloud observation data based on the following input.',
        contextLines || 'Generate a realistic, notable meteorological cloud observation (e.g., Kelvin-Helmholtz wave cloud, Cumulus humilis radiatus, or Altocumulus lenticularis).',
      ].join('\n\n'),
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are an expert WMO cloud taxonomist and atmospheric illustrator. Produce accurate Latin cloud nomenclature, standard WMO abbreviations (like Cu hum rad, Sc cas, Ci fib), realistic meteorological metadata, and—when requested—an artistic, atmospheric, text-free 800x600 SVG sky plate.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
          required: requiredFields,
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as Record<string, unknown>;

    let photoDataUrl: string | undefined;
    if (generatePicture && typeof parsed.svgMarkup === 'string') {
      const cleanSvg = parsed.svgMarkup.trim();
      if (cleanSvg.startsWith('<svg')) {
        const base64Svg = Buffer.from(cleanSvg, 'utf-8').toString('base64');
        photoDataUrl = `data:image/svg+xml;base64,${base64Svg}`;
      }
      delete parsed.svgMarkup;
    }

    res.json({
      ...parsed,
      ...(photoDataUrl ? { photoDataUrl } : {}),
    });
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

app.post('/api/summarize', async (req: Request, res: Response) => {
  try {
    const { observations, focusQuestion } = req.body as {
      observations?: Array<{
        title: string;
        abbreviation?: string;
        genusCode: string;
        etage: string;
        observedAt: string;
        observer: string;
        location: string;
        album?: string;
        oktas: number | null;
        altitudeEstimate: string;
        rating: number;
        description: string;
        hasPhoto: boolean;
        weather?: {
          temperatureC: number | null;
          humidityPct: number | null;
          windSpeedKmh: number | null;
          windDirection: string;
          pressureHpa: number | null;
        } | null;
      }>;
      focusQuestion?: string;
    };

    if (!Array.isArray(observations) || observations.length === 0) {
      res.status(400).json({ error: 'At least one observation is required to generate a summary.' });
      return;
    }

    const ai = getGeminiClient();

    const compactLedger = observations.slice(0, 120).map((obs, idx) => ({
      index: idx + 1,
      classification: obs.title,
      abbreviation: obs.abbreviation || obs.genusCode,
      genus: obs.genusCode,
      etage: obs.etage,
      observedAt: obs.observedAt,
      observer: obs.observer || 'Unspecified',
      location: obs.location || 'Unspecified',
      album: obs.album || 'Unassigned',
      oktas: obs.oktas !== null ? `${obs.oktas}/8` : 'Unrecorded',
      altitude: obs.altitudeEstimate || 'Unrecorded',
      weather: obs.weather
        ? {
            temperatureC: obs.weather.temperatureC,
            humidityPct: obs.weather.humidityPct,
            windSpeedKmh: obs.weather.windSpeedKmh,
            windDirection: obs.weather.windDirection,
            pressureHpa: obs.weather.pressureHpa,
          }
        : 'Unrecorded',
      rating: `${obs.rating}/5`,
      hasPhoto: obs.hasPhoto,
      notes: obs.description || 'No field notes',
    }));

    const userPrompt = [
      'Analyze the following chronological/structured meteorological cloud observation ledger.',
      focusQuestion?.trim()
        ? `Specific analyst question to address in customAnswer: "${focusQuestion.trim()}"`
        : 'No custom analyst question was provided; leave customAnswer as an empty string.',
      '',
      'Observation Ledger JSON:',
      JSON.stringify(compactLedger, null, 2),
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: userPrompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: [
          'You are a senior synoptic meteorologist and WMO International Cloud Atlas specialist.',
          'Synthesize user-submitted sky observation lists into rigorous, empirical meteorological briefings.',
          'Identify cloud étages (High CH, Middle CM, Low CL, Vertical), species/varieties (e.g., radiatus, undulatus, castellanus, fractus, homogenitus, praecipitatio, fluctus), diurnal convective progression, frontal indicators, surface weather correlations (temperature, humidity, wind, barometric pressure), and data quality gaps.',
          'Base every claim strictly on the supplied observation records. Do not invent measurements or observations not present in the dataset.',
        ].join(' '),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            synopticHeadline: {
              type: Type.STRING,
              description: 'Concise 1-sentence scientific headline summarizing the sky conditions.',
            },
            executiveSummary: {
              type: Type.STRING,
              description: '2-3 sentence meteorological overview covering dominant formations, spatial/temporal span, and atmospheric trajectory.',
            },
            dominantRegime: {
              type: Type.STRING,
              description: 'Short label for the primary atmospheric/cloud regime observed.',
            },
            weatherCorrelation: {
              type: Type.STRING,
              description: 'Concise scientific synthesis of surface temperature, humidity, wind, and barometric pressure patterns and how they correlate with the observed cloud formations (or note if surface weather readings were not recorded).',
            },
            atmosphericSignals: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 specific meteorological or stability signals inferred from the cloud genera, varieties, and descriptions.',
            },
            taxonomicBreakdown: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  genus: { type: Type.STRING, description: 'WMO genus name and code, e.g. Cumulus (Cu)' },
                  count: { type: Type.INTEGER, description: 'Number of observations matching this genus' },
                  notes: { type: Type.STRING, description: 'Observed species, varieties, or contextual remarks' },
                },
                required: ['genus', 'count', 'notes'],
              },
            },
            notableTransitions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING, description: 'Date/time window of the transition or specimen' },
                  sequence: { type: Type.STRING, description: 'Cloud transformation or notable feature observed' },
                  meteorologicalMeaning: { type: Type.STRING, description: 'Physical/atmospheric interpretation' },
                },
                required: ['timestamp', 'sequence', 'meteorologicalMeaning'],
              },
            },
            dataQualityNotes: {
              type: Type.STRING,
              description: 'Objective summary of observer participation, photo documentation coverage, and missing fields.',
            },
            customAnswer: {
              type: Type.STRING,
              description: 'Direct scientific answer to the focusQuestion if provided, otherwise empty string.',
            },
          },
          required: [
            'synopticHeadline',
            'executiveSummary',
            'dominantRegime',
            'weatherCorrelation',
            'atmosphericSignals',
            'taxonomicBreakdown',
            'notableTransitions',
            'dataQualityNotes',
            'customAnswer',
          ],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

app.post('/api/identify-cloud', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType, notes } = req.body as {
      imageBase64?: string;
      mimeType?: string;
      notes?: string;
    };

    if (!imageBase64 || !mimeType) {
      res.status(400).json({ error: 'An image payload and mimeType are required.' });
      return;
    }

    const ai = getGeminiClient();

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: [
              'Classify the primary cloud formation in this sky photograph according to the WMO International Cloud Atlas.',
              notes?.trim() ? `Observer context notes: "${notes.trim()}"` : '',
            ]
              .filter(Boolean)
              .join(' '),
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are an expert WMO cloud taxonomist. Identify the primary cloud genus, species, variety, and standard WMO abbreviation from the photograph accurately and concisely.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Full WMO Latin classification (e.g., Cumulus humilis radiatus, Cirrus homogenitus, Stratocumulus stratiformis undulatus).',
            },
            abbreviation: {
              type: Type.STRING,
              description: 'Standard WMO meteorological abbreviation (e.g., Cu hum rad, Ci hom, Sc str un).',
            },
            genusCode: {
              type: Type.STRING,
              description: 'Exactly one of: Ci, Cc, Cs, Ac, As, Ns, Sc, St, Cu, Cb, Unknown',
            },
            etage: {
              type: Type.STRING,
              description:
                'Exactly one of: High (CH > 6 km), Middle (CM 2–6 km), Low (CL < 2 km), Vertical (Multi-level), Unclassified',
            },
            oktas: {
              type: Type.INTEGER,
              description: 'Estimated sky cloud cover in oktas from 0 to 8.',
            },
            altitudeEstimate: {
              type: Type.STRING,
              description: 'Approximate cloud base altitude range (e.g., 800 – 1,500 m).',
            },
            description: {
              type: Type.STRING,
              description: 'Objective 1-2 sentence morphological field description of the cloud structure, optical opacity, and arrangement.',
            },
            suggestedRating: {
              type: Type.INTEGER,
              description: 'Clarity and taxonomic distinctiveness score from 1 to 5.',
            },
          },
          required: ['title', 'abbreviation', 'genusCode', 'etage', 'oktas', 'altitudeEstimate', 'description', 'suggestedRating'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText);
    res.json(parsed);
  } catch (err) {
    const formatted = formatApiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  const shareWss = new WebSocketServer({ noServer: true });
  const liveWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (reqUrl.pathname === '/ws/shares') {
        shareWss.handleUpgrade(req, socket, head, (ws) => {
          shareWss.emit('connection', ws, req);
        });
      } else if (reqUrl.pathname === '/ws/live') {
        liveWss.handleUpgrade(req, socket, head, (ws) => {
          liveWss.emit('connection', ws, req);
        });
      } else {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  liveWss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    try {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const liveId = (reqUrl.searchParams.get('room') || '').trim();
      const passcode = (reqUrl.searchParams.get('passcode') || '').trim();

      if (!liveId || endedLiveIds.has(liveId)) {
        ws.close(4004, 'Live session ended');
        return;
      }

      let record = liveMemoryStore.get(liveId);
      if (!record) {
        record = {
          id: liveId,
          title: (reqUrl.searchParams.get('title') || '').trim() || 'Live Sky Watch',
          hostName: (reqUrl.searchParams.get('host') || '').trim() || 'Observer',
          passcodeHash: null,
          createdAt: new Date().toISOString(),
          sharedNote: '',
          messages: [],
        };
        liveMemoryStore.set(liveId, record);
        persistLiveRoomsToDisk();
      }

      if (record.passcodeHash && (!passcode || hashPasscode(passcode) !== record.passcodeHash)) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      const clientId = crypto.randomBytes(6).toString('hex');
      let roomSet = liveSockets.get(liveId);
      if (!roomSet) {
        roomSet = new Set<WebSocket>();
        liveSockets.set(liveId, roomSet);
      }
      roomSet.add(ws);

      const onlineCount = getLiveOnlineCount(liveId);
      ws.send(
        JSON.stringify({
          type: 'live:init',
          clientId,
          room: {
            id: record.id,
            title: record.title,
            hostName: record.hostName,
            createdAt: record.createdAt,
            sharedNote: record.sharedNote,
            messages: record.messages,
            drafts: getLiveDraftsList(liveId),
            onlineCount,
          },
        })
      );

      broadcastToLiveRoom(liveId, { type: 'live:presence', onlineCount });

      ws.on('message', (raw) => {
        try {
          const current = liveMemoryStore.get(liveId);
          if (!current) return;
          const msg = JSON.parse(raw.toString()) as {
            type?: string;
            isWriting?: boolean;
            author?: string;
            cloudName?: string;
            abbreviation?: string;
            text?: string;
            source?: string;
            sharedNote?: string;
            id?: string;
          };

          if (msg.type === 'live:writing') {
            let draftsMap = liveDrafts.get(liveId);
            if (!draftsMap) {
              draftsMap = new Map<string, LiveWriterDraft>();
              liveDrafts.set(liveId, draftsMap);
            }

            const cloudName = typeof msg.cloudName === 'string' ? msg.cloudName.slice(0, 120) : '';
            const abbreviation =
              typeof msg.abbreviation === 'string' ? msg.abbreviation.slice(0, 40) : '';
            const text = typeof msg.text === 'string' ? msg.text.slice(0, 500) : '';
            const hasContent = Boolean(cloudName.trim() || abbreviation.trim() || text.trim());

            if (msg.isWriting === false || !hasContent) {
              draftsMap.delete(clientId);
            } else {
              draftsMap.set(clientId, {
                clientId,
                author: (typeof msg.author === 'string' && msg.author.trim()) || 'Observer',
                cloudName,
                abbreviation,
                text,
                source: (typeof msg.source === 'string' && msg.source.trim()) || 'Live Note',
                updatedAt: new Date().toISOString(),
              });
            }

            broadcastToLiveRoom(liveId, {
              type: 'live:drafts',
              drafts: getLiveDraftsList(liveId),
            });
            return;
          }

          if (msg.type === 'live:pad' && typeof msg.sharedNote === 'string') {
            current.sharedNote = msg.sharedNote.slice(0, 8000);
            persistLiveRoomsToDisk();
            broadcastToLiveRoom(liveId, {
              type: 'live:pad',
              sharedNote: current.sharedNote,
              updatedBy: (typeof msg.author === 'string' && msg.author.trim()) || 'Observer',
              senderId: clientId,
            });
            return;
          }

          if (msg.type === 'live:post' && typeof msg.id === 'string') {
            const exists = current.messages.some((m) => m.id === msg.id);
            if (exists) return;

            const cloudName = typeof msg.cloudName === 'string' ? msg.cloudName.trim().slice(0, 120) : '';
            const abbreviation =
              typeof msg.abbreviation === 'string' ? msg.abbreviation.trim().slice(0, 40) : '';
            const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 500) : '';
            if (!cloudName && !text) return;

            const entry: LiveStreamNote = {
              id: msg.id,
              author: (typeof msg.author === 'string' && msg.author.trim()) || 'Observer',
              cloudName,
              abbreviation,
              text,
              createdAt: new Date().toISOString(),
            };
            current.messages.unshift(entry);
            if (current.messages.length > 200) {
              current.messages = current.messages.slice(0, 200);
            }
            persistLiveRoomsToDisk();

            const draftsMap = liveDrafts.get(liveId);
            if (draftsMap?.delete(clientId)) {
              broadcastToLiveRoom(liveId, {
                type: 'live:drafts',
                drafts: getLiveDraftsList(liveId),
              });
            }

            broadcastToLiveRoom(liveId, { type: 'live:post', entry });
            return;
          }

          if (msg.type === 'live:delete_post' && typeof msg.id === 'string') {
            const next = current.messages.filter((m) => m.id !== msg.id);
            if (next.length !== current.messages.length) {
              current.messages = next;
              persistLiveRoomsToDisk();
              broadcastToLiveRoom(liveId, { type: 'live:delete_post', id: msg.id });
            }
          }
        } catch {
          // Ignore malformed WS message
        }
      });

      ws.on('close', () => {
        const draftsMap = liveDrafts.get(liveId);
        if (draftsMap?.delete(clientId)) {
          broadcastToLiveRoom(liveId, {
            type: 'live:drafts',
            drafts: getLiveDraftsList(liveId),
          });
        }
        const activeSet = liveSockets.get(liveId);
        if (activeSet) {
          activeSet.delete(ws);
          if (activeSet.size === 0) {
            liveSockets.delete(liveId);
          } else {
            broadcastToLiveRoom(liveId, {
              type: 'live:presence',
              onlineCount: getLiveOnlineCount(liveId),
            });
          }
        }
      });
    } catch {
      ws.close(1011, 'Connection error');
    }
  });

  shareWss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    try {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const shareId = (reqUrl.searchParams.get('share') || '').trim();
      const passcode = (reqUrl.searchParams.get('passcode') || '').trim();
      const record = shareMemoryStore.get(shareId);

      if (!record) {
        ws.close(4004, 'Shared list not found');
        return;
      }

      if (record.passcodeHash && (!passcode || hashPasscode(passcode) !== record.passcodeHash)) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      const clientId = crypto.randomBytes(6).toString('hex');

      let room = shareRooms.get(shareId);
      if (!room) {
        room = new Set<WebSocket>();
        shareRooms.set(shareId, room);
      }
      room.add(ws);

      const collaboratorsCount = getRoomCollaboratorsCount(shareId);
      ws.send(
        JSON.stringify({
          type: 'init',
          clientId,
          drafts: getRoomDraftsList(shareId),
          payload: {
            id: record.id,
            title: record.title,
            sharedBy: record.sharedBy,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            collaborative: record.collaborative,
            observations: record.observations,
            summaryReport: record.summaryReport,
            collaboratorsCount,
          },
        })
      );

      broadcastToShareRoom(shareId, {
        type: 'presence',
        collaboratorsCount,
      });

      ws.on('message', (raw) => {
        try {
          const currentRecord = shareMemoryStore.get(shareId);
          if (!currentRecord || !currentRecord.collaborative) return;
          const parsed = JSON.parse(raw.toString()) as
            | ({
                type: 'writing:update';
                isWriting?: boolean;
                author?: string;
                field?: string;
                title?: string;
                abbreviation?: string;
                notes?: string;
              })
            | ShareEventPayload;

          if (parsed.type === 'writing:update') {
            let draftsMap = roomDrafts.get(shareId);
            if (!draftsMap) {
              draftsMap = new Map<string, LiveDraftState>();
              roomDrafts.set(shareId, draftsMap);
            }

            const titleText = typeof parsed.title === 'string' ? parsed.title.slice(0, 140) : '';
            const abbrText = typeof parsed.abbreviation === 'string' ? parsed.abbreviation.slice(0, 40) : '';
            const notesText = typeof parsed.notes === 'string' ? parsed.notes.slice(0, 220) : '';
            const hasContent = Boolean(titleText.trim() || abbrText.trim() || notesText.trim());

            if (parsed.isWriting === false || !hasContent) {
              draftsMap.delete(clientId);
            } else {
              draftsMap.set(clientId, {
                clientId,
                author: (typeof parsed.author === 'string' && parsed.author.trim()) || 'Collaborator',
                field: (typeof parsed.field === 'string' && parsed.field.trim()) || 'Entry',
                title: titleText,
                abbreviation: abbrText,
                notes: notesText,
                updatedAt: new Date().toISOString(),
              });
            }

            broadcastToShareRoom(shareId, {
              type: 'writing:state',
              drafts: getRoomDraftsList(shareId),
            });
            return;
          }

          const { changed, broadcastPayload } = applyShareEvent(currentRecord, parsed);
          if (changed && broadcastPayload) {
            if (parsed.type === 'observation:upsert') {
              const draftsMap = roomDrafts.get(shareId);
              if (draftsMap?.delete(clientId)) {
                broadcastToShareRoom(shareId, {
                  type: 'writing:state',
                  drafts: getRoomDraftsList(shareId),
                });
              }
            }
            broadcastToShareRoom(shareId, broadcastPayload);
          }
        } catch {
          // Ignore malformed message
        }
      });

      ws.on('close', () => {
        const draftsMap = roomDrafts.get(shareId);
        if (draftsMap?.delete(clientId)) {
          broadcastToShareRoom(shareId, {
            type: 'writing:state',
            drafts: getRoomDraftsList(shareId),
          });
        }
        const activeRoom = shareRooms.get(shareId);
        if (activeRoom) {
          activeRoom.delete(ws);
          if (activeRoom.size === 0) {
            shareRooms.delete(shareId);
            roomDrafts.delete(shareId);
          } else {
            broadcastToShareRoom(shareId, {
              type: 'presence',
              collaboratorsCount: getRoomCollaboratorsCount(shareId),
            });
          }
        }
      });
    } catch {
      ws.close(1011, 'Connection error');
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Nephos Ledger server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
