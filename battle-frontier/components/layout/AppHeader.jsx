import { useState } from 'react';
import { Settings, LogOut, User } from 'lucide-react';

import { navigate } from '@/src/router.js';
import { getStoredUser, isLoggedIn, avatarUrl, clearAuthSession } from '@/lib/auth/authStore.js';

export function AppHeader({ activeTab = 'Arena' }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const loggedIn = isLoggedIn();
  const user = getStoredUser();

  const NAV_LINKS = [
    { label: 'Arena', path: '/' },
    { label: 'Ranked', path: '/leaderboard' },
    { label: 'Watch', path: '/watch' },
    { label: 'Training', path: '/daily' },
    { label: 'Profile', path: '/profile' },
  ];

  const handleLogout = () => {
    clearAuthSession();
    setUserMenuOpen(false);
    navigate('/');
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
          <button type="button" className="hidden md:flex text-slate-400 hover:text-slate-600 transition p-1.5">
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
    </nav>
  );
}
