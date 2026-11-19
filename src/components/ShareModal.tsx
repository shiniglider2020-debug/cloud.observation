import { Check, Copy, Link2, Loader2, Lock, Share2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AiSummaryReport, CloudObservation, CreatedShareRecord } from '../types/cloud';

const MY_SHARES_KEY = 'nephos_my_shares_v1';

function loadMyShares(): CreatedShareRecord[] {
  try {
    const raw = localStorage.getItem(MY_SHARES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  allObservations: CloudObservation[];
  filteredObservations: CloudObservation[];
  aiReport: AiSummaryReport | null;
  defaultAuthor: string;
  presetTitle?: string;
  presetObservations?: CloudObservation[] | null;
}

export function ShareModal({
  isOpen,
  onClose,
  allObservations,
  filteredObservations,
  aiReport,
  defaultAuthor,
  presetTitle,
  presetObservations,
}: ShareModalProps) {
  const [scope, setScope] = useState<'preset' | 'all' | 'filtered'>('all');
  const [title, setTitle] = useState('');
  const [sharedBy, setSharedBy] = useState('');
  const [passcode, setPasscode] = useState('');
  const [includeSummary, setIncludeSummary] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myShares, setMyShares] = useState<CreatedShareRecord[]>(() => loadMyShares());

  useEffect(() => {
    if (!isOpen) return;
    setShareUrl(null);
    setCopied(false);
    setError(null);
    setPasscode('');
    setSharedBy(defaultAuthor);
    if (presetObservations && presetObservations.length > 0) {
      setScope('preset');
      setTitle(presetTitle || 'Private Cloud Album');
    } else if (filteredObservations.length !== allObservations.length) {
      setScope('filtered');
      setTitle('Filtered Cloud Observation Ledger');
    } else {
      setScope('all');
      setTitle('Private Cloud Observation Ledger');
    }
  }, [
    isOpen,
    presetObservations,
    presetTitle,
    defaultAuthor,
    filteredObservations.length,
    allObservations.length,
  ]);

  if (!isOpen) return null;

  const targetObservations =
    scope === 'preset' && presetObservations
      ? presetObservations
      : scope === 'filtered'
      ? filteredObservations
      : allObservations;

  const persistMyShares = (next: CreatedShareRecord[]) => {
    setMyShares(next);
    try {
      localStorage.setItem(MY_SHARES_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetObservations.length === 0) {
      setError('Cannot share an empty observation list.');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Private Cloud Observation Ledger',
          sharedBy: sharedBy.trim() || 'Observer',
          passcode: passcode.trim(),
          observations: targetObservations,
          summaryReport: includeSummary ? aiReport : null,
        }),
      });
      const data = (await response.json()) as {
        shareId?: string;
        createdAt?: string;
        hasPasscode?: boolean;
        appUrl?: string | null;
        error?: string;
      };
      if (!response.ok || !data.shareId) {
        throw new Error(data.error || 'Failed to create private share link.');
      }

      const baseUrl = data.appUrl || window.location.origin;
      const url = `${baseUrl}/?share=${data.shareId}`;
      setShareUrl(url);

      const newRecord: CreatedShareRecord = {
        shareId: data.shareId,
        title: title.trim() || 'Private Cloud Observation Ledger',
        url,
        createdAt: data.createdAt || new Date().toISOString(),
        hasPasscode: Boolean(data.hasPasscode),
        count: targetObservations.length,
      };
      persistMyShares([newRecord, ...myShares].slice(0, 12));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create share link.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      await fetch(`/api/shares/${encodeURIComponent(shareId)}`, { method: 'DELETE' });
    } catch {
      // Proceed removing local reference
    }
    persistMyShares(myShares.filter((item) => item.shareId !== shareId));
    if (shareUrl && shareUrl.includes(shareId)) {
      setShareUrl(null);
    }
  };

  const handleCopyUrl = async (urlToCopy: string, id?: string) => {
    await navigator.clipboard.writeText(urlToCopy);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl || typeof navigator.share !== 'function') return;
    try {
      await navigator.share({
        title: title || 'Cloud Observation Ledger',
        text: `View ${targetObservations.length} sky observations on Nephos Ledger`,
        url: shareUrl,
      });
    } catch {
      // User cancelled share sheet
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="share-modal-title"
              className="font-display text-base font-bold text-slate-900"
            >
              Share Private List via Secret Link
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Your main ledger stays private on your device. Only recipients with this unlisted link{passcode.trim() ? ' and passcode' : ''} can open this snapshot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <form onSubmit={handleGenerateLink} className="space-y-4">
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Observations Included
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-md bg-slate-100 p-1 text-xs">
                {presetObservations && presetObservations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setScope('preset');
                      setShareUrl(null);
                    }}
                    className={`rounded px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                      scope === 'preset'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Selected ({presetObservations.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setScope('all');
                    setShareUrl(null);
                  }}
                  className={`rounded px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                    scope === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  All Logged ({allObservations.length})
                </button>
                {filteredObservations.length !== allObservations.length && (
                  <button
                    type="button"
                    onClick={() => {
                      setScope('filtered');
                      setShareUrl(null);
                    }}
                    className={`rounded px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                      scope === 'filtered'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Filtered ({filteredObservations.length})
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="share-title" className="block text-xs font-semibold text-slate-700">
                  Shared Ledger Title
                </label>
                <input
                  id="share-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Bangkok Sky Log"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <div>
                <label htmlFor="share-by" className="block text-xs font-semibold text-slate-700">
                  Shared By
                </label>
                <input
                  id="share-by"
                  type="text"
                  value={sharedBy}
                  onChange={(e) => setSharedBy(e.target.value)}
                  placeholder="e.g. Atlas Kaytser"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="share-passcode" className="block text-xs font-semibold text-slate-700">
                Optional Access Passcode (for Private Link)
              </label>
              <div className="relative mt-1.5">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="share-passcode"
                  type="text"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Leave blank for anyone with link, or set a passcode"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>
            </div>

            {aiReport && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={(e) => setIncludeSummary(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                />
                Include generated AI Synoptic Summary with shared link
              </label>
            )}

            {shareUrl ? (
              <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/60 p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-sky-900">
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Private Share Link Ready
                  </span>
                  {passcode.trim() && (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-800">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      Passcode Protected
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(shareUrl)}
                    className="inline-flex items-center gap-1.5 rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-800 hover:text-sky-950"
                  >
                    <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Send via system share sheet
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || targetObservations.length === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Creating Private Link...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Create Private Link ({targetObservations.length})
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

          {/* Manage & Revoke Active Shared Links */}
          {myShares.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold text-slate-700">
                Your Active Shared Links
              </h3>
              <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
                {myShares.map((item) => (
                  <div
                    key={item.shareId}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-slate-900">
                        <span className="truncate">{item.title}</span>
                        {item.hasPasscode && (
                          <Lock className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                        {item.count} entries · {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.url, item.shareId)}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {copiedId === item.shareId ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeShare(item.shareId)}
                        aria-label={`Revoke share link for ${item.title}`}
                        className="rounded border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
