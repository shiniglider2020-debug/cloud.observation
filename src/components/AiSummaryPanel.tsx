import { Check, Copy, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AiSummaryReport, CloudObservation } from '../types/cloud';

interface AiSummaryPanelProps {
  allObservations: CloudObservation[];
  filteredObservations: CloudObservation[];
  report: AiSummaryReport | null;
  onReportGenerated: (report: AiSummaryReport) => void;
  onOpenNewObservation: () => void;
}

export function AiSummaryPanel({
  allObservations,
  filteredObservations,
  report,
  onReportGenerated,
  onOpenNewObservation,
}: AiSummaryPanelProps) {
  const [scope, setScope] = useState<'all' | 'filtered'>('all');
  const [focusQuestion, setFocusQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isFilteredDifferent = filteredObservations.length !== allObservations.length;
  const targetObservations =
    scope === 'filtered' && isFilteredDifferent ? filteredObservations : allObservations;

  const weatherStats = useMemo(() => {
    const temps = targetObservations
      .map((o) => o.weather?.temperatureC)
      .filter((v): v is number => v !== null && v !== undefined);
    const humidities = targetObservations
      .map((o) => o.weather?.humidityPct)
      .filter((v): v is number => v !== null && v !== undefined);
    const winds = targetObservations
      .map((o) => o.weather?.windSpeedKmh)
      .filter((v): v is number => v !== null && v !== undefined);
    const pressures = targetObservations
      .map((o) => o.weather?.pressureHpa)
      .filter((v): v is number => v !== null && v !== undefined);

    const hasAny =
      temps.length > 0 ||
      humidities.length > 0 ||
      winds.length > 0 ||
      pressures.length > 0;

    return {
      hasAny,
      tempCount: temps.length,
      tempMean:
        temps.length > 0
          ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)
          : null,
      tempMin: temps.length > 0 ? Math.min(...temps).toFixed(1) : null,
      tempMax: temps.length > 0 ? Math.max(...temps).toFixed(1) : null,
      humidityMean:
        humidities.length > 0
          ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length)
          : null,
      windMean:
        winds.length > 0
          ? (winds.reduce((a, b) => a + b, 0) / winds.length).toFixed(1)
          : null,
      windMax: winds.length > 0 ? Math.max(...winds).toFixed(1) : null,
      pressureMean:
        pressures.length > 0
          ? (pressures.reduce((a, b) => a + b, 0) / pressures.length).toFixed(1)
          : null,
      pressureMin: pressures.length > 0 ? Math.min(...pressures).toFixed(1) : null,
      pressureMax: pressures.length > 0 ? Math.max(...pressures).toFixed(1) : null,
    };
  }, [targetObservations]);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (targetObservations.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const payload = targetObservations.map((obs) => ({
        title: obs.title,
        abbreviation: obs.abbreviation,
        genusCode: obs.genusCode,
        etage: obs.etage,
        observedAt: obs.observedAt,
        observer: obs.observer,
        location: obs.location,
        album: obs.album,
        oktas: obs.oktas,
        altitudeEstimate: obs.altitudeEstimate,
        weather: obs.weather ?? null,
        rating: obs.rating,
        description: obs.description,
        hasPhoto: Boolean(obs.photoDataUrl),
      }));

      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observations: payload,
          focusQuestion: focusQuestion.trim(),
        }),
      });

      const data = (await response.json()) as AiSummaryReport & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate meteorological summary.');
      }

      onReportGenerated({
        ...data,
        generatedAt: new Date().toLocaleString(),
        analyzedCount: payload.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI summarization service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!report) return;
    const lines: string[] = [
      `# Synoptic Cloud & Weather Observation Summary`,
      `Generated: ${report.generatedAt ?? 'Just now'} · Specimens analyzed: ${report.analyzedCount ?? targetObservations.length}`,
      ``,
      `## ${report.synopticHeadline}`,
      `**Dominant Regime:** ${report.dominantRegime}`,
      ``,
      report.executiveSummary,
      ``,
      `### Surface Weather & Cloud Correlation`,
      report.weatherCorrelation || 'No surface weather telemetry recorded.',
      ``,
      `### Atmospheric Stability & Weather Signals`,
      ...report.atmosphericSignals.map((s) => `- ${s}`),
      ``,
      `### Taxonomic Breakdown`,
      ...report.taxonomicBreakdown.map((t) => `- **${t.genus}** (${t.count}): ${t.notes}`),
      ``,
      `### Notable Transitions & Specimens`,
      ...report.notableTransitions.map(
        (tr) => `- **${tr.timestamp}** — ${tr.sequence}: ${tr.meteorologicalMeaning}`
      ),
      ``,
      `### Data Quality & Observer Coverage`,
      report.dataQualityNotes,
    ];

    if (report.customAnswer) {
      lines.push('', '### Analyst Question Response', report.customAnswer);
    }

    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (allObservations.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-10 text-center">
        <FileText className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
        <h2 className="mt-3 font-display text-lg font-semibold text-slate-900">
          No observations logged yet
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
          The synoptic AI analyzer requires at least one cloud observation entry. Log your first sky observation or import a CSV ledger to generate a meteorological report.
        </p>
        <button
          type="button"
          onClick={onOpenNewObservation}
          className="mt-5 rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
        >
          Log First Observation
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control & Prompt Panel */}
      <form
        onSubmit={handleGenerate}
        className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              AI Synoptic &amp; Weather Data Summary
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Aggregate surface weather telemetry (temperature, humidity, wind, barometric pressure) alongside WMO cloud classifications and transitions.
            </p>
          </div>

          {isFilteredDifferent && (
            <div className="inline-flex items-center rounded-md bg-slate-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`rounded px-3 py-1 font-medium whitespace-nowrap transition-colors ${
                  scope === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                All ({allObservations.length})
              </button>
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`rounded px-3 py-1 font-medium whitespace-nowrap transition-colors ${
                  scope === 'filtered' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Filtered ({filteredObservations.length})
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={focusQuestion}
            onChange={(e) => setFocusQuestion(e.target.value)}
            placeholder="Optional focus question (e.g., How did pressure and humidity relate to cumulus growth?)"
            aria-label="Optional meteorological focus question"
            className="flex-1 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
          />
          <button
            type="submit"
            disabled={isLoading || targetObservations.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-700 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                Analyzing {targetObservations.length} Records...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {report ? 'Regenerate AI Summary' : `Generate AI Summary (${targetObservations.length})`}
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
            {error}
          </div>
        )}
      </form>

      {/* Live Empirical Surface Weather Data Summary */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-3">
          <h3 className="font-display text-xs font-semibold tracking-wide text-slate-700">
            Measured Surface Weather Summary
          </h3>
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
            {weatherStats.hasAny
              ? `Telemetry present across ${targetObservations.length} observations`
              : 'No surface weather telemetry logged yet'}
          </span>
        </div>
        <div className="grid grid-cols-2 divide-y divide-slate-200 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="p-5">
            <div className="text-[11px] font-medium text-slate-500">Temperature</div>
            <div className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {weatherStats.tempMean !== null ? `${weatherStats.tempMean} °C` : '—'}
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
              {weatherStats.tempMin !== null && weatherStats.tempMax !== null
                ? `Range: ${weatherStats.tempMin} – ${weatherStats.tempMax} °C`
                : 'No readings'}
            </div>
          </div>

          <div className="p-5">
            <div className="text-[11px] font-medium text-slate-500">Mean Rel. Humidity</div>
            <div className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {weatherStats.humidityMean !== null ? `${weatherStats.humidityMean} %` : '—'}
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-500">
              {weatherStats.humidityMean !== null ? 'Surface moisture index' : 'No readings'}
            </div>
          </div>

          <div className="p-5">
            <div className="text-[11px] font-medium text-slate-500">Mean / Peak Wind</div>
            <div className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {weatherStats.windMean !== null ? `${weatherStats.windMean} km/h` : '—'}
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
              {weatherStats.windMax !== null ? `Peak: ${weatherStats.windMax} km/h` : 'No readings'}
            </div>
          </div>

          <div className="p-5">
            <div className="text-[11px] font-medium text-slate-500">Barometric Pressure</div>
            <div className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {weatherStats.pressureMean !== null ? `${weatherStats.pressureMean} hPa` : '—'}
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
              {weatherStats.pressureMin !== null && weatherStats.pressureMax !== null
                ? `Range: ${weatherStats.pressureMin} – ${weatherStats.pressureMax} hPa`
                : 'No readings'}
            </div>
          </div>
        </div>
      </section>

      {/* Loading Skeleton */}
      {isLoading && !report && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
          <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-2">
            <div className="h-32 animate-pulse rounded bg-slate-100" />
            <div className="h-32 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      )}

      {/* Structured Meteorological Report */}
      {report && (
        <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-600">
              <span className="font-semibold text-sky-800">{report.dominantRegime}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{report.analyzedCount} specimens analyzed</span>
              {report.generatedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{report.generatedAt}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  Copied Markdown
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy Markdown Report
                </>
              )}
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            {/* Headline & Executive Summary */}
            <div className="p-6">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {report.synopticHeadline}
              </h3>
              <p className="mt-2.5 max-w-4xl text-sm leading-relaxed text-slate-700">
                {report.executiveSummary}
              </p>

              {report.weatherCorrelation && (
                <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold tracking-wider text-slate-600">
                    Surface Weather &amp; Cloud Correlation
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-800">
                    {report.weatherCorrelation}
                  </p>
                </div>
              )}

              {report.customAnswer && (
                <div className="mt-4 rounded-md border border-sky-200 bg-sky-50/50 p-4">
                  <div className="text-[11px] font-semibold tracking-wider text-sky-900">
                    Focus Question Response
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-800">
                    {report.customAnswer}
                  </p>
                </div>
              )}
            </div>

            {/* Atmospheric Signals & Data Quality */}
            <div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              <div className="p-6 lg:col-span-2">
                <h4 className="text-xs font-semibold tracking-wide text-slate-500">
                  Atmospheric Stability &amp; Weather Signals
                </h4>
                <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
                  {report.atmosphericSignals.map((signal, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="mt-1 font-mono text-xs font-semibold text-sky-700 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span className="leading-relaxed">{signal}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6">
                <h4 className="text-xs font-semibold tracking-wide text-slate-500">
                  Ledger Quality &amp; Coverage
                </h4>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {report.dataQualityNotes}
                </p>
              </div>
            </div>

            {/* Taxonomic Breakdown Table */}
            <div className="p-6">
              <h4 className="text-xs font-semibold tracking-wide text-slate-500">
                Taxonomic Distribution
              </h4>
              <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <th className="px-4 py-2.5">WMO Genus</th>
                      <th className="w-24 px-4 py-2.5 text-right">Count</th>
                      <th className="px-4 py-2.5">Observed Features &amp; Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {report.taxonomicBreakdown.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2.5 font-display font-semibold text-slate-900 whitespace-nowrap">
                          {row.genus}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800 tabular-nums">
                          {row.count}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notable Transitions */}
            {report.notableTransitions.length > 0 && (
              <div className="p-6">
                <h4 className="text-xs font-semibold tracking-wide text-slate-500">
                  Notable Transitions &amp; Synoptic Specimens
                </h4>
                <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200">
                  {report.notableTransitions.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-6"
                    >
                      <div className="w-40 shrink-0 font-mono text-xs font-medium text-sky-800 tabular-nums">
                        {item.timestamp}
                      </div>
                      <div className="flex-1">
                        <div className="font-display text-xs font-semibold text-slate-900">
                          {item.sequence}
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                          {item.meteorologicalMeaning}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
