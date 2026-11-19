import type { CloudObservation } from '../types/cloud';

interface TelemetryStripProps {
  totalCount: number;
  filteredCount: number;
  observations: CloudObservation[];
}

export function TelemetryStrip({ totalCount, filteredCount, observations }: TelemetryStripProps) {
  const isFiltered = filteredCount !== totalCount;

  const avgRating =
    observations.length > 0
      ? (observations.reduce((sum, item) => sum + item.rating, 0) / observations.length).toFixed(1)
      : '—';

  const oktasEntries = observations.filter((item) => item.oktas !== null);
  const avgOktas =
    oktasEntries.length > 0
      ? (
          oktasEntries.reduce((sum, item) => sum + (item.oktas ?? 0), 0) / oktasEntries.length
        ).toFixed(1)
      : '—';

  const tempEntries = observations.filter(
    (item) => item.weather?.temperatureC !== null && item.weather?.temperatureC !== undefined
  );
  const avgTemp =
    tempEntries.length > 0
      ? (
          tempEntries.reduce((sum, item) => sum + (item.weather?.temperatureC ?? 0), 0) /
          tempEntries.length
        ).toFixed(1)
      : '—';

  const pressureEntries = observations.filter(
    (item) => item.weather?.pressureHpa !== null && item.weather?.pressureHpa !== undefined
  );
  const avgPressure =
    pressureEntries.length > 0
      ? Math.round(
          pressureEntries.reduce((sum, item) => sum + (item.weather?.pressureHpa ?? 0), 0) /
            pressureEntries.length
        )
      : null;

  const photoCount = observations.filter((item) => Boolean(item.photoDataUrl)).length;

  const etageCounts = new Map<string, number>();
  observations.forEach((item) => {
    if (item.etage !== 'Unclassified') {
      etageCounts.set(item.etage, (etageCounts.get(item.etage) ?? 0) + 1);
    }
  });
  let dominantEtage = '—';
  let maxEtageCount = 0;
  etageCounts.forEach((count, etage) => {
    if (count > maxEtageCount) {
      maxEtageCount = count;
      dominantEtage = etage.split(' (')[0];
    }
  });

  return (
    <section
      aria-label="Observation ledger summary metrics"
      className="border-b border-slate-200 bg-white"
    >
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-y divide-slate-200 sm:grid-cols-3 lg:grid-cols-6 sm:divide-x sm:divide-y-0 px-4 sm:px-6">
        <div className="py-3 pr-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-500">
            Logged Specimens
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
            <span>{filteredCount}</span>
            {isFiltered && (
              <span className="text-xs font-normal text-slate-500">of {totalCount}</span>
            )}
          </div>
        </div>

        <div className="py-3 px-0 sm:px-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-500">
            Dominant Étage
          </div>
          <div className="mt-0.5 truncate font-mono text-lg font-semibold text-slate-900">
            {dominantEtage}
          </div>
        </div>

        <div className="py-3 pr-4 sm:px-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-500">
            Mean Sky Cover
          </div>
          <div className="mt-0.5 flex items-baseline font-mono text-lg font-semibold text-slate-900 tabular-nums">
            <span>{avgOktas}</span>
            {avgOktas !== '—' && (
              <span className="ml-1 text-xs font-normal text-slate-500">/ 8 oktas</span>
            )}
          </div>
        </div>

        <div className="py-3 px-0 sm:px-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-500">
            Surface Weather
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
            <span>{avgTemp !== '—' ? `${avgTemp}°C` : '—'}</span>
            {avgPressure !== null && (
              <span className="text-xs font-normal text-slate-500">· {avgPressure} hPa</span>
            )}
          </div>
        </div>

        <div className="py-3 pr-4 sm:px-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-500">
            Mean Clarity Rating
          </div>
          <div className="mt-0.5 flex items-baseline font-mono text-lg font-semibold text-slate-900 tabular-nums">
            <span>{avgRating}</span>
            {avgRating !== '—' && (
              <span className="ml-1 text-xs font-normal text-slate-500">/ 5.0</span>
            )}
          </div>
        </div>

        <div className="py-3 px-0 sm:pl-4">
          <div className="text-[11px] font-medium tracking-wider text-slate-500">
            Visual Plates
          </div>
          <div className="mt-0.5 flex items-baseline font-mono text-lg font-semibold text-slate-900 tabular-nums">
            <span>{photoCount}</span>
            <span className="ml-1 text-xs font-normal text-slate-500">
              / {observations.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
