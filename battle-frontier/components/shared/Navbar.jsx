import { useState } from 'react';
import { Swords, Zap, Menu, X, Github } from 'lucide-react';

export const Navbar = ({ setIsMatchModalOpen, setActiveTab }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileAction = (tab) => {
    setIsMatchModalOpen(true);
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const githubUrl = 'https://github.com/sambhandavale/code-battle';

  return (
    <nav className="relative px-6 py-4 max-w-7xl mx-auto border-b border-slate-100/50 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-lg shadow-blue-600/20">
            <Swords size={20} />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">
            CodeBattle.
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-slate-500 font-medium text-sm">
          <button
            type="button"
            onClick={() => {
              setIsMatchModalOpen(true);
              setActiveTab('join');
            }}
            className="cursor-pointer hover:text-blue-600 transition"
          >
            Join
          </button>

          <button
            type="button"
            onClick={() => {
              setIsMatchModalOpen(true);
              setActiveTab('create');
            }}
            className="cursor-pointer flex items-center gap-1 text-orange-500 bg-orange-50 px-4 py-2 rounded-xl text-xs font-bold hover:bg-orange-100 transition"
          >
            Create
          </button>

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-full hover:bg-slate-700 transition shadow-lg shadow-slate-900/20"
          >
            <Github size={18} />
            <span className="font-semibold">Star us</span>
          </a>
        </div>

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
          <div className="flex flex-col p-4 gap-4 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => handleMobileAction('join')}
              className="p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition flex items-center gap-3"
            >
              <Swords size={16} className="text-blue-500" />
              Join a Battle
            </button>

            <button
              type="button"
              onClick={() => handleMobileAction('create')}
              className="p-3 rounded-lg bg-orange-50 text-orange-600 cursor-pointer flex items-center gap-3 font-bold"
            >
              <Zap size={16} className="text-orange-500" />
              Create New Room
            </button>

            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-lg bg-slate-900 text-white cursor-pointer transition flex items-center justify-center gap-3 shadow-md"
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
