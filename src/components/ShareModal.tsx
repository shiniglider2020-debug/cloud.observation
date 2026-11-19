import { Check, ChevronDown, Copy, Link2, Loader2, Lock, Radio, Share2, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const MY_LIVE_ROOMS_KEY = 'nephos_my_live_rooms_v1';

export interface CreatedLiveRoomRecord {
  liveId: string;
  title: string;
  hostName: string;
  url: string;
  createdAt: string;
  hasPasscode: boolean;
}

function loadMyLiveRooms(): CreatedLiveRoomRecord[] {
  try {
    const raw = localStorage.getItem(MY_LIVE_ROOMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function resolvePublicLiveUrl(
  liveId: string,
  title: string,
  hostName: string,
  serverAppUrl?: string | null
): string {
  const rawBase = (serverAppUrl || window.location.origin).replace(/\/+$/, '');
  const shareBase = rawBase.replace(/^https:\/\/ais-dev-/, 'https://ais-pre-');
  const url = new URL(`${shareBase}/`);
  url.searchParams.set('live', liveId);
  if (title.trim()) url.searchParams.set('title', title.trim());
  if (hostName.trim()) url.searchParams.set('host', hostName.trim());
  return url.toString();
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAuthor: string;
  presetTitle?: string;
  activeLiveSession?: {
    liveId: string;
    title: string;
    shareUrl: string;
  } | null;
  onStartLiveSession: (session: {
    liveId: string;
    title: string;
    hostName: string;
    passcode?: string;
    shareUrl: string;
  }) => void;
  onEndLiveSession?: (liveId: string) => void;
}

export function ShareModal({
  isOpen,
  onClose,
  defaultAuthor,
  presetTitle,
  activeLiveSession,
  onStartLiveSession,
  onEndLiveSession,
}: ShareModalProps) {
  const [title, setTitle] = useState('Live Sky Watch');
  const [hostName, setHostName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscodeField, setShowPasscodeField] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myLiveRooms, setMyLiveRooms] = useState<CreatedLiveRoomRecord[]>(() =>
    loadMyLiveRooms()
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setCopied(false);
    setPasscode('');
    setShowPasscodeField(false);
    setHostName(defaultAuthor || '');
    setTitle(presetTitle?.trim() ? presetTitle.trim() : 'Live Sky Watch');
    setShareUrl(activeLiveSession ? activeLiveSession.shareUrl : null);
    setMyLiveRooms(loadMyLiveRooms());
  }, [isOpen, defaultAuthor, presetTitle, activeLiveSession]);

  if (!isOpen) return null;

  const persistRooms = (next: CreatedLiveRoomRecord[]) => {
    setMyLiveRooms(next);
    try {
      localStorage.setItem(MY_LIVE_ROOMS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage failures
    }
  };

  const handleCreateLiveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const cleanTitle = title.trim() || 'Live Sky Watch';
      const cleanHost = hostName.trim() || 'Observer';
      const cleanPasscode = passcode.trim();

      const response = await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          hostName: cleanHost,
          passcode: cleanPasscode,
        }),
      });

      const data = (await response.json()) as {
        liveId?: string;
        title?: string;
        hostName?: string;
        createdAt?: string;
        hasPasscode?: boolean;
        appUrl?: string | null;
        error?: string;
      };

      if (!response.ok || !data.liveId) {
        throw new Error(data.error || 'Failed to start live writing session.');
      }

      const publicUrl = resolvePublicLiveUrl(
        data.liveId,
        data.title || cleanTitle,
        data.hostName || cleanHost,
        data.appUrl
      );

      setShareUrl(publicUrl);

      const nextRecord: CreatedLiveRoomRecord = {
        liveId: data.liveId,
        title: data.title || cleanTitle,
        hostName: data.hostName || cleanHost,
        url: publicUrl,
        createdAt: data.createdAt || new Date().toISOString(),
        hasPasscode: Boolean(data.hasPasscode),
      };
      const deduped = [nextRecord, ...myLiveRooms.filter((r) => r.liveId !== data.liveId)].slice(
        0,
        10
      );
      persistRooms(deduped);

      onStartLiveSession({
        liveId: data.liveId,
        title: nextRecord.title,
        hostName: nextRecord.hostName,
        passcode: cleanPasscode || undefined,
        shareUrl: publicUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start live writing session.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEndRoom = async (liveId: string) => {
    try {
      await fetch(`/api/live/${encodeURIComponent(liveId)}`, { method: 'DELETE' });
    } catch {
      // Remove local record even if offline
    }
    persistRooms(myLiveRooms.filter((r) => r.liveId !== liveId));
    if (shareUrl && shareUrl.includes(liveId)) {
      setShareUrl(null);
    }
    onEndLiveSession?.(liveId);
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
        title: title.trim() || 'Live Sky Watch',
        text: 'Write sky notes together live in real time (no sign-in required)',
        url: shareUrl,
      });
    } catch {
      // User cancelled share sheet
    }
  };

  const isPreviewHost =
    typeof window !== 'undefined' &&
    (window.location.origin.includes('ais-dev-') || window.location.origin.includes('ais-pre-'));

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
              Share Live Writing Together
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Start a clean real-time writing room with zero saved entries and no sign-in required. Others see what you type live as you write.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close live share dialog"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <form onSubmit={handleCreateLiveSession} className="space-y-4">
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="live-title" className="block text-xs font-semibold text-slate-700">
                  Live Session Title
                </label>
                <input
                  id="live-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Live Sky Watch"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <div>
                <label htmlFor="live-host" className="block text-xs font-semibold text-slate-700">
                  Your Display Name
                </label>
                <input
                  id="live-host"
                  type="text"
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder="e.g. Observer"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowPasscodeField((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <Lock className="h-3 w-3" aria-hidden="true" />
                <span>Passcode (optional — off by default, no sign-in required)</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    showPasscodeField ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {showPasscodeField && (
                <div className="relative mt-2">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="live-passcode"
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Leave blank so anyone with link joins directly"
                    className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-3 font-mono text-xs text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                  />
                </div>
              )}
            </div>

            {shareUrl ? (
              <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/70 p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-sky-900">
                  <span className="inline-flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    Live Writing Link Ready
                  </span>
                  <span className="text-[11px] font-normal text-sky-800">
                    No saved entries included
                  </span>
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
                        Copy Live Link
                      </>
                    )}
                  </button>
                </div>

                {isPreviewHost && (
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    No app sign-in is required to join. This link uses the Shared App URL; if an external person still hits a preview access prompt, deploy/publish the app so anyone can open it directly.
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
                  >
                    Start Writing Live
                  </button>

                  {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-800 hover:text-sky-950"
                    >
                      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                      System share
                    </button>
                  )}
                </div>
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
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Starting Live Room...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Create Live Writing Link
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

          {myLiveRooms.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-xs font-semibold text-slate-700">
                Your Active Live Rooms
              </h3>
              <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
                {myLiveRooms.map((item) => (
                  <div
                    key={item.liveId}
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
                        Live writing · {new Date(item.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onStartLiveSession({
                            liveId: item.liveId,
                            title: item.title,
                            hostName: item.hostName,
                            shareUrl: item.url,
                          });
                          onClose();
                        }}
                        className="rounded border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(item.url, item.liveId)}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {copiedId === item.liveId ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEndRoom(item.liveId)}
                        aria-label={`End live room ${item.title}`}
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
