import React from 'react';
import { UserTier } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: string;
  onViewChange: (view: 'input' | 'results' | 'spec' | 'pricing' | 'auth' | 'payment') => void;
  isLoggedIn: boolean;
  userTier: UserTier;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, isLoggedIn, userTier }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center text-white font-bold text-xl cursor-pointer" onClick={() => onViewChange('input')}>
            V
          </div>
          <div className="cursor-pointer" onClick={() => onViewChange('input')}>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">VeriCite <span className="text-slate-500 font-normal">Academic</span></h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Academic Citation Verification Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => onViewChange('input')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'input' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Processor
            </button>
            <button 
              onClick={() => onViewChange('results')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'results' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              disabled={activeView === 'input'}
            >
              Insights
            </button>
            <button 
              onClick={() => onViewChange('spec')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeView === 'spec' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Tech Spec
            </button>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 mx-2" />

          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${userTier === UserTier.PRO ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                {userTier}
              </span>
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs border border-slate-300">
                JD
              </div>
            </div>
          ) : (
            <button 
              onClick={() => onViewChange('auth')}
              className="text-sm font-bold text-slate-600 hover:text-slate-900 px-4"
            >
              Login
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {children}
      </main>

      <footer className="bg-white border-t border-slate-200 p-6 flex flex-col items-center justify-center gap-3">
        <div className="flex gap-6 text-slate-400 text-xs font-medium">
          <a href="#" className="hover:text-slate-600">Privacy Policy</a>
          <a href="#" className="hover:text-slate-600">Terms of Service</a>
          <a href="#" className="hover:text-slate-600">Contact Support</a>
        </div>
        <p className="text-[10px] text-slate-400 max-w-xl text-center leading-relaxed font-medium">
          VeriCite Academic may produce errors. Users are strongly advised to independently verify critical academic information before submission or publication.
        </p>
        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-2">
          &copy; 2025 VeriCite Academic Systems
        </p>
      </footer>
    </div>
  );
};

export default Layout;
