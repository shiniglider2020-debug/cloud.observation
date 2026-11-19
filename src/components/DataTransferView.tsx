import { Download, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CloudObservation } from '../types/cloud';
import {
  downloadTextFile,
  exportObservationsToCsv,
  parseCsvToObservations,
} from '../utils/csvAndImage';

interface DataTransferViewProps {
  observations: CloudObservation[];
  onImportObservations: (items: CloudObservation[]) => void;
  onClearAll: () => void;
  onReturnToObservations: () => void;
}

export function DataTransferView({
  observations,
  onImportObservations,
  onClearAll,
  onReturnToObservations,
}: DataTransferViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          throw new Error('JSON file must contain an array of cloud observations.');
        }
        const valid = parsed.filter(
          (item): item is CloudObservation =>
            typeof item === 'object' && item !== null && typeof item.title === 'string'
        );
        if (valid.length === 0) {
          throw new Error('No valid observation records found in JSON file.');
        }
        onImportObservations(valid);
        setStatusMessage(`Imported ${valid.length} observation records from ${file.name}.`);
      } else {
        const parsed = parseCsvToObservations(text);
        if (parsed.length === 0) {
          throw new Error(
            'Could not parse observation rows from CSV. Ensure headers include Title, Date, Person, Rating (0-5), or Description.'
          );
        }
        onImportObservations(parsed);
        setStatusMessage(`Imported ${parsed.length} observation records from ${file.name}.`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to import file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportCsv = () => {
    const csv = exportObservationsToCsv(observations);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`nephos-cloud-observations-${stamp}.csv`, csv, 'text/csv;charset=utf-8;');
  };

  const handleExportJson = () => {
    const json = JSON.stringify(observations, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`nephos-cloud-observations-${stamp}.json`, json, 'application/json');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-display text-lg font-bold text-slate-900">
          Data Import &amp; Export
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Import Microsoft Lists CSV exports or Nephos JSON archives, or export your current observation ledger for external analysis.
        </p>
      </div>

      {statusMessage && (
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={onReturnToObservations}
            className="font-semibold text-emerald-800 underline hover:text-emerald-950"
          >
            View List
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Import Card */}
        <section className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Import CSV or JSON
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Supports standard Microsoft Lists CSV exports (columns: <span className="font-mono">Title</span>, <span className="font-mono">Date</span>, <span className="font-mono">Person</span>, <span className="font-mono">Rating (0-5)</span>, <span className="font-mono">Description</span>) as well as full JSON backups with embedded visual plates.
            </p>
          </div>

          <div className="mt-5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Select CSV / JSON File
            </button>
          </div>
        </section>

        {/* Export Card */}
        <section className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Export Observation Ledger
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Download your <span className="font-mono tabular-nums font-medium">{observations.length}</span> logged observations as a Microsoft Lists-compatible CSV spreadsheet or a complete JSON archive.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={observations.length === 0}
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export CSV
            </button>
            <button
              type="button"
              disabled={observations.length === 0}
              onClick={handleExportJson}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export JSON
            </button>
          </div>
        </section>
      </div>

      {/* Reset / Blank Ledger */}
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Reset to Blank Ledger
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Clear all locally stored observations and return the list to its initial blank state.
          </p>
        </div>

        {observations.length === 0 ? (
          <span className="font-mono text-xs text-slate-400">Ledger is currently blank</span>
        ) : confirmClear ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setConfirmClear(false);
                setStatusMessage('All observations cleared. Ledger is now blank.');
              }}
              className="rounded-md bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Confirm Clear All ({observations.length})
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3.5 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear All Entries
          </button>
        )}
      </section>
    </div>
  );
}
