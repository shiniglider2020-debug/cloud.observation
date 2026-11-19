import { Check, Copy, LogOut, Radio, Send, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { inferAbbreviationFromTitle, inferGenusFromTitle } from '../data/wmoTaxonomy';
import type { LiveRoomState, LiveWriterDraft } from '../types/cloud';
import { formatObservedTimestamp } from '../utils/csvAndImage';

interface LiveSessionPanelProps {
  room: LiveRoomState;
  myClientId: string | null;
  connected: boolean;
  isGuestView: boolean;
  shareUrl: string;
  myName: string;
  onChangeMyName: (name: string) => void;
  onWritingChange: (draft: {
    cloudName: string;
    abbreviation: string;
    text: string;
    source: string;
  } | null) => void;
  onPostNote: (note: {
    cloudName: string;
    abbreviation: string;
    text: string;
  }) => void;
  onDeletePost: (id: string) => void;
  onSharedPadChange: (nextText: string) => void;
  onLeaveOrEnd: () => void;
}

export function LiveSessionPanel({
  room,
  myClientId,
  connected,
  isGuestView,
  shareUrl,
  myName,
  onChangeMyName,
  onWritingChange,
  onPostNote,
  onDeletePost,
  onSharedPadChange,
  onLeaveOrEnd,
}: LiveSessionPanelProps) {
  const [cloudName, setCloudName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [liveText, setLiveText] = useState('');
  const [copied, setCopied] = useState(false);

  const remoteDrafts: LiveWriterDraft[] = room.drafts.filter(
    (d) => d.clientId !== myClientId
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const emitDraft = (nextCloud: string, nextAbbr: string, nextText: string) => {
    if (!nextCloud.trim() && !nextAbbr.trim() && !nextText.trim()) {
      onWritingChange(null);
      return;
    }
    onWritingChange({
      cloudName: nextCloud,
      abbreviation: nextAbbr,
      text: nextText,
      source: 'Live Composer',
    });
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudName.trim() && !liveText.trim()) return;
    onPostNote({
      cloudName: cloudName.trim(),
      abbreviation: abbreviation.trim(),
      text: liveText.trim(),
    });
    setCloudName('');
    setAbbreviation('');
    setLiveText('');
    onWritingChange(null);
  };

  return (
    <section
      aria-label="Live collaborative writing session"
      className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6"
    >
      <div className="overflow-hidden rounded-lg border border-sky-200 bg-white">
        {/* Header Bar */}
        <div className="flex flex-col justify-between gap-3 border-b border-sky-200 bg-sky-50/80 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-sky-950">
            <span className="inline-flex items-center gap-1.5 font-display font-bold text-sky-900">
              <Radio
                className={`h-3.5 w-3.5 ${connected ? 'text-emerald-600' : 'text-amber-600'}`}
                aria-hidden="true"
              />
              {room.title}
            </span>
            <span className="text-sky-400" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-sky-900">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {room.onlineCount} online
            </span>
            <span className="text-sky-400" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-600">
              {connected ? 'Live sync active (no saved entries shared)' : 'Connecting live sync...'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
              <span>Your name:</span>
              <input
                type="text"
                value={myName}
                onChange={(e) => onChangeMyName(e.target.value)}
                placeholder="Observer"
                className="w-28 rounded border border-sky-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
              />
            </label>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50 whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Link Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy Live Link
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onLeaveOrEnd}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {isGuestView ? 'Open My Ledger' : 'End Live Share'}
            </button>
          </div>
        </div>

        {/* Two-column Live Writing + Shared Live Notes */}
        <div className="grid grid-cols-1 divide-y divide-slate-200 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {/* Left: Live Writing Keystroke Stream */}
          <div className="space-y-4 p-4 sm:p-5">
            <div>
              <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500">
                What You Are Writing Live
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Everyone with the link sees your typing below in real time as you write — without saving any entry.
              </p>
            </div>

            <form onSubmit={handlePost} className="space-y-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={cloudName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCloudName(val);
                    const inf = inferGenusFromTitle(val);
                    const nextAbbr = inferAbbreviationFromTitle(val, inf.genusCode) || abbreviation;
                    setAbbreviation(nextAbbr);
                    emitDraft(val, nextAbbr, liveText);
                  }}
                  placeholder="Cloud / Subject (optional)"
                  className="sm:col-span-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
                <input
                  type="text"
                  value={abbreviation}
                  onChange={(e) => {
                    setAbbreviation(e.target.value);
                    emitDraft(cloudName, e.target.value, liveText);
                  }}
                  placeholder="Abbrev (e.g. Cu hum)"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <textarea
                rows={3}
                value={liveText}
                onChange={(e) => {
                  setLiveText(e.target.value);
                  emitDraft(cloudName, abbreviation, e.target.value);
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handlePost(e);
                  }
                }}
                placeholder="Start typing what you see in the sky right now... others see it live as you type"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  Tip: Press Ctrl+Enter to post to the live feed below
                </span>
                <button
                  type="submit"
                  disabled={!cloudName.trim() && !liveText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  Post Live Note
                </button>
              </div>
            </form>

            {/* Others Currently Writing Live */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500">
                Others Writing Right Now ({remoteDrafts.length})
              </h3>
              {remoteDrafts.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-xs text-slate-500">
                  No one else is actively typing right now. When a collaborator opens the link and types, their live words appear here immediately.
                </p>
              ) : (
                <div className="space-y-2">
                  {remoteDrafts.map((draft) => (
                    <div
                      key={draft.clientId}
                      className="rounded-md border border-sky-200 bg-sky-50/50 px-3 py-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-sky-900">
                        <span className="font-semibold">{draft.author}</span>
                        <span className="text-sky-400" aria-hidden="true">
                          ·
                        </span>
                        <span>writing in {draft.source}</span>
                        {draft.abbreviation && (
                          <>
                            <span className="text-sky-400" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono font-medium">{draft.abbreviation}</span>
                          </>
                        )}
                      </div>
                      {draft.cloudName && (
                        <div className="mt-1 font-display text-xs font-semibold text-slate-900">
                          {draft.cloudName}
                        </div>
                      )}
                      {draft.text && (
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                          {draft.text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Shared Live Pad + Live Feed */}
          <div className="flex flex-col space-y-4 p-4 sm:p-5">
            <div>
              <label
                htmlFor="shared-live-pad"
                className="block font-display text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Shared Live Notes (Co-Edit Together)
              </label>
              <textarea
                id="shared-live-pad"
                rows={4}
                value={room.sharedNote}
                onChange={(e) => onSharedPadChange(e.target.value)}
                placeholder="Write shared sky observations together here in real time..."
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-slate-50/40 px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
              />
            </div>

            <div className="flex-1 space-y-2 border-t border-slate-100 pt-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Stream Notes ({room.messages.length})
              </h3>
              {room.messages.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No live notes posted yet. Post a live note or co-edit the shared pad above.
                </p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {room.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-start justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-800">{msg.author}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatObservedTimestamp(msg.createdAt)}
                          </span>
                          {msg.abbreviation && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-sky-800">{msg.abbreviation}</span>
                            </>
                          )}
                        </div>
                        {msg.cloudName && (
                          <div className="mt-0.5 font-display font-semibold text-slate-900">
                            {msg.cloudName}
                          </div>
                        )}
                        {msg.text && (
                          <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{msg.text}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeletePost(msg.id)}
                        aria-label="Delete live note"
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
