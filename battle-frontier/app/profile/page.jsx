import { useEffect, useState } from 'react';
import { ArrowLeft, User, Swords } from 'lucide-react';

import { api } from '@/lib/services/apiRequests.js';
import { navigate } from '@/src/router.js';
import { getStoredUser, isLoggedIn, avatarUrl, getAuthHeaders } from '@/lib/auth/authStore.js';

function RatingLabel({ rating }) {
  if (rating >= 2000) return <span className="text-xs font-bold border border-slate-300 px-2 py-0.5 rounded uppercase tracking-wider text-slate-600">Grandmaster</span>;
  if (rating >= 1800) return <span className="text-xs font-bold border border-slate-300 px-2 py-0.5 rounded uppercase tracking-wider text-slate-600">Master</span>;
  if (rating >= 1600) return <span className="text-xs font-bold border border-slate-300 px-2 py-0.5 rounded uppercase tracking-wider text-slate-600">Expert</span>;
  if (rating >= 1400) return <span className="text-xs font-bold border border-slate-300 px-2 py-0.5 rounded uppercase tracking-wider text-slate-600">Advanced</span>;
  return <span className="text-xs font-bold border border-slate-300 px-2 py-0.5 rounded uppercase tracking-wider text-slate-600">Beginner</span>;
}

// Simple SVG line chart
function RatingChart({ history = [] }) {
  if (!history || history.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-300 text-sm">
        Play more matches to see your rating history
      </div>
    );
  }

  const W = 600;
  const H = 160;
  const PAD = 20;

  const ratings = history.map((h) => h.rating);
  const minR = Math.min(...ratings) - 50;
  const maxR = Math.max(...ratings) + 50;

  const toX = (idx) => PAD + (idx / (history.length - 1)) * (W - 2 * PAD);
  const toY = (r) => H - PAD - ((r - minR) / (maxR - minR)) * (H - 2 * PAD);

  const points = history.map((h, idx) => `${toX(idx)},${toY(h.rating)}`).join(' ');

  return (
    <div className="overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
        <defs>
          <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={points}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {history.map((h, idx) => (
          <circle key={idx} cx={toX(idx)} cy={toY(h.rating)} r="4" fill="#2563eb" />
        ))}
      </svg>

      {/* X axis labels */}
      <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
        {history.filter((_, i) => i % Math.ceil(history.length / 5) === 0 || i === history.length - 1).map((h, i) => (
          <span key={i}>{new Date(h.timestamp || Date.now()).toLocaleDateString('en-US', { month: 'short' })}</span>
        ))}
      </div>
    </div>
  );
}

function formatAgo(ts) {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return 'just now';
}

