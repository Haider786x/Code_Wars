import { useState } from 'react';
import { Swords, Zap, Menu, X, Github, Trophy, History, Star, User, LayoutGrid } from 'lucide-react';
import { navigate } from '@/src/router.js';

export const Navbar = ({ setIsMatchModalOpen, setActiveTab }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileAction = (tab) => {
    setIsMatchModalOpen(true);
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const githubUrl = 'https://github.com/sambhandavale/code-battle';

  const navLinks = [
    { label: 'Join', action: () => { setIsMatchModalOpen(true); setActiveTab('join'); } },
    { label: 'Daily', action: () => navigate('/daily'), icon: <Star size={14} className="text-amber-500" /> },
    { label: 'Leaderboard', action: () => navigate('/leaderboard'), icon: <Trophy size={14} className="text-amber-400" /> },
    { label: 'History', action: () => navigate('/history'), icon: <History size={14} className="text-blue-400" /> },
    { label: 'Tournaments', action: () => navigate('/tournaments'), icon: <LayoutGrid size={14} className="text-indigo-400" /> },
    { label: 'Profile', action: () => navigate('/profile'), icon: <User size={14} className="text-slate-400" /> },
  ];

  return (
    <nav className="relative px-6 py-4 max-w-7xl mx-auto border-b border-slate-100/50 bg-white">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-lg shadow-blue-600/20">
            <Swords size={20} />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">
            CodeBattle.
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 text-slate-500 font-medium text-sm">
          {navLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={link.action}
              className="cursor-pointer flex items-center gap-1.5 hover:text-slate-900 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition"
            >
              {link.icon}
              {link.label}
            </button>
          ))}

          <div className="w-px h-5 bg-slate-200 mx-2" />

          <button
            type="button"
            onClick={() => {
              setIsMatchModalOpen(true);
              setActiveTab('create');
            }}
            className="cursor-pointer flex items-center gap-1 text-orange-500 bg-orange-50 px-4 py-2 rounded-xl text-xs font-bold hover:bg-orange-100 transition"
          >
            <Zap size={13} /> Create
          </button>

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-700 transition shadow-lg shadow-slate-900/20 ml-1"
          >
            <Github size={16} />
            <span className="font-semibold text-xs">Star us</span>
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden text-slate-500 hover:text-blue-600 transition"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? (
            <X size={24} className="cursor-pointer" />
          ) : (
            <Menu size={24} className="cursor-pointer" />
          )}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-100 shadow-xl z-50 animate-in slide-in-from-top-2">
          <div className="flex flex-col p-4 gap-1 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => { handleMobileAction('join'); }}
              className="p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition flex items-center gap-3"
            >
              <Swords size={16} className="text-blue-500" />
              Join a Battle
            </button>

            {navLinks.slice(1).map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={() => { link.action(); setIsMobileMenuOpen(false); }}
                className="p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition flex items-center gap-3"
              >
                {link.icon}
                {link.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => handleMobileAction('create')}
              className="p-3 rounded-lg bg-orange-50 text-orange-600 cursor-pointer flex items-center gap-3 font-bold mt-2"
            >
              <Zap size={16} className="text-orange-500" />
              Create New Room
            </button>

            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-slate-900 text-white cursor-pointer transition flex items-center justify-center gap-3 shadow-md mt-1"
            >
              <Github size={18} />
              Star on GitHub
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};
