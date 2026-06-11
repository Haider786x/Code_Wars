import { useEffect, useState } from 'react';
import { Trophy, Flame, Swords, Star, TrendingUp, Crown, ArrowLeft } from 'lucide-react';

import { AppHeader } from '@/components/layout/AppHeader.jsx';
import { api } from '@/lib/services/apiRequests.js';
import { navigate } from '@/src/router.js';
import { getCurrentIdentity } from '@/lib/identity/currentIdentity.js';

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const RANK_ICONS = ['🥇', '🥈', '🥉'];

function RatingBadge({ rating }) {
  if (rating >= 2000) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">Grandmaster</span>;
  if (rating >= 1800) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">Master</span>;
  if (rating >= 1600) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Expert</span>;
  if (rating >= 1400) return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Advanced</span>;
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Beginner</span>;
}

export default function LeaderboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const identity = getCurrentIdentity();
  const myId = identity.type === 'guest' ? identity.guestId : identity.userId;

  useEffect(() => {
    const load = async () => {
      try {
        const result = await api.getAction('/leaderboard?limit=100');
        setData(result);
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const winRate = (player) => {
    if (!player.totalMatches) return 0;
    return Math.round((player.wins / player.totalMatches) * 100);
  };

  return (
    <div className="min-h-screen bg-app-bg font-sans">
      <AppHeader activeTab="Ranked" />

      {/* Header Title */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl border border-amber-200">
              <Trophy size={20} className="text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leaderboard</h1>
              <p className="text-sm text-slate-400">Ranked by ELO Rating</p>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500">{data?.total || 0} players</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Trophy className="text-amber-400 animate-bounce" size={48} />
            <p className="text-slate-400 animate-pulse">Loading rankings...</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/30 border border-rose-500/30 text-rose-300 rounded-2xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Could not load leaderboard</p>
            <p className="text-sm opacity-70">{error}</p>
            <p className="text-xs text-slate-400 mt-4">Play some matches to populate the leaderboard!</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Top 3 Podium */}
            {data.players.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 mb-10 items-end">
                {[data.players[1], data.players[0], data.players[2]].map((player, podiumIdx) => {
                  const actualRank = podiumIdx === 0 ? 2 : podiumIdx === 1 ? 1 : 3;
                  const isMe = player?.guestId === myId;
                  return (
                    <div
                      key={player?.guestId}
                      className={`relative flex flex-col items-center p-4 rounded-2xl border transition cursor-pointer hover:scale-105 bg-white shadow-sm ${
                        actualRank === 1
                          ? 'border-amber-200 shadow-amber-500/10 py-8'
                          : actualRank === 2
                            ? 'border-slate-200 py-6'
                            : 'border-amber-700/20 py-5'
                      } ${isMe ? 'ring-2 ring-blue-500' : ''}`}
                      onClick={() => player && navigate(`/profile/${player.guestId}`)}
                    >
                      <span className="text-3xl mb-2">{RANK_ICONS[actualRank - 1]}</span>
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${player?.guestId || 'empty'}`}
                        alt={player?.displayName}
                        className="w-14 h-14 rounded-full border-2 border-slate-100 bg-slate-50 mb-2"
                      />
                      <p className="font-bold text-slate-900 text-sm truncate max-w-full">{player?.displayName}</p>
                      <p className="text-xs text-slate-500 font-mono">{player?.rating} ELO</p>
                      <div className="mt-2">
                        <RatingBadge rating={player?.rating || 1200} />
                      </div>
                      {isMe && (
                        <span className="absolute top-2 right-2 text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full shadow-sm shadow-blue-600/20">YOU</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3 w-12">#</th>
                      <th className="text-left px-4 py-3">Player</th>
                      <th className="text-right px-4 py-3">
                        <span className="flex items-center justify-end gap-1"><Star size={12} /> Rating</span>
                      </th>
                      <th className="text-right px-4 py-3 hidden sm:table-cell">W/L</th>
                      <th className="text-right px-4 py-3 hidden md:table-cell">Win%</th>
                      <th className="text-right px-4 py-3 hidden lg:table-cell">
                        <span className="flex items-center justify-end gap-1"><Flame size={12} /> Streak</span>
                      </th>
                      <th className="text-right px-4 py-3 hidden lg:table-cell">Badges</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.players.map((player) => {
                      const isMe = player.guestId === myId;
                      const topLanguage = Object.entries(player.languageStats || {}).sort((a, b) => b[1] - a[1])[0];
                      return (
                        <tr
                          key={player.guestId}
                          onClick={() => navigate(`/profile/${player.guestId}`)}
                          className={`border-b border-slate-50 transition cursor-pointer hover:bg-slate-50 ${isMe ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            {player.rank <= 3
                              ? <span className="text-lg">{RANK_ICONS[player.rank - 1]}</span>
                              : <span className="text-slate-500 font-mono text-xs">{player.rank}</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${player.guestId}`}
                                alt={player.displayName}
                                className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50 shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-800">{player.displayName}</span>
                                  {isMe && <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full shadow-sm shadow-blue-600/20">YOU</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <RatingBadge rating={player.rating} />
                                  {topLanguage && (
                                    <span className="text-[10px] text-slate-400 font-mono">{topLanguage[0]}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-blue-600 font-mono">{player.rating}</span>
                          </td>
                          <td className="px-4 py-3 text-right hidden sm:table-cell">
                            <span className="text-emerald-600 font-medium">{player.wins}W</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span className="text-rose-500 font-medium">{player.losses}L</span>
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell">
                            <div className="flex items-center justify-end gap-1">
                              <TrendingUp size={12} className={winRate(player) >= 60 ? 'text-emerald-500' : 'text-slate-400'} />
                              <span className={`font-mono text-xs ${winRate(player) >= 60 ? 'text-emerald-600 font-medium' : 'text-slate-500'}`}>
                                {winRate(player)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right hidden lg:table-cell">
                            {player.currentStreak > 0 && (
                              <span className="flex items-center justify-end gap-1 text-amber-500">
                                <Flame size={12} />
                                <span className="font-mono font-medium text-xs text-amber-600">{player.currentStreak}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right hidden lg:table-cell">
                            <div className="flex justify-end gap-0.5">
                              {(player.badges || []).slice(0, 3).map((b) => (
                                <span key={b.id} title={b.name} className="text-sm">{b.icon}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {data.players.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-slate-500">
                          <Trophy size={32} className="mx-auto mb-3 opacity-30" />
                          <p>No players yet. Be the first to battle!</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
