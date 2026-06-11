import { useEffect, useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play, Send, RotateCcw,
  CheckCircle2,
  X,
  XCircle,
  Swords,
  Sparkles,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

import { Badge, PlayerCard } from '@/components/battle/PlayerCard.jsx';
import { getCurrentIdentity } from '@/lib/identity/currentIdentity.js';
import { api } from '@/lib/services/apiRequests.js';
import { useMatchStream } from '@/hooks/useMatchStream.js';

export default function BattlePage({ id }) {
  const identity = useMemo(() => getCurrentIdentity(), []);
  const myParticipantId = identity.type === 'user' ? identity.userId : identity.guestId;
  const [myNickname] = useState(() => (
    identity.type === 'guest'
      ? (identity.displayName || localStorage.getItem('battle_nickname') || '')
      : (localStorage.getItem('battle_nickname') || '')
  ));
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [running, setRunning] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState('00:00');
  const [activeTab, setActiveTab] = useState('desc');
  const [matchResult, setMatchResult] = useState('');

  const { data: latestMessage } = useMatchStream(id, identity);

  useEffect(() => {
    if (!latestMessage) return;

    if (latestMessage.type === 'CODE_FEEDBACK' && latestMessage.playerId === myParticipantId) {
      toast.dismiss();
      setRunning(false);
      setSubmitting(false);

      if (latestMessage.action === 'RUN_TESTS') {
        setTestResults(latestMessage.results || []);
        setActiveTab('cases');
        if (latestMessage.success) toast.success('Tests Passed');
        else toast.error('Tests Failed');
      } else if (latestMessage.action === 'SUBMIT_SOLUTION') {
        if (latestMessage.success) {
          toast.success('Accepted!');
          setSubmissionResult({ success: true, msg: 'All Test Cases Passed!' });
        } else {
          toast.error('Solution Failed');
          setTestResults(latestMessage.results || []);
          setActiveTab('cases');
          setSubmissionResult({ success: false, msg: latestMessage.error || 'Wrong Answer' });
        }
      }
    }

    if (latestMessage.type === 'AI_STATUS' && latestMessage.playerId === myParticipantId) {
      toast('AI Referee is thinking...');
      setAnalyzing(true);
    }

    if (latestMessage.type === 'AI_ANALYSIS' && latestMessage.playerId === myParticipantId) {
      setAnalyzing(false);
      setAiAnalysis(latestMessage.text || '');
      setActiveTab('analysis');
      toast.success('Analysis Ready!');
    }

    if (latestMessage.type === 'PLAYER_JOINED') {
      if (latestMessage.players) {
        setMatchData((prev) => (prev ? { ...prev, players: latestMessage.players } : null));
      }
      if (latestMessage.playerId && latestMessage.playerId !== myParticipantId) {
        toast(`${latestMessage.displayName || latestMessage.playerId} joined!`);
      }
    }

    if (latestMessage.type === 'GAME_OVER') {
      setMatchData((prev) => (prev ? {
        ...prev,
        status: 'FINISHED',
        winnerId: latestMessage.winner || null,
      } : null));

      if (latestMessage.winner === myParticipantId) {
        toast('You won!', { duration: 5000 });
        setMatchResult('YOU WON');
      } else if (latestMessage.winner === null) {
        toast('It is a draw', { duration: 5000 });
        setMatchResult('ITS A DRAW');
      } else {
        toast('You lost', { duration: 2500 });
        setMatchResult('YOU LOST');
      }
    }

    if (latestMessage.type === 'START_RACE') {
      setMatchData((prev) => (prev ? {
        ...prev,
        status: 'RACING',
        startTime: latestMessage.startTime || Date.now(),
        endTime: latestMessage.endTime || 0,
      } : null));
      toast('Race Started!');
    }
  }, [latestMessage, myParticipantId]);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const data = await api.getAction(`/match/${id}`);

        setMatchData(data);

        if (data.problem?.template?.javascript) {
          setCode(data.problem.template.javascript);
        }
      } catch (error) {
        console.error('Failed to fetch match:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchMatch();
  }, [id]);

  useEffect(() => {
    if (!matchData) return undefined;
    if (matchData.status === 'FINISHED') {
      setTimeLeft('00:00');
      return undefined;
    }

    const calculateTime = () => {
      const now = Date.now();
      const end = matchData.endTime || 0;

      if (matchData.status === 'WAITING') {
        const minutes = Math.floor((matchData.duration || 300000) / 60000);
        return `${minutes}:00`;
      }

      const diff = end - now;
      if (diff <= 0) return '00:00';
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    setTimeLeft(calculateTime() || '00:00');
    const interval = setInterval(() => {
      const timeString = calculateTime();
      setTimeLeft(timeString || '00:00');
      if (timeString === '00:00') clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [matchData]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    if (matchData?.problem?.template && matchData.problem.template[newLang]) {
      setCode(matchData.problem.template[newLang]);
    }
  };

  const handleRun = async () => {
    if (!matchData || !myParticipantId) return;

    setRunning(true);
    setTestResults(null);
    toast.loading('Running test cases...', { duration: 8000 });

    try {
      await api.postAction('/match/run', {
        matchId: matchData.matchId,
        playerId: myParticipantId,
        guestId: identity.type === 'guest' ? identity.guestId : undefined,
        displayName: myNickname || undefined,
        language,
        code,
        type: 'RUN_TESTS',
      });
    } catch (_error) {
      toast.dismiss();
      toast.error('Failed to execute code');
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!matchData || !myParticipantId) return;

    setSubmitting(true);
    setSubmissionResult(null);
    toast.loading('Submitting...', { duration: 10000 });

    try {
      await api.postAction('/match/submit', {
        matchId: matchData.matchId,
        playerId: myParticipantId,
        guestId: identity.type === 'guest' ? identity.guestId : undefined,
        displayName: myNickname || undefined,
        language,
        code,
        type: 'SUBMIT_SOLUTION',
      });
    } catch (_error) {
      toast.dismiss();
      toast.error('Failed to submit');
      setSubmitting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!matchData || !myParticipantId) return;
    setAnalyzing(true);
    setActiveTab('analysis');

    try {
      await api.postAction('/match/analyze', {
        matchId: matchData.matchId,
        playerId: myParticipantId,
        guestId: identity.type === 'guest' ? identity.guestId : undefined,
        displayName: myNickname || undefined,
        language,
        code,
        problemTitle: matchData.problem?.title,
      });
    } catch (_error) {
      toast.error('Failed to start analysis');
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-slate-500 animate-pulse">Loading Arena...</div>;
  }

  if (!matchData) {
    return <div className="h-screen flex items-center justify-center text-rose-500 font-bold">Match not found or API error</div>;
  }

  const { problem, players = [], status, participants = [] } = matchData;
  const participantById = new Map(participants.map((participant) => [participant.participantId, participant]));
  const opponentId = players.find((player) => player !== myParticipantId);
  const opponentName = participantById.get(opponentId)?.displayName || opponentId || 'Opponent';
  const myDisplayName = participantById.get(myParticipantId)?.displayName || myNickname;
  const playerOneName = participantById.get(players[0])?.displayName || players[0] || 'Player 1';
  const playerTwoName = participantById.get(players[1])?.displayName || players[1] || 'Player 2';
  const isSpectator = !players.includes(myParticipantId);

  let statusDotClass = 'bg-red-500';

  if (matchResult === 'YOU WON') {
    statusDotClass = 'bg-emerald-500';
  } else if (matchResult === 'YOU LOST') {
    statusDotClass = 'bg-red-500';
  } else if (status === 'RACING') {
    statusDotClass = 'bg-emerald-500 animate-pulse';
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden font-sans relative">
      <Toaster position="top-center" />

      <PageHeader statusDotClass={statusDotClass} matchResult={matchResult} matchData={matchData} />

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-5/12 lg:w-4/12 h-[40vh] md:h-auto flex flex-col bg-white border-b md:border-b-0 md:border-r border-slate-200 shrink-0">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-slate-900">{problem?.title}</h1>
              <Badge color={problem?.difficulty === 'Easy' ? 'green' : problem?.difficulty === 'Medium' ? 'yellow' : 'red'}>
                {problem?.difficulty || 'Easy'}
              </Badge>
            </div>
          </div>

          <div className="flex border-b border-slate-100 px-5 gap-6 text-sm font-medium">
            <button type="button" onClick={() => setActiveTab('desc')} className={`py-3 border-b-2 transition-colors ${activeTab === 'desc' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              Description
            </button>
            <button type="button" onClick={() => setActiveTab('cases')} className={`py-3 border-b-2 transition-colors ${activeTab === 'cases' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {testResults ? 'Test Results' : 'Examples'}
            </button>
            {(aiAnalysis || analyzing) && (
              <button type="button" onClick={() => setActiveTab('analysis')} className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'analysis' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                <Sparkles size={14} /> AI Review
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
            {activeTab === 'desc' && (
              <div className="prose prose-sm max-w-none text-slate-600">
                <div className="mb-4 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-rose-600">
                  <ReactMarkdown>{problem?.description || ''}</ReactMarkdown>
                </div>
                {problem?.task && (
                  <div className="bg-blue-50 p-4 rounded-lg text-blue-800 text-sm mb-4 border border-blue-100">
                    <strong>Task:</strong> {problem.task}
                  </div>
                )}
                {problem?.input_format && (
                  <>
                    <h3 className="text-slate-800 font-bold text-xs uppercase tracking-wider mb-2 mt-6">Input Format</h3>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700 font-mono text-xs">{problem.input_format}</div>
                  </>
                )}
                {problem?.output_format && (
                  <>
                    <h3 className="text-slate-800 font-bold text-xs uppercase tracking-wider mb-2 mt-6">Output Format</h3>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-700 font-mono text-xs">{problem.output_format}</div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'cases' && (
              <div className="space-y-4">
                {testResults ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-800">Execution Results</h3>
                      <button type="button" onClick={() => setTestResults(null)} className="text-xs text-blue-600 hover:underline">Clear</button>
                    </div>
                    {testResults.map((result, idx) => (
                      <div key={`${result.id}-${idx}`} className={`border rounded-lg overflow-hidden ${result.passed ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                        <div className="p-3 flex items-center gap-3 border-b border-black/5">
                          {result.passed ? <CheckCircle2 size={18} className="text-green-600" /> : <XCircle size={18} className="text-red-600" />}
                          <span className={`text-sm font-bold ${result.passed ? 'text-green-800' : 'text-red-800'}`}>Test Case {idx + 1}</span>
                          <span className="ml-auto text-xs font-mono opacity-70">{result.status}</span>
                        </div>
                        {!result.passed && (
                          <div className="p-3 text-xs space-y-2 bg-white/50">
                            <div className="grid grid-cols-[70px_1fr] gap-2">
                              <span className="font-semibold text-slate-500">Input:</span>
                              <code className="font-mono bg-slate-100 px-1 rounded">{JSON.stringify(result.input)}</code>
                            </div>
                            <div className="grid grid-cols-[70px_1fr] gap-2">
                              <span className="font-semibold text-slate-500">Expected:</span>
                              <code className="font-mono bg-slate-100 px-1 rounded">{JSON.stringify(result.expected)}</code>
                            </div>
                            <div className="grid grid-cols-[70px_1fr] gap-2">
                              <span className="font-semibold text-red-500">Actual:</span>
                              <code className="font-mono bg-red-50 text-red-700 px-1 rounded break-all">{JSON.stringify(result.actual)}</code>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  problem?.examples?.map((ex, idx) => (
                    <div key={`${ex.input}-${idx}`} className="group">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Example {idx + 1}</span>
                      </div>
                      <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 grid grid-cols-[60px_1fr] gap-2">
                          <span className="text-xs font-semibold text-slate-500">Input:</span>
                          <code className="text-xs font-mono text-slate-800">{ex.input || (ex.args ? ex.args.map(a => JSON.stringify(a)).join(', ') : '')}</code>
                        </div>
                        <div className="p-3 grid grid-cols-[60px_1fr] gap-2">
                          <span className="text-xs font-semibold text-slate-500">Output:</span>
                          <code className="text-xs font-mono text-slate-800">{ex.output || JSON.stringify(ex.expected)}</code>
                        </div>
                        {ex.explanation && (
                          <div className="p-3 grid grid-cols-[60px_1fr] gap-2 border-t border-slate-100 bg-blue-50/50">
                            <span className="text-xs font-semibold text-slate-500">Explain:</span>
                            <span className="text-xs text-slate-600">{ex.explanation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="animate-in fade-in zoom-in-95 duration-300 h-full">
                {analyzing ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Sparkles className="animate-spin text-indigo-500" size={24} />
                    <p className="text-sm font-medium animate-pulse">AI Referee is analyzing complexity...</p>
                  </div>
                ) : (
                  <div className="pb-4">
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-6 flex items-start gap-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600 shrink-0">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-indigo-950 text-sm">Coach&apos;s Feedback</h3>
                        <p className="text-xs text-indigo-700/80 mt-0.5">Automated Code Review</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <ReactMarkdown
                        components={{
                          h3: ({ node: _node, ...props }) => (
                            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider border-b border-slate-100 pb-2 mb-3 mt-6 first:mt-0" {...props} />
                          ),
                          ul: ({ node: _node, ...props }) => (
                            <ul className="space-y-2 mb-4" {...props} />
                          ),
                          li: ({ node: _node, children, ...props }) => (
                            <li className="text-sm text-slate-600 flex gap-2 items-start" {...props}>
                              <span className="text-slate-400 mt-1.5">•</span>
                              <span className="flex-1 leading-relaxed">{children}</span>
                            </li>
                          ),
                          p: ({ node: _node, ...props }) => (
                            <p className="text-sm text-slate-600 mb-2" {...props} />
                          ),
                          strong: ({ node: _node, ...props }) => (
                            <strong className="font-semibold text-slate-800 bg-slate-100 px-1 rounded" {...props} />
                          ),
                        }}
                      >
                        {aiAnalysis || ''}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative min-h-0">
          <PlayerCard name={isSpectator ? playerOneName : opponentName} isOpponent timeLeft={timeLeft} status={status} />

          <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md px-2 py-1.5 focus:outline-none"
              >
                {Object.keys(matchData.problem.template).map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>

              <button type="button" onClick={() => handleLanguageChange(language)} className="p-1.5 text-slate-400 hover:text-slate-600 transition">
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 relative min-h-0">
            <Editor
              height="100%"
              language={language}
              value={code}
              theme="light"
              onChange={(value) => setCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                padding: { top: 16, bottom: 16 },
                fontFamily: 'JetBrains Mono, monospace',
                readOnly: isSpectator,
              }}
            />
            {submissionResult && (
              <div className={`absolute bottom-4 left-4 right-4 z-20 p-4 rounded-lg border shadow-xl flex justify-between items-start animate-in slide-in-from-bottom-2 ${submissionResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <div>
                  <strong className="block font-bold mb-1">{submissionResult.success ? 'Verdict: Accepted' : 'Verdict: Failed'}</strong>
                  <p className="font-mono text-xs whitespace-pre-wrap">{submissionResult.msg}</p>
                </div>
                <button type="button" onClick={() => setSubmissionResult(null)} className="opacity-50 hover:opacity-100">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          <PlayerCard name={isSpectator ? playerTwoName : myDisplayName} isOpponent={false} timeLeft={timeLeft} status={status} />

          <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
            {matchResult && !isSpectator && (
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm font-bold transition disabled:opacity-50"
              >
                <Sparkles size={16} />
                {analyzing ? 'Thinking...' : 'Analyze Code'}
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={handleRun} disabled={running || submitting || isSpectator || status !== 'RACING'} className={`flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition ${(running || status !== 'RACING') ? 'opacity-70 cursor-not-allowed' : ''}`}>
                {running ? 'Running...' : <><Play size={16} fill="currentColor" /> Run</>}
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting || running || isSpectator || status !== 'RACING'} className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg text-sm font-bold shadow-lg transition hover:translate-y-[-1px] ${submitting || isSpectator || status !== 'RACING' ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-green-600 hover:bg-green-700 shadow-green-600/20'}`}>
                {submitting ? 'Judging...' : <><Send size={16} /> Submit</>}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const PageHeader = ({ statusDotClass, matchResult, matchData }) => (
  <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-lg shadow-blue-600/20">
          <Swords size={20} />
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">CodeBattle.</span>
      </div>
      <div className="h-4 w-px bg-slate-200 mx-2" />
      <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
        <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
        {matchResult || matchData.status}
      </div>
    </div>
    <div className="flex items-center gap-3">
      <div className="bg-slate-100 px-3 py-1.5 rounded-md text-xs font-bold text-slate-600 border border-slate-200">
        ID: {matchData.matchId}
      </div>
    </div>
  </header>
);
