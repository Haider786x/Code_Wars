import { Settings, LogOut, User, X, Trophy } from 'lucide-react';
import { useState } from 'react';

import { navigate } from '@/src/router.js';
import { getStoredUser, isLoggedIn, avatarUrl, clearAuthSession } from '@/lib/auth/authStore.js';

export function AppHeader({ activeTab = 'Arena' }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Read preferences from localStorage
  const [theme, setTheme] = useState(() => localStorage.getItem('editor.theme') || 'light');
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('editor.fontSize')) || 14);
  const [minimap, setMinimap] = useState(() => localStorage.getItem('editor.minimap') === 'true');

  const loggedIn = isLoggedIn();
  const user = getStoredUser();

  const NAV_LINKS = [
    { label: 'Arena', path: '/' },
    { label: 'Ranked', path: '/leaderboard' },
    { label: 'Watch', path: '/watch' },
    { label: 'Training', path: '/daily' },
    { label: 'Tournaments', path: '/tournaments' },
    { label: 'Profile', path: '/profile' },
  ];

  const handleLogout = () => {
    clearAuthSession();
    setUserMenuOpen(false);
    navigate('/');
  };

  const updateSetting = (key, value, setter) => {
    localStorage.setItem(key, String(value));
    setter(value);
    window.dispatchEvent(new Event('storage')); // notify other pages/editor instances
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-xl font-bold text-slate-900 tracking-tight hover:opacity-80 transition"
        >
          CodeBattle
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = link.label.toLowerCase() === activeTab.toLowerCase();
            return (
              <button
                key={link.label}
                type="button"
                onClick={() => navigate(link.path)}
                className={`px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg'
                }`}
                style={isActive ? { marginBottom: '-1px' } : {}}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="hidden md:flex text-slate-400 hover:text-slate-600 transition p-1.5"
          >
            <Settings size={20} />
          </button>

          {loggedIn && user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 hover:opacity-80 transition"
              >
                <img
                  src={avatarUrl(user.avatar || 'warrior')}
                  alt={user.displayName}
                  className="w-9 h-9 rounded-full border-2 border-slate-200 bg-slate-100"
                />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-12 bg-white border border-slate-200 rounded-xl shadow-xl w-52 z-40">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="font-bold text-slate-900 text-sm">{user.displayName || user.username}</p>
                    <p className="text-xs text-slate-400">@{user.username}</p>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => { navigate('/history'); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                    >
                      Match History
                    </button>
                    <button
                      type="button"
                      onClick={() => { navigate('/tournaments'); setUserMenuOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                    >
                      Tournaments
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition flex items-center gap-2"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm transition"
            >
              <User size={16} /> Sign In
            </button>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 mb-6">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Settings size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Editor Preferences</h3>
                <p className="text-xs text-slate-400">Configure your coding environment</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Theme preference */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-semibold text-slate-800 block">Editor Theme</label>
                  <span className="text-xs text-slate-400">Light or dark coding palette</span>
                </div>
                <select
                  value={theme}
                  onChange={(e) => updateSetting('editor.theme', e.target.value, setTheme)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="light">Light (Default)</option>
                  <option value="vs-dark">vs-dark (Dark)</option>
                </select>
              </div>

              {/* Font size preference */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-semibold text-slate-800 block">Font Size</label>
                  <span className="text-xs text-slate-400">Adjust code text scale</span>
                </div>
                <select
                  value={fontSize}
                  onChange={(e) => updateSetting('editor.fontSize', Number(e.target.value), setFontSize)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="12">12px</option>
                  <option value="14">14px</option>
                  <option value="16">16px</option>
                  <option value="18">18px</option>
                </select>
              </div>

              {/* Minimap preference */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-semibold text-slate-800 block">Monaco Minimap</label>
                  <span className="text-xs text-slate-400">Side visual code outline preview</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('editor.minimap', !minimap, setMinimap)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${minimap ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform shadow ${minimap ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="mt-7 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-bold text-sm transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
