import { useEffect, useState } from 'react';
import {
  Trophy, ArrowLeft, Plus, Users, Clock, Crown, ChevronRight,
  Swords, Calendar, Star, Shield,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { api } from '@/lib/services/apiRequests.js';
import { navigate } from '@/src/router.js';
import { getCurrentIdentity } from '@/lib/identity/currentIdentity.js';
import { setGuestDisplayName } from '@/lib/identity/guestIdentity.js';

const FORMAT_LABELS = {
  SINGLE_ELIMINATION: { label: 'Single Elimination', icon: '⚔️', desc: 'Lose once and you\'re out' },
  ROUND_ROBIN: { label: 'Round Robin', icon: '🔄', desc: 'Everyone plays everyone' },
  COLLEGE_EVENT: { label: 'College Event', icon: '🎓', desc: 'Multi-round college format' },
};

function TournamentCard({ tournament, onJoin }) {
  const format = FORMAT_LABELS[tournament.format] || { label: tournament.format, icon: '🏆' };
  const isFull = tournament.participants?.length >= tournament.maxParticipants;
  const spotsLeft = (tournament.maxParticipants || 0) - (tournament.participants?.length || 0);

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/8 transition group cursor-pointer">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{format.icon}</span>
            <h3 className="font-bold text-white text-lg">{tournament.name}</h3>
          </div>
          <p className="text-xs text-slate-400">{format.label} • {format.desc}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
          tournament.status === 'REGISTRATION'
            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
            : 'bg-blue-950/60 text-blue-400 border border-blue-700/50'
        }`}>
          {tournament.status === 'REGISTRATION' ? 'Open' : 'In Progress'}
        </span>
      </div>

      <div className="flex items-center gap-6 text-sm text-slate-400 mb-5">
        <span className="flex items-center gap-1.5">
          <Users size={14} />
          {tournament.participants?.length || 0}/{tournament.maxParticipants}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={14} />
          {tournament.problemDuration}m per match
        </span>
        {tournament.startTime && (
          <span className="flex items-center gap-1.5">
            <Calendar size={14} />
            {new Date(tournament.startTime).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Participant avatars */}
      {tournament.participants?.length > 0 && (
        <div className="flex items-center gap-1 mb-5">
          {tournament.participants.slice(0, 5).map((pid, idx) => (
            <img
              key={pid}
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${pid}`}
              alt="player"
              className="w-7 h-7 rounded-full border-2 border-slate-800"
              style={{ zIndex: 5 - idx, marginLeft: idx > 0 ? '-8px' : '0' }}
            />
          ))}
          {tournament.participants?.length > 5 && (
            <span className="text-xs text-slate-500 ml-2">+{tournament.participants.length - 5} more</span>
          )}
        </div>
      )}

      {tournament.status === 'REGISTRATION' && (
        <button
          type="button"
          onClick={() => onJoin(tournament)}
          disabled={isFull}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition ${
            isFull
              ? 'bg-white/5 text-slate-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
          }`}
        >
          {isFull ? `Full (${tournament.maxParticipants}/${tournament.maxParticipants})` : `Join — ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
        </button>
      )}

      {tournament.status === 'ACTIVE' && (
        <button
          type="button"
          onClick={() => navigate(`/tournament/${tournament.tournamentId}`)}
          className="w-full py-2.5 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/15 text-white transition flex items-center justify-center gap-2"
        >
          View Bracket <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

function CreateTournamentModal({ onClose, onCreated, identity }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('SINGLE_ELIMINATION');
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [duration, setDuration] = useState(10);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Give your tournament a name!'); return; }
    setLoading(true);
    try {
      const result = await api.postAction('/tournament/create', {
        guestId: identity.type === 'guest' ? identity.guestId : null,
        userId: identity.type === 'user' ? identity.userId : null,
        name: name.trim(),
        format,
        maxParticipants,
        problemDuration: duration,
      });
      toast.success('Tournament created!');
      onCreated(result);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-extrabold text-white mb-6">Create Tournament</h3>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Tournament Name</label>
            <input
              type="text"
              placeholder="e.g. CSE Dept Cup 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 text-sm transition"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Format</label>
            <div className="space-y-2">
              {Object.entries(FORMAT_LABELS).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFormat(key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${format === key ? 'border-indigo-500 bg-indigo-950/40' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <span className="text-xl">{val.icon}</span>
                  <div>
                    <p className="font-semibold text-white text-sm">{val.label}</p>
                    <p className="text-xs text-slate-400">{val.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Max Players</label>
              <select
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
              >
                {[4, 8, 16, 32, 64].map((n) => <option key={n} value={n}>{n} players</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Time per Match</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none"
              >
                {[5, 10, 20].map((t) => <option key={t} value={t}>{t} min</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition text-sm font-semibold">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg disabled:opacity-60"
          >
            {loading ? 'Creating...' : 'Create Tournament'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TournamentsPage() {
  const identity = getCurrentIdentity();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [nickname, setNickname] = useState(() => localStorage.getItem('battle_nickname') || '');

  const fetchTournaments = async () => {
    try {
      const result = await api.getAction('/tournaments');
      setTournaments(result.tournaments || []);
    } catch (err) {
      console.error('Failed to load tournaments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTournaments(); }, []);

  const ensureIdentity = () => {
    if (!nickname.trim()) {
      toast.error('Enter your nickname first');
      return null;
    }
    const id = setGuestDisplayName(nickname);
    localStorage.setItem('battle_nickname', nickname);
    return id;
  };

  const handleJoin = async (tournament) => {
    const id = ensureIdentity();
    if (!id) return;

    const loadingToast = toast.loading('Joining tournament...');
    try {
      await api.postAction('/tournament/join', {
        guestId: id.type === 'guest' ? id.guestId : null,
        userId: id.type === 'user' ? id.userId : null,
        tournamentId: tournament.tournamentId,
      });
      toast.success('Joined tournament!', { id: loadingToast });
      fetchTournaments();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not join', { id: loadingToast });
    }
  };

  const handleCreated = () => {
    setShowCreate(false);
    fetchTournaments();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 font-sans">
      <Toaster position="top-center" />
      {showCreate && (
        <CreateTournamentModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          identity={identity}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500/20 p-2 rounded-xl border border-indigo-500/30">
              <Trophy size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">Tournaments</h1>
              <p className="text-xs text-indigo-400/70">Compete. Climb. Conquer.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-lg shadow-indigo-600/20"
          >
            <Plus size={14} /> Create
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Nickname input */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
            <Shield size={18} className="text-indigo-400" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Your Nickname</label>
            <input
              type="text"
              placeholder="Enter nickname to join tournaments"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400 transition"
            />
          </div>
        </div>

        {/* Format showcase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {Object.entries(FORMAT_LABELS).map(([key, val]) => (
            <div key={key} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <span className="text-3xl block mb-2">{val.icon}</span>
              <h4 className="font-bold text-white text-sm">{val.label}</h4>
              <p className="text-xs text-slate-400 mt-1">{val.desc}</p>
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Trophy className="text-indigo-400 animate-pulse" size={48} />
            <p className="text-slate-400">Loading tournaments...</p>
          </div>
        )}

        {!loading && tournaments.length === 0 && (
          <div className="text-center py-20">
            <Trophy size={64} className="mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-bold text-slate-300 mb-2">No Active Tournaments</h3>
            <p className="text-slate-500 mb-8">Be the first to create one!</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2 mx-auto"
            >
              <Plus size={16} /> Create Tournament
            </button>
          </div>
        )}

        {!loading && tournaments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournaments.map((t) => (
              <TournamentCard key={t.tournamentId} tournament={t} onJoin={handleJoin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
