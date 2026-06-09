import { useEffect, useState } from 'react';
import {
  History, Clock, CheckCircle2, XCircle, Minus, ArrowLeft, Search, Filter,
} from 'lucide-react';

import { api } from '@/lib/services/apiRequests.js';
import { navigate } from '@/src/router.js';
import { getCurrentIdentity } from '@/lib/identity/currentIdentity.js';

function MatchCard({ match, myGuestId }) {
  const me = match.players?.find((p) => p.guestId === myGuestId);
  const won = match.winner === myGuestId || (me && match.winner === me.participantId);
  const isDraw = match.winner === null;

  const opponent = match.players?.find((p) => p.guestId !== myGuestId);
  const opponentName = opponent?.displayName || opponent?.guestId || 'Opponent';

  const durationMs = match.duration || 0;
  const durationStr = durationMs
    ? `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
    : '—';

  const date = match.createdAt
    ? new Date(match.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
  const time = match.createdAt
    ? new Date(match.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition hover:scale-[1.01] ${
      isDraw ? 'bg-slate-50 border-slate-200' : won ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
    }`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          isDraw ? 'bg-slate-200' : won ? 'bg-emerald-100' : 'bg-rose-100'
        }`}>
          {isDraw
            ? <Minus size={24} className="text-slate-500" />
            : won
              ? <CheckCircle2 size={24} className="text-emerald-600" />
              : <XCircle size={24} className="text-rose-500" />
          }
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isDraw ? 'bg-slate-200 text-slate-600' : won ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
            }`}>
              {isDraw ? 'Draw' : won ? 'Victory' : 'Defeat'}
            </span>
            {match.finalVerdict && (
              <span className="text-xs text-slate-400 font-mono">{match.finalVerdict}</span>
            )}
          </div>
          <h3 className="font-bold text-slate-800 mt-1 text-sm">{match.problem || 'Unknown Problem'}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span>vs. <strong className="text-slate-600">{opponentName}</strong></span>
            {match.language && <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{match.language}</span>}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 justify-end">
          <Clock size={12} />
          {durationStr}
        </div>
        <p className="text-xs text-slate-400 mt-1">{date}</p>
        <p className="text-xs text-slate-300">{time}</p>
      </div>
    </div>
  );
}

export default function MatchHistoryPage() {
  const identity = getCurrentIdentity();
  const myGuestId = identity.type === 'guest' ? identity.guestId : identity.userId;

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | won | lost

  useEffect(() => {
    if (!myGuestId) {
      setError('No identity found. Play a match first!');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (identity.type === 'guest') params.set('guestId', myGuestId);
        else params.set('userId', myGuestId);

        const result = await api.getAction(`/history?${params.toString()}`);
        setHistory(result.items || []);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load match history');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [myGuestId, identity.type]);

  const filtered = history.filter((match) => {
    const me = match.players?.find((p) => p.guestId === myGuestId);
    const won = match.winner === myGuestId || (me && match.winner === me.participantId);
    const isDraw = match.winner === null;

    if (filter === 'won' && !won) return false;
    if (filter === 'lost' && (won || isDraw)) return false;

    if (search) {
      const q = search.toLowerCase();
      return (
        (match.problem || '').toLowerCase().includes(q)
        || (match.language || '').toLowerCase().includes(q)
      );
    }

    return true;
  });

  const wins = history.filter((m) => {
    const me = m.players?.find((p) => p.guestId === myGuestId);
    return m.winner === myGuestId || (me && m.winner === me.participantId);
  }).length;
  const losses = history.filter((m) => {
    const me = m.players?.find((p) => p.guestId === myGuestId);
    const won = m.winner === myGuestId || (me && m.winner === me.participantId);
    return !won && m.winner !== null;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition text-sm">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-xl border border-blue-200">
              <History size={20} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Match History</h1>
              <p className="text-xs text-slate-400">{history.length} total matches</p>
            </div>
          </div>
          <div />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {!loading && !error && history.length > 0 && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
                <div className="text-2xl font-extrabold text-slate-800">{history.length}</div>
                <div className="text-xs text-slate-400 mt-1">Total Matches</div>
              </div>
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 text-center shadow-sm">
                <div className="text-2xl font-extrabold text-emerald-700">{wins}</div>
                <div className="text-xs text-emerald-500 mt-1">Victories</div>
              </div>
              <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4 text-center shadow-sm">
                <div className="text-2xl font-extrabold text-rose-700">{losses}</div>
                <div className="text-xs text-rose-500 mt-1">Defeats</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search problems..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                {['all', 'won', 'lost'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                      filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <History className="text-blue-400 animate-pulse" size={48} />
            <p className="text-slate-400">Loading match history...</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-8 text-center">
            <p className="font-bold text-lg mb-1">Could not load history</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="text-center py-24">
            <History size={48} className="mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-bold text-slate-600 mb-2">No matches yet</h3>
            <p className="text-slate-400 mb-8">Go play your first battle!</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition"
            >
              Find a Match
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && history.length > 0 && (
          <div className="text-center py-16 text-slate-400">
            <Search size={32} className="mx-auto mb-3 opacity-40" />
            <p>No matches match your filters.</p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((match) => (
            <MatchCard key={match.roomId || match._id} match={match} myGuestId={myGuestId} />
          ))}
        </div>
      </div>
    </div>
  );
}
