import { useEffect, useState } from 'react';
import {
  Star, ArrowLeft, Calendar, Code2, CheckCircle2, XCircle, Users, Clock,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import toast, { Toaster } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

import { api } from '@/lib/services/apiRequests.js';
import { navigate } from '@/src/router.js';
import { getCurrentIdentity } from '@/lib/identity/currentIdentity.js';
import { setGuestDisplayName } from '@/lib/identity/guestIdentity.js';

export default function DailyChallengePage() {
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('desc');
  const [nickname, setNickname] = useState(() => localStorage.getItem('battle_nickname') || '');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getAction('/daily-challenge');
        setDailyData(data);
        if (data.problem?.template?.javascript) {
          setCode(data.problem.template.javascript);
        }
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to load daily challenge');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    if (dailyData?.problem?.template?.[lang]) {
      setCode(dailyData.problem.template[lang]);
    }
  };

  const ensureIdentity = () => {
    if (!nickname.trim()) {
      toast.error('Enter a nickname first!');
      return null;
    }
    const identity = setGuestDisplayName(nickname);
    localStorage.setItem('battle_nickname', nickname);
    return identity;
  };

  const handleRun = async () => {
    const identity = ensureIdentity();
    if (!identity || !dailyData?.problem) return;

    setRunning(true);
    setResult(null);
    toast.loading('Running tests...', { duration: 8000 });

    try {
      // For daily challenge we use a special matchless run (creates a temp match)
      // Instead we spin up a quick match with the daily problem via the regular API
      const randomCode = `daily_${Date.now()}`;
      const created = await api.postAction('/match/create', {
        playerId: identity.guestId,
        guestId: identity.guestId,
        displayName: identity.displayName || nickname,
        matchId: randomCode,
        time: 5,
      });
      toast.dismiss();
      toast.success('Daily challenge started! Redirecting...');
      setTimeout(() => navigate(`/battle/live/${randomCode}`), 800);
    } catch (err) {
      toast.dismiss();
      toast.error(err?.response?.data?.error || 'Could not start daily challenge');
    } finally {
      setRunning(false);
    }
  };

  const problem = dailyData?.problem;
  const today = dailyData?.date;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 font-sans">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-amber-500/20 p-2 rounded-xl border border-amber-500/30">
              <Star size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">Daily Challenge</h1>
              <p className="text-xs text-amber-400/70 flex items-center gap-1">
                <Calendar size={10} /> {today || 'Today'}
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Users size={12} /> {dailyData?.solveCount || 0} solved today
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Star className="text-amber-400 animate-spin" size={48} />
            <p className="text-slate-400 animate-pulse">Loading today&apos;s challenge...</p>
          </div>
        )}

        {error && (
          <div className="bg-rose-950/30 border border-rose-500/30 text-rose-300 rounded-2xl p-8 text-center">
            <p className="font-bold text-lg mb-2">Challenge unavailable</p>
            <p className="text-sm opacity-70">{error}</p>
          </div>
        )}

        {!loading && !error && problem && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Problem Panel */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-5 border-b border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-extrabold text-white">{problem.title}</h2>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                    problem.difficulty === 'Easy' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                    : problem.difficulty === 'Medium' ? 'bg-amber-950/60 text-amber-400 border border-amber-700/50'
                    : 'bg-rose-950/60 text-rose-400 border border-rose-700/50'
                  }`}>
                    {problem.difficulty || 'Easy'}
                  </span>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Users size={10} /> {dailyData?.solveCount} solved</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> Resets at midnight</span>
                </div>
              </div>

              <div className="flex border-b border-white/10 px-5 gap-6 text-sm">
                {['desc', 'examples'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 border-b-2 transition capitalize ${activeTab === tab ? 'border-amber-400 text-amber-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                  >
                    {tab === 'desc' ? 'Description' : 'Examples'}
                  </button>
                ))}
              </div>

              <div className="p-5 overflow-y-auto max-h-96">
                {activeTab === 'desc' && (
                  <div className="space-y-4 text-sm text-slate-300">
                    <p>{problem.description}</p>
                    {problem.task && (
                      <div className="bg-amber-950/30 border border-amber-700/30 p-3 rounded-lg text-amber-200">
                        <strong>Task:</strong> {problem.task}
                      </div>
                    )}
                    {problem.input_format && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Input Format</h4>
                        <div className="bg-white/5 p-3 rounded-lg font-mono text-xs text-slate-300">{problem.input_format}</div>
                      </div>
                    )}
                    {problem.output_format && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Output Format</h4>
                        <div className="bg-white/5 p-3 rounded-lg font-mono text-xs text-slate-300">{problem.output_format}</div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'examples' && (
                  <div className="space-y-4">
                    {(problem.examples || []).map((ex, idx) => (
                      <div key={idx} className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                        <div className="px-3 py-2 border-b border-white/5 text-xs text-slate-400 font-semibold uppercase">Example {idx + 1}</div>
                        <div className="p-3 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500 block mb-1">Input:</span>
                            <code className="text-slate-200 font-mono">{ex.input}</code>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-1">Output:</span>
                            <code className="text-slate-200 font-mono">{ex.output}</code>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Code Panel */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 size={16} className="text-amber-400" />
                  <span className="text-sm font-semibold text-white">Your Solution</span>
                </div>
                {problem.template && (
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-white/10 border border-white/20 text-slate-200 text-xs font-semibold rounded-lg px-2 py-1.5 focus:outline-none"
                  >
                    {Object.keys(problem.template).map((lang) => (
                      <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Nickname */}
              <div className="px-4 py-3 border-b border-white/10">
                <input
                  type="text"
                  placeholder="Your nickname (required to start)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              <div className="flex-1 min-h-[300px]">
                <Editor
                  height="100%"
                  language={language}
                  value={code}
                  theme="vs-dark"
                  onChange={(val) => setCode(val || '')}
                  options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 12 } }}
                />
              </div>

              {result && (
                <div className={`p-4 border-t border-white/10 flex items-start gap-3 ${result.success ? 'bg-emerald-950/40' : 'bg-rose-950/40'}`}>
                  {result.success ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> : <XCircle size={18} className="text-rose-400 shrink-0" />}
                  <div className="text-sm">
                    <p className={`font-bold ${result.success ? 'text-emerald-300' : 'text-rose-300'}`}>{result.success ? 'All tests passed!' : 'Tests failed'}</p>
                    {result.message && <p className="text-xs text-slate-400 mt-0.5">{result.message}</p>}
                  </div>
                </div>
              )}

              <div className="p-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={running || submitting}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {running ? 'Starting...' : 'Start Challenge'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