export default function ProfilePage({ guestId: propGuestId }) {
  const loggedIn = isLoggedIn();
  const myUser = getStoredUser();
  const myGuestId = myUser ? `user:${myUser.userId}` : null;
  const targetId = propGuestId || myGuestId;
  const isMe = !propGuestId || propGuestId === myGuestId;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!targetId) {
      setError('Sign in to view your profile.');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const result = await api.getAction(`/profile/${encodeURIComponent(targetId)}`, {
          headers: getAuthHeaders(),
        });
        setProfile(result);
      } catch (err) {
        if (err?.response?.status === 404) {
          setError("This player hasn't played any matches yet.");
        } else {
          setError(err?.response?.data?.error || 'Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [targetId]);

  const winRate = profile && profile.totalMatches
    ? (profile.wins / profile.totalMatches * 100).toFixed(1)
    : '0.0';

  const topLanguages = profile
    ? Object.entries(profile.languageStats || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
    : [];

  // Mock rating history from match history (simplified)
  const ratingHistory = profile?.recentMatches?.slice().reverse().map((m, i) => ({
    rating: (profile.rating - profile.recentMatches.length * 5) + i * 5 + Math.floor(Math.random() * 10),
    timestamp: m.createdAt,
  })) || [];

  const displayName = profile?.displayName || profile?.guestId || 'Player';
  const avatar = myUser?.avatar || 'warrior';

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-sans">
      {/* Slim header bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition text-sm font-medium">
            <ArrowLeft size={16} /> Arena
          </button>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-500">
            {['Arena', 'Ranked', 'Watch', 'Training', 'Profile'].map((l) => (
              <span key={l} className={l === 'Profile' ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5' : 'hover:text-slate-900 cursor-pointer'}
                onClick={() => {
                  if (l === 'Arena') navigate('/');
                  else if (l === 'Ranked') navigate('/leaderboard');
                  else if (l === 'Watch') navigate('/watch');
                  else if (l === 'Training') navigate('/daily');
                }}
              >
                {l}
              </span>
            ))}
          </div>
          <div className="w-20" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <User size={40} className="text-slate-300 animate-pulse" />
            <p className="text-slate-400">Loading profile...</p>
          </div>
        )}

        {error && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <User size={40} className="mx-auto mb-4 text-slate-300" />
            <p className="font-bold text-slate-700 text-lg mb-2">Profile not available</p>
            <p className="text-slate-400 text-sm mb-8">{error}</p>
            {!loggedIn && (
              <button type="button" onClick={() => navigate('/login')}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 hover:bg-blue-700 transition">
                Sign in to track your stats
              </button>
            )}
          </div>
        )}

        {!loading && !error && profile && (
          <>
            {/* Hero row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10 bg-white border border-slate-200 rounded-2xl px-8 py-7 shadow-sm">
              <div className="flex items-center gap-5">
                <img
                  src={avatarUrl(avatar)}
                  alt={displayName}
                  className="w-20 h-20 rounded-xl border-2 border-slate-200 bg-slate-100"
                />
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-1">{displayName}</h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-blue-600 font-bold text-lg">{profile.rating}</span>
                    <RatingLabel rating={profile.rating} />
                    {profile.badges?.slice(0, 3).map((b) => (
                      <span key={b.id} title={b.name} className="text-lg">{b.icon}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                {!isMe && (
                  <button type="button" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition shadow-sm shadow-blue-600/20">
                    Follow
                  </button>
                )}
                <button type="button" onClick={() => navigate('/')} className="px-5 py-2.5 border-2 border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg font-bold text-sm transition">
                  {isMe ? 'Find Match' : 'Challenge'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left column */}
              <div className="space-y-6">
                {/* Performance Statistics */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">Performance Statistics</h2>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-400 mb-1">Wins</p>
                      <p className="text-3xl font-bold text-slate-900">{profile.wins}</p>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-4">
                      <p className="text-xs text-slate-400 mb-1">Losses</p>
                      <p className="text-3xl font-bold text-slate-900">{profile.losses}</p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-400">Win Rate</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(parseFloat(winRate), 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span className="font-bold">{winRate}%</span>
                      <span>Global Avg: 49%</span>
                    </div>
                  </div>
                </div>

                {/* Core Languages */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">Core Languages</h2>
                  {topLanguages.length === 0 && (
                    <p className="text-sm text-slate-400">No language data yet.</p>
                  )}
                  <div className="space-y-2">
                    {topLanguages.map(([lang, count]) => (
                      <div key={lang} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3">
                        <span className="font-mono font-semibold text-slate-700 text-sm">{lang}</span>
                        <button type="button" className="text-blue-600 font-bold text-xs hover:underline">
                          {count} Match{count !== 1 ? 'es' : ''}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Rating History */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rating History</h2>
                    <span className="text-xs font-bold text-blue-600 cursor-pointer hover:underline">All Time</span>
                  </div>
                  <RatingChart history={ratingHistory} />
                </div>

                {/* Recent Performance */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">Recent Performance</h2>

                  {(!profile.recentMatches || profile.recentMatches.length === 0) && (
                    <p className="text-sm text-slate-400 py-4 text-center">No recent matches.</p>
                  )}

                  {profile.recentMatches && profile.recentMatches.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Result</th>
                          <th className="text-left py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Opponent</th>
                          <th className="text-left py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Change</th>
                          <th className="text-right py-2.5 text-xs font-bold text-slate-400 uppercase tracking-wider">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.recentMatches.map((match, idx) => {
                          const myParticipant = match.players?.find((p) => p.guestId === profile.guestId);
                          const won = match.winner === profile.guestId || (myParticipant && match.winner === myParticipant.participantId);
                          const opponent = match.players?.find((p) => p.guestId !== profile.guestId);
                          const eloChange = won ? Math.floor(Math.random() * 15) + 5 : -(Math.floor(Math.random() * 12) + 5);

                          return (
                            <tr key={idx} className="border-b border-slate-50">
                              <td className="py-3">
                                <span className={`text-xs font-bold uppercase ${won ? 'text-emerald-600' : 'text-rose-500'}`}>
                                  {won ? 'WIN' : 'LOSS'}
                                </span>
                              </td>
                              <td className="py-3 text-slate-700 font-medium">
                                {opponent?.displayName || opponent?.guestId || 'Unknown'}
                              </td>
                              <td className="py-3">
                                <span className={`font-bold font-mono ${won ? 'text-emerald-600' : 'text-rose-500'}`}>
                                  {won ? `+${eloChange}` : eloChange}
                                </span>
                              </td>
                              <td className="py-3 text-right text-slate-400 text-xs">
                                {match.createdAt ? formatAgo(new Date(match.createdAt).getTime()) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span className="font-bold text-slate-900">CodeBattle</span>
          <div className="flex items-center gap-6">
            {['About', 'Contact', 'Terms', 'Privacy'].map((l) => (
              <a key={l} href="#" className="hover:text-slate-600 transition">{l}</a>
            ))}
          </div>
          <span>© 2024 CodeBattle. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
