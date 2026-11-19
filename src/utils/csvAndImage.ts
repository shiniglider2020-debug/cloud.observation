import { inferAbbreviationFromTitle, inferGenusFromTitle } from '../data/wmoTaxonomy';
import type { CloudObservation, WeatherConditions } from '../types/cloud';

export async function compressImageToDataUrl(file: File, maxDimension = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function formatObservedTimestamp(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatCalendarDate(value: string): string {
  if (!value) return 'Undated';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTimeOnly(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function hasAnyWeatherData(weather?: WeatherConditions | null): boolean {
  if (!weather) return false;
  return (
    weather.temperatureC !== null ||
    weather.humidityPct !== null ||
    weather.windSpeedKmh !== null ||
    Boolean(weather.windDirection?.trim()) ||
    weather.pressureHpa !== null
  );
}

export function formatWeatherCompact(weather?: WeatherConditions | null): string {
  if (!weather || !hasAnyWeatherData(weather)) return '';
  const parts: string[] = [];
  if (weather.temperatureC !== null) parts.push(`${weather.temperatureC}°C`);
  if (weather.humidityPct !== null) parts.push(`${weather.humidityPct}% RH`);
  if (weather.windSpeedKmh !== null) {
    const dir = weather.windDirection?.trim() ? ` ${weather.windDirection.trim()}` : '';
    parts.push(`${weather.windSpeedKmh} km/h${dir}`);
  } else if (weather.windDirection?.trim()) {
    parts.push(weather.windDirection.trim());
  }
  if (weather.pressureHpa !== null) parts.push(`${weather.pressureHpa} hPa`);
  return parts.join(' · ');
}

function escapeCsvCell(val: string | number | null | undefined): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportObservationsToCsv(observations: CloudObservation[]): string {
  const headers = [
    'Title',
    'Abbreviation',
    'Genus',
    'Etage',
    'Date',
    'Person',
    'Location',
    'Album',
    'Oktas',
    'Altitude',
    'Temp (C)',
    'Humidity (%)',
    'Wind Speed (km/h)',
    'Wind Direction',
    'Pressure (hPa)',
    'Rating (0-5)',
    'Description',
    'Has Photo',
  ];
  const rows = observations.map((obs) =>
    [
      escapeCsvCell(obs.title),
      escapeCsvCell(obs.abbreviation),
      escapeCsvCell(obs.genusCode),
      escapeCsvCell(obs.etage),
      escapeCsvCell(formatObservedTimestamp(obs.observedAt)),
      escapeCsvCell(obs.observer),
      escapeCsvCell(obs.location),
      escapeCsvCell(obs.album),
      escapeCsvCell(obs.oktas !== null ? obs.oktas : ''),
      escapeCsvCell(obs.altitudeEstimate),
      escapeCsvCell(obs.weather?.temperatureC ?? ''),
      escapeCsvCell(obs.weather?.humidityPct ?? ''),
      escapeCsvCell(obs.weather?.windSpeedKmh ?? ''),
      escapeCsvCell(obs.weather?.windDirection ?? ''),
      escapeCsvCell(obs.weather?.pressureHpa ?? ''),
      escapeCsvCell(obs.rating),
      escapeCsvCell(obs.description),
      escapeCsvCell(obs.photoDataUrl ? 'Yes' : 'No'),
    ].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(current.trim());
        if (row.some((cell) => cell.length > 0)) {
          rows.push(row);
        }
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}

function toDatetimeLocalValue(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 16);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 16);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const mins = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

function parseOptionalNumber(raw: string): number | null {
  if (!raw.trim()) return null;
  const num = Number(raw);
  return Number.isNaN(num) ? null : num;
}

export function parseCsvToObservations(csvText: string): CloudObservation[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headerMap = new Map<string, number>();
  rows[0].forEach((header, idx) => {
    headerMap.set(header.toLowerCase().trim(), idx);
  });

  const getCell = (row: string[], keys: string[]): string => {
    for (const key of keys) {
      const idx = headerMap.get(key);
      if (idx !== undefined && row[idx] !== undefined) {
        return row[idx];
      }
    }
    return '';
  };

  const now = new Date().toISOString();
  return rows.slice(1).map((row, idx) => {
    const title = getCell(row, ['title', 'classification', 'cloud', 'name']) || 'Unclassified Cloud';
    const inferred = inferGenusFromTitle(title);
    const abbr =
      getCell(row, ['abbreviation', 'abbr', 'code']) ||
      inferAbbreviationFromTitle(title, inferred.genusCode);
    const rawRating = Number(getCell(row, ['rating (0-5)', 'rating', 'score']));
    const rawOktas = getCell(row, ['oktas', 'cover', 'cloud cover']);
    const parsedOktas =
      rawOktas !== '' && !Number.isNaN(Number(rawOktas))
        ? Math.min(8, Math.max(0, Number(rawOktas)))
        : null;

    const temperatureC = parseOptionalNumber(getCell(row, ['temp (c)', 'temperature', 'temp']));
    const humidityPct = parseOptionalNumber(getCell(row, ['humidity (%)', 'humidity']));
    const windSpeedKmh = parseOptionalNumber(getCell(row, ['wind speed (km/h)', 'wind speed', 'wind']));
    const windDirection = getCell(row, ['wind direction', 'wind dir']);
    const pressureHpa = parseOptionalNumber(getCell(row, ['pressure (hpa)', 'pressure']));

    const hasWeather =
      temperatureC !== null ||
      humidityPct !== null ||
      windSpeedKmh !== null ||
      Boolean(windDirection) ||
      pressureHpa !== null;

    return {
      id: `imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      abbreviation: abbr,
      genusCode: inferred.genusCode,
      etage: inferred.etage,
      observedAt: toDatetimeLocalValue(getCell(row, ['date', 'observedat', 'observed at', 'timestamp'])),
      observer: getCell(row, ['person', 'observer', 'author']) || '-',
      location: getCell(row, ['location', 'station', 'place']),
      album: getCell(row, ['album', 'collection', 'folder']),
      oktas: parsedOktas,
      altitudeEstimate: getCell(row, ['altitude', 'altitudeestimate']),
      weather: hasWeather
        ? {
            temperatureC,
            humidityPct,
            windSpeedKmh,
            windDirection,
            pressureHpa,
            source: 'manual',
          }
        : null,
      rating: !Number.isNaN(rawRating) ? Math.min(5, Math.max(0, Math.round(rawRating))) : 1,
      description: getCell(row, ['description', 'notes', 'remarks']),
      photoDataUrl: null,
      createdAt: now,
    };
  });
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
