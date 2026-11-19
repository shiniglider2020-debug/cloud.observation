export type GenusCode =
  | 'Ci'
  | 'Cc'
  | 'Cs'
  | 'Ac'
  | 'As'
  | 'Ns'
  | 'Sc'
  | 'St'
  | 'Cu'
  | 'Cb'
  | 'Unknown';

export type CloudEtage =
  | 'High (CH > 6 km)'
  | 'Middle (CM 2–6 km)'
  | 'Low (CL < 2 km)'
  | 'Vertical (Multi-level)'
  | 'Unclassified';

export interface WeatherConditions {
  temperatureC: number | null;
  humidityPct: number | null;
  windSpeedKmh: number | null;
  windDirection: string;
  pressureHpa: number | null;
  source?: 'auto' | 'manual';
}

export interface CloudObservation {
  id: string;
  title: string;
  abbreviation: string;
  genusCode: GenusCode;
  etage: CloudEtage;
  observedAt: string; // ISO string or YYYY-MM-DDTHH:mm
  observer: string;
  location: string;
  album: string;
  oktas: number | null; // 0 to 8
  altitudeEstimate: string;
  rating: number; // 0 to 5
  description: string;
  photoDataUrl: string | null;
  weather?: WeatherConditions | null;
  createdAt: string;
}

export type WorkspaceTab = 'observations' | 'summary' | 'taxonomy' | 'import-export';
export type ViewMode = 'grid' | 'gallery' | 'album' | 'timeline';
export type SortField = 'observedAt' | 'title' | 'rating' | 'oktas';
export type SortDirection = 'asc' | 'desc';

export interface TaxonomicBreakdownItem {
  genus: string;
  count: number;
  notes: string;
}

export interface NotableTransitionItem {
  timestamp: string;
  sequence: string;
  meteorologicalMeaning: string;
}

export interface AiSummaryReport {
  synopticHeadline: string;
  executiveSummary: string;
  dominantRegime: string;
  weatherCorrelation: string;
  atmosphericSignals: string[];
  taxonomicBreakdown: TaxonomicBreakdownItem[];
  notableTransitions: NotableTransitionItem[];
  dataQualityNotes: string;
  customAnswer: string;
  generatedAt?: string;
  analyzedCount?: number;
}

export interface CloudIdentificationResult {
  title: string;
  abbreviation: string;
  genusCode: GenusCode;
  etage: CloudEtage;
  oktas: number;
  altitudeEstimate: string;
  description: string;
  suggestedRating: number;
}

export interface GeneratedObservationDraft {
  title?: string;
  abbreviation?: string;
  genusCode?: GenusCode;
  etage?: CloudEtage;
  oktas?: number;
  altitudeEstimate?: string;
  album?: string;
  rating?: number;
  description?: string;
  photoDataUrl?: string;
}

export interface SharedLedgerPayload {
  id: string;
  title: string;
  sharedBy: string;
  createdAt: string;
  updatedAt?: string;
  collaborative: boolean;
  observations: CloudObservation[];
  summaryReport: AiSummaryReport | null;
}

export interface CreatedShareRecord {
  shareId: string;
  title: string;
  url: string;
  createdAt: string;
  hasPasscode: boolean;
  collaborative: boolean;
  count: number;
}

export interface LiveDraftState {
  clientId: string;
  author: string;
  field: string;
  title: string;
  abbreviation: string;
  notes: string;
  updatedAt: string;
}

export interface LiveWriterDraft {
  clientId: string;
  author: string;
  cloudName: string;
  abbreviation: string;
  text: string;
  source: string;
  updatedAt: string;
}

export interface LiveStreamNote {
  id: string;
  author: string;
  cloudName: string;
  abbreviation: string;
  text: string;
  createdAt: string;
}

export interface LiveRoomState {
  id: string;
  title: string;
  hostName: string;
  createdAt: string;
  sharedNote: string;
  messages: LiveStreamNote[];
  drafts: LiveWriterDraft[];
  onlineCount: number;
}
