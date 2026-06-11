import { useState, useEffect } from 'react';
import { Swords, Eye, ChevronRight, TrendingUp, Calendar, Users, Menu, X, Settings, LogOut } from 'lucide-react';

import { AppHeader } from '@/components/layout/AppHeader.jsx';
import { MatchModal } from '@/components/MatchModel.jsx';
import { navigate } from '@/src/router.js';
import { getStoredUser, isLoggedIn, avatarUrl } from '@/lib/auth/authStore.js';
import { getGuestIdentity } from '@/lib/identity/guestIdentity.js';
import { api } from '@/lib/services/apiRequests.js';
import { getSocket } from '@/hooks/useMatchStream.js';

function formatAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function formatTimeLeft(ms) {
  if (!ms || ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ArenaPage() {
  const [matchModal, setMatchModal] = useState(null); // 'find' | 'create' | 'join' | null
  const [liveData, setLiveData] = useState(null);
  const [timers, setTimers] = useState({});
  const [isSearching, setIsSearching] = useState(false);

  const user = getStoredUser();
  const loggedIn = isLoggedIn();

  const loadLive = async () => {
    try {
      const result = await api.getAction('/live');
      setLiveData(result);
      const t = {};
      (result.matches || []).forEach((m) => { t[m.matchId] = m.timeLeft; });
      setTimers(t);
    } catch (_) { /* no-op when backend is down */ }
  };

  useEffect(() => {
    loadLive();
    const poll = setInterval(loadLive, 15000);
    return () => clearInterval(poll);
  }, []);

  // Countdown ticks
  useEffect(() => {
    const tick = setInterval(() => {
      setTimers((prev) => {
        const next = {};
        for (const [id, ms] of Object.entries(prev)) next[id] = Math.max(0, ms - 1000);
        return next;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    
    const onMatchFound = ({ matchId }) => {
      setIsSearching(false);
      navigate(`/battle/live/${matchId}`);
    };

    const onError = (err) => {
      setIsSearching(false);
      console.error('Matchmaking error:', err);
    };

    socket.on('matchmaking:found', onMatchFound);
    socket.on('matchmaking:error', onError);

    return () => {
      socket.off('matchmaking:found', onMatchFound);
      socket.off('matchmaking:error', onError);
    };
  }, []);

  const handleFindMatch = () => {
    setIsSearching(true);
    const socket = getSocket();
    const { guestId } = getGuestIdentity();
    
    socket.emit('matchmaking:find', {
      userId: user?.id,
      guestId,
      displayName: user?.displayName || user?.username,
    });
  };

  const handleCancelMatch = () => {
    setIsSearching(false);
    const socket = getSocket();
    socket.emit('matchmaking:cancel');
  };

  const matches = liveData?.matches || [];
  const activity = liveData?.activity || [];

  return (
    <div className="min-h-screen bg-app-bg font-sans">
      {/* Match Modal */}
      {matchModal && (
        <MatchModal
          isOpen
          onClose={() => setMatchModal(null)}
          activeTab={matchModal === 'find' ? 'join' : matchModal === 'join' ? 'join' : 'create'}
          setActiveTab={() => {}}
        />
      )}

      <AppHeader activeTab="Arena" />

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hero action strip */}
        <div className="bg-white border border-slate-200 rounded-2xl p-10 mb-10 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900 mb-8">Enter the Arena</h1>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {isSearching ? (
              <button
                type="button"
                onClick={handleCancelMatch}
                className="bg-rose-600 hover:bg-rose-700 text-white px-10 py-3.5 rounded-lg font-bold text-base transition shadow-lg shadow-rose-600/20 flex items-center gap-2 animate-pulse"
              >
                Cancel Search...
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFindMatch}
                className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3.5 rounded-lg font-bold text-base transition shadow-lg shadow-blue-600/20 flex items-center gap-2"
              >
                <Swords size={18} /> Find Match
              </button>
            )}
            <button
              type="button"
              onClick={() => setMatchModal('create')}
              className="border-2 border-slate-300 hover:border-slate-400 text-slate-700 px-10 py-3.5 rounded-lg font-bold text-base transition bg-white flex items-center gap-2"
            >
              Create Room
            </button>
            <button
              type="button"
              onClick={() => setMatchModal('join')}
              className="border-2 border-slate-300 hover:border-slate-400 text-slate-700 px-10 py-3.5 rounded-lg font-bold text-base transition bg-white flex items-center gap-2"
            >
              Join Room
            </button>
          </div>

          {!loggedIn && (
            <p className="text-sm text-slate-400 mt-6">
              <button type="button" onClick={() => navigate('/login')} className="text-blue-600 hover:underline font-semibold">Sign in</button>
              {' '}or{' '}
              <button type="button" onClick={() => navigate('/register')} className="text-blue-600 hover:underline font-semibold">register</button>
              {' '}to track your stats, ELO, and history across sessions
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Live Matches */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider">Live Matches</h2>
              <span className="text-xs text-blue-600 font-bold">{matches.length} active</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {matches.length === 0 ? (
                <div className="py-16 text-center">
                  <Eye size={32} className="mx-auto mb-3 text-slate-200" />
                  <p className="text-slate-400 text-sm">No live matches right now.</p>
                  <button
                    type="button"
                    onClick={() => setMatchModal('find')}
                    className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-700 transition"
                  >
                    Start one
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {/* Header */}
                  <div className="grid grid-cols-12 px-5 py-2.5 bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="col-span-4">Player 1</div>
                    <div className="col-span-4">Player 2</div>
                    <div className="col-span-2 hidden sm:block">Problem</div>
                    <div className="col-span-2 text-right">Time / Watch</div>
                  </div>

                  {matches.slice(0, 8).map((match) => {
                    const p1 = match.participants?.[0];
                    const p2 = match.participants?.[1];
                    const tl = timers[match.matchId] ?? match.timeLeft;
                    const isUrgent = tl < 120000;

                    return (
                      <div key={match.matchId} className="grid grid-cols-12 items-center px-5 py-4 hover:bg-slate-50 transition">
                        <div className="col-span-4">
                          <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wider">Player 1</p>
                          <p className="font-bold text-slate-800">
                            {p1?.displayName || 'P1'}{' '}
                            <span className="text-blue-600 font-bold text-xs">({p1?.rating || 1200})</span>
                          </p>
                        </div>
                        <div className="col-span-4">
                          <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wider">Player 2</p>
                          <p className="font-bold text-slate-800">
                            {p2?.displayName || 'P2'}{' '}
                            <span className="text-blue-600 font-bold text-xs">({p2?.rating || 1200})</span>
                          </p>
                        </div>
                        <div className="col-span-2 hidden sm:block">
                          <p className="text-xs text-slate-400 mb-0.5 uppercase tracking-wider">Problem</p>
                          <p className="text-sm text-slate-600 font-medium truncate">{match.problem}</p>
                        </div>
                        <div className="col-span-2 flex flex-col items-end gap-1">
                          <p className={`font-mono font-bold text-sm ${isUrgent ? 'text-rose-600' : 'text-slate-700'}`}>
                            {formatTimeLeft(tl)}
                          </p>
                          <p className={`text-xs ${isUrgent ? 'text-rose-400' : 'text-slate-400'}`}>remaining</p>
                          <button
                            type="button"
                            onClick={() => navigate(`/battle/live/${match.matchId}?spectate=1`)}
                            className="text-xs border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 px-2.5 py-1 rounded-lg font-semibold transition mt-1"
                          >
                            Watch
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {matches.length > 5 && (
              <button
                type="button"
                onClick={() => navigate('/watch')}
                className="mt-3 w-full flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 border border-slate-200 bg-white rounded-xl py-3 transition"
              >
                View all live matches <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Tournament Card */}
            <div>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider mb-4">Tournament</h2>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-slate-900 text-lg">Weekly Sprint</h3>
                <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
                  <Calendar size={13} /> Saturday 7 PM • Open Enrollment
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/tournaments')}
                  className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold text-sm transition shadow-md shadow-blue-600/20"
                >
                  Register Now
                </button>
              </div>
            </div>

            {/* Activity Feed */}
            <div>
              <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider mb-4">Activity</h2>
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                {activity.length === 0 && (
                  <p className="text-sm text-slate-400">No recent activity.</p>
                )}
                {activity.slice(0, 6).map((event, idx) => {
                  const Icon = event.type === 'win' ? Swords
                    : event.type === 'rank' ? TrendingUp
                      : event.type === 'join' ? Users
                        : Calendar;

                  return (
                    <div key={idx} className="flex items-start gap-3 text-sm">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon size={12} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-slate-800" dangerouslySetInnerHTML={{
                          __html: event.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                        }} />
                        <p className="text-xs text-slate-400 mt-0.5">{formatAgo(event.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span className="font-bold text-slate-900">CodeBattle</span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-slate-600 transition">About</a>
            <a href="#" className="hover:text-slate-600 transition">Contact</a>
            <a href="#" className="hover:text-slate-600 transition">Terms</a>
            <a href="#" className="hover:text-slate-600 transition">Privacy</a>
          </div>
          <span>© 2024 CodeBattle. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
