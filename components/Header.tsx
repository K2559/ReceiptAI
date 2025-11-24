import React from 'react';
import { NavLink } from 'react-router-dom';
import { Upload, Database, Receipt, Settings, Loader2 } from 'lucide-react';
import { useProcessing } from '../context/ProcessingContext';

const Header: React.FC = () => {
  const { isProcessing, queue, processedCount } = useProcessing();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 font-medium'
        : 'text-slate-600 hover:bg-gray-100 hover:text-slate-900'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-brand-600 text-white p-2 rounded-lg">
            <Receipt size={24} />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-700 to-brand-500">
            ReceiptAI
          </span>
          
          {/* Global Status Indicator */}
          {isProcessing && (
              <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-medium animate-pulse border border-brand-100">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Processing {processedCount}/{queue.length}</span>
              </div>
          )}
        </div>

        <nav className="flex items-center gap-2">
          <NavLink to="/" className={linkClass}>
            <Upload size={18} />
            <span className="hidden sm:inline">Upload</span>
          </NavLink>
          <NavLink to="/database" className={linkClass}>
            <Database size={18} />
            <span className="hidden sm:inline">Database</span>
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            <Settings size={18} />
            <span className="hidden sm:inline">Settings</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
};

export default Header;