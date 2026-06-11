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
import { AppHeader } from '@/components/layout/AppHeader.jsx';

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
        time: problem.timeLimitMinutes || 5,
        problemId: problem._id,
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
    <div className="min-h-screen bg-app-bg font-sans">
      <Toaster position="top-center" />
      <AppHeader activeTab="Training" />

      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl border border-amber-200">
              <Star size={20} className="text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Daily Challenge</h1>
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                <Calendar size={12} /> {today || 'Today'}
              </p>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
            <Users size={14} /> {dailyData?.solveCount || 0} solved today
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
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
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Problem Panel */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-900">{problem.title}</h2>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                    problem.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : problem.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}>
                    {problem.difficulty || 'Easy'}
                  </span>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Users size={12} /> {dailyData?.solveCount} solved</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> Resets at midnight</span>
                </div>
              </div>

              <div className="flex border-b border-slate-100 px-5 gap-6 text-sm">
                {['desc', 'examples'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 border-b-2 transition capitalize font-medium ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                  >
                    {tab === 'desc' ? 'Description' : 'Examples'}
                  </button>
                ))}
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                {activeTab === 'desc' && (
                  <div className="space-y-4 text-sm text-slate-700">
                    <div className="prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-slate-800 prose-code:border prose-code:border-slate-200 leading-relaxed">
                      <ReactMarkdown>{problem.description || ''}</ReactMarkdown>
                    </div>
                    {problem.task && (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-800">
                        <strong>Task:</strong> {problem.task}
                      </div>
                    )}
                    {problem.input_format && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Input Format</h4>
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg font-mono text-xs text-slate-700">{problem.input_format}</div>
                      </div>
                    )}
                    {problem.output_format && (
                      <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Output Format</h4>
                        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg font-mono text-xs text-slate-700">{problem.output_format}</div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'examples' && (
                  <div className="space-y-4">
                    {(problem.examples || []).map((ex, idx) => (
                      <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-xs text-slate-500 font-bold uppercase tracking-wider">Example {idx + 1}</div>
                        <div className="p-3 grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500 block mb-1 font-medium">Input:</span>
                            <code className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-mono break-all">{ex.input || (ex.args ? ex.args.map(a => JSON.stringify(a)).join(', ') : '')}</code>
                          </div>
                          <div>
                            <span className="text-slate-500 block mb-1 font-medium">Output:</span>
                            <code className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-mono break-all">{ex.output || JSON.stringify(ex.expected)}</code>
                          </div>
                        </div>
                        {ex.explanation && (
                           <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 text-xs text-slate-600">
                            <span className="font-semibold mr-1 text-slate-700">Explain:</span>
                            {ex.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Code Panel */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 size={16} className="text-blue-600" />
                  <span className="text-sm font-bold text-slate-900">Your Solution</span>
                </div>
                {problem.template && (
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                  >
                    {Object.keys(problem.template).map((lang) => (
                      <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Nickname */}
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <input
                  type="text"
                  placeholder="Your nickname (required to start)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition"
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
                <div className={`p-4 border-t border-slate-200 flex items-start gap-3 ${result.success ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  {result.success ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" /> : <XCircle size={18} className="text-rose-600 shrink-0" />}
                  <div className="text-sm">
                    <p className={`font-bold ${result.success ? 'text-emerald-800' : 'text-rose-800'}`}>{result.success ? 'All tests passed!' : 'Tests failed'}</p>
                    {result.message && <p className="text-xs text-slate-600 mt-0.5">{result.message}</p>}
                  </div>
                </div>
              )}

              <div className="p-4 flex justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={running || submitting}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
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
