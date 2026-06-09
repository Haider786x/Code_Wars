import { useEffect, useState } from 'react';
import {
  Eye, Play, Clock, Users, Zap, ChevronRight, Calendar,
  TrendingUp, Wifi, WifiOff,
} from 'lucide-react';

import { api } from '@/lib/services/apiRequests.js';
import { navigate } from '@/src/router.js';

const DIFFICULTY_COLORS = {
  Easy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  Medium: 'text-amber-600 bg-amber-50 border-amber-200',
  Hard: 'text-rose-600 bg-rose-50 border-rose-200',
};

function formatTimeLeft(ms) {
  if (!ms || ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function LiveBadge() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
      LIVE
    </span>
  );
}

function WatchButton({ matchId, size = 'sm' }) {
  return (
    <button
      type="button"
      onClick={() => navigate(`/battle/live/${matchId}?spectate=1`)}
      className={`flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-sm shadow-blue-600/20 ${
        size === 'lg' ? 'px-6 py-2.5 text-sm' : 'px-3 py-1.5 text-xs'
      }`}
    >
      <Play size={size === 'lg' ? 14 : 12} className="fill-white" /> Watch{size === 'lg' ? ' Live' : ''}
    </button>
  );
}

export default function WatchPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL | RANKED | CASUAL
  const [timers, setTimers] = useState({});

  const loadData = async () => {
    try {
      const result = await api.getAction('/live');
      setData(result);
      // Initialize timers
      const t = {};
      (result.matches || []).forEach((m) => {
        t[m.matchId] = m.timeLeft;
      });
      setTimers(t);
    } catch (err) {
      console.error('Failed to load live matches', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const poll = setInterval(loadData, 15000); // poll every 15s
    return () => clearInterval(poll);
  }, []);

  // Countdown ticks
  useEffect(() => {
    const tick = setInterval(() => {
      setTimers((prev) => {
        const next = {};
        for (const [id, ms] of Object.entries(prev)) {
          next[id] = Math.max(0, ms - 1000);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const matches = (data?.matches || []).filter((m) => {
    if (filter === 'ALL') return true;
    return m.roomType === filter;
  });

  const featured = matches[0];
  const rest = matches.slice(1);
  const activity = data?.activity || [];

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Live Matches</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Observe high-level logic in real-time as competitors solve complex algorithms.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold border border-slate-200 rounded-lg overflow-hidden">
              {['ALL', 'RANKED', 'CASUAL'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-2 transition ${filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {f === 'ALL' ? 'ALL MATCHES' : f === 'RANKED' ? 'RANKED' : 'CASUAL'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Eye size={40} className="text-slate-300 animate-pulse" />
            <p className="text-slate-400">Loading live matches...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Featured Match */}
            {featured && (
              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <LiveBadge />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Featured Stream</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-10">
                      {/* Player 1 */}
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Challenger 1</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {featured.participants?.[0]?.displayName || 'Player 1'}
                        </p>
                        <p className="text-blue-600 font-bold text-sm mt-0.5">
                          {featured.participants?.[0]?.rating || 1200} ELO
                        </p>
                      </div>

                      <div className="text-slate-300 text-2xl font-light">|</div>

                      {/* Player 2 */}
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Challenger 2</p>
                        <p className="text-2xl font-bold text-slate-900">
                          {featured.participants?.[1]?.displayName || 'Player 2'}
                        </p>
                        <p className="text-blue-600 font-bold text-sm mt-0.5">
                          {featured.participants?.[1]?.rating || 1200} ELO
                        </p>
                      </div>
                    </div>

                    <WatchButton matchId={featured.matchId} size="lg" />
                  </div>

                  <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-5 text-sm text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Zap size={14} className="text-slate-400" />
                      {featured.problem}
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ml-1 ${DIFFICULTY_COLORS[featured.difficulty] || DIFFICULTY_COLORS.Easy}`}>
                        {featured.difficulty}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Eye size={14} />
                      {featured.spectators} watching
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      Started {featured.startTime ? formatAgo(featured.startTime) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Current Battles table */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">Current Battles</h2>
                  <span className="text-sm text-slate-400">{data?.total || 0} Active Matches</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  {rest.length === 0 && !featured && (
                    <div className="py-16 text-center">
                      <WifiOff size={32} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-slate-400 font-medium">No live matches right now</p>
                      <p className="text-slate-300 text-sm mt-1">Check back soon or start your own battle</p>
                    </div>
                  )}

                  {(rest.length > 0 || featured) && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Players</th>
                          <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Challenge</th>
                          <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Time Left</th>
                          <th className="text-right px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <span className="flex items-center justify-end gap-1"><Eye size={12} /> Viewers</span>
                          </th>
                          <th className="text-right px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rest.map((match) => (
                          <tr key={match.matchId} className="border-b border-slate-50 hover:bg-slate-50 transition">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-800">
                                <span className="text-blue-700 font-bold">{match.participants?.[0]?.displayName || 'P1'}</span>
                                {' '}
                                <span className="text-slate-400 text-xs">({match.participants?.[0]?.rating || 1200})</span>
                                {' '}
                                <span className="text-slate-300 mx-1">vs</span>
                                {' '}
                                <span className="text-blue-700 font-bold">{match.participants?.[1]?.displayName || 'P2'}</span>
                                {' '}
                                <span className="text-slate-400 text-xs">({match.participants?.[1]?.rating || 1200})</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 hidden md:table-cell">
                              <span className="text-slate-600 font-medium">{match.problem}</span>
                            </td>
                            <td className="px-5 py-4 hidden sm:table-cell">
                              <span className={`font-mono font-bold ${(timers[match.matchId] || 0) < 120000 ? 'text-rose-600' : 'text-slate-700'}`}>
                                {formatTimeLeft(timers[match.matchId])}
                              </span>
                              <span className="text-slate-400 text-xs ml-1">remaining</span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <span className="flex items-center justify-end gap-1.5 text-slate-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                {match.spectators}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => navigate(`/battle/live/${match.matchId}?spectate=1`)}
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-bold text-sm ml-auto transition"
                              >
                                Watch <ChevronRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}

                        {rest.length === 0 && featured && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                              Only one active match — the featured stream above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                {matches.length > 0 && (
                  <button
                    type="button"
                    onClick={loadData}
                    className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-xl py-3 transition font-medium"
                  >
                    Refresh <Wifi size={14} />
                  </button>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Upcoming Tournaments */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Upcoming Tournaments</h3>
                  <div className="space-y-3">
                    {[
                      { date: 'Weekly Sprint', time: 'Saturday 7 PM • Open Enrollment' },
                      { date: 'CodeBlast Masters', time: 'Sunday 3 PM • Invite Only' },
                    ].map((t) => (
                      <div key={t.date} className="border border-slate-100 rounded-xl overflow-hidden">
                        <div className="px-4 py-3">
                          <p className="text-sm font-bold text-slate-800">{t.date}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{t.time}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/tournaments')}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
                        >
                          Register Now
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Activity</h3>
                  {activity.length === 0 && (
                    <p className="text-sm text-slate-400">No recent activity yet.</p>
                  )}
                  <div className="space-y-3">
                    {activity.slice(0, 6).map((event, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          event.type === 'win' ? 'bg-blue-100' : 'bg-slate-100'
                        }`}>
                          <TrendingUp size={10} className={event.type === 'win' ? 'text-blue-600' : 'text-slate-500'} />
                        </div>
                        <div className="flex-1">
                          <p className="text-slate-700">{event.text}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatAgo(event.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Watch Trends (static) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Watch Trends</h3>
                  <div className="space-y-3">
                    {[
                      { rank: '01', text: 'Dynamic Programming is the most watched category.' },
                      { rank: '02', text: 'High-ELO matches peak on weekends.' },
                      { rank: '03', text: 'C++ dominates ranked matches.' },
                    ].map((t) => (
                      <div key={t.rank} className="flex items-start gap-3 text-sm">
                        <span className="text-blue-600 font-bold font-mono text-xs shrink-0 pt-0.5">{t.rank}</span>
                        <p className="text-slate-600 leading-relaxed">{t.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
