import { useState } from 'react';
import { Eye, EyeOff, Swords, AlertCircle, ArrowRight, Check } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { api } from '@/lib/services/apiRequests.js';
import { setAuthSession, avatarUrl, AVAILABLE_AVATARS } from '@/lib/auth/authStore.js';
import { navigate } from '@/src/router.js';

const AVATAR_LABELS = {
  warrior: 'Warrior',
  ninja: 'Ninja',
  wizard: 'Wizard',
  dragon: 'Dragon',
  phoenix: 'Phoenix',
  titan: 'Titan',
  cipher: 'Cipher',
  oracle: 'Oracle',
  ghost: 'Ghost',
  shadow: 'Shadow',
  storm: 'Storm',
  nexus: 'Nexus',
};

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    password: '',
    confirmPassword: '',
    avatar: 'warrior',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1 = details, 2 = choose avatar

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!form.username || form.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      setError('Username: letters, numbers, and underscores only');
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.postAction('/auth/register', {
        username: form.username.trim().toLowerCase(),
        displayName: form.displayName.trim() || form.username.trim(),
        password: form.password,
        avatar: form.avatar,
      });
      setAuthSession(data.token, data.user);
      toast.success(`Welcome to the arena, ${data.user.displayName}! ⚔️`);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error || 'Registration failed. Please try again.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 font-sans">
      <Toaster position="top-center" />

      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-600/20">
            <Swords size={22} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900 tracking-tight">CodeBattle</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                  s < step ? 'bg-blue-600 text-white' : s === step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {s < step ? <Check size={14} /> : s}
                </div>
                <span className={`text-sm font-medium ${s === step ? 'text-slate-900' : 'text-slate-400'}`}>
                  {s === 1 ? 'Your Details' : 'Choose Avatar'}
                </span>
                {s < 2 && <div className="w-10 h-px bg-slate-200 ml-1" />}
              </div>
            ))}
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {step === 1 ? 'Create your account' : 'Pick your avatar'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {step === 1 ? 'Join the competitive coding arena' : 'This represents you in every battle'}
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl p-3 mb-6">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="username">
                  Username <span className="text-rose-400">*</span>
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoFocus
                  value={form.username}
                  onChange={handleChange}
                  placeholder="e.g. codemaster99"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
                <p className="text-xs text-slate-400 mt-1">3–30 chars, letters/numbers/underscores</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="displayName">
                  Display Name <span className="text-slate-300">(optional)</span>
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  value={form.displayName}
                  onChange={handleChange}
                  placeholder="How others see you"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="password">
                  Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min. 6 characters"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-12 text-slate-900 text-sm placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2" htmlFor="confirmPassword">
                  Confirm Password <span className="text-rose-400">*</span>
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                Next: Choose Avatar <ArrowRight size={16} />
              </button>
            </form>
          )}

          {step === 2 && (
            <div>
              {/* Preview */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <img
                    src={avatarUrl(form.avatar)}
                    alt={form.avatar}
                    className="w-28 h-28 rounded-2xl border-4 border-blue-500 shadow-xl shadow-blue-500/20 bg-slate-100"
                  />
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
                    {AVATAR_LABELS[form.avatar]}
                  </div>
                </div>
              </div>

              {/* Avatar grid */}
              <div className="grid grid-cols-4 gap-3 mb-8">
                {AVAILABLE_AVATARS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, avatar: av }))}
                    className={`relative group flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition ${
                      form.avatar === av
                        ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <img
                      src={avatarUrl(av)}
                      alt={av}
                      className="w-12 h-12 rounded-lg bg-slate-100"
                    />
                    <span className={`text-xs font-semibold truncate w-full text-center ${form.avatar === av ? 'text-blue-700' : 'text-slate-500'}`}>
                      {AVATAR_LABELS[av]}
                    </span>
                    {form.avatar === av && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 py-3 rounded-xl font-bold text-sm transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-2 flex-grow bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? 'Creating account...' : (
                    <>
                      Enter the Arena <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="font-bold text-blue-600 hover:text-blue-700 transition"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
