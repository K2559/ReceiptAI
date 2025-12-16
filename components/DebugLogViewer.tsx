import React, { useState, useEffect } from 'react';
import { X, Terminal, AlertCircle, Info, CheckCircle, AlertTriangle, Trash2, Copy } from 'lucide-react';
import { getDebugLogs, clearDebugLogs, DebugLog } from '../services/llmService';

interface DebugLogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DebugLogViewer: React.FC<DebugLogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterLevel, setFilterLevel] = useState<'all' | 'success' | 'error' | 'warn'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    // Initial load
    setLogs(getDebugLogs());
    
    // Poll for updates every 500ms
    const interval = setInterval(() => {
      setLogs(getDebugLogs());
    }, 500);
    
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClearLogs = () => {
    clearDebugLogs();
    setLogs([]);
  };

  const getIcon = (level: DebugLog['level']) => {
    switch (level) {
      case 'error': return <AlertCircle className="text-red-500" size={16} />;
      case 'warn': return <AlertTriangle className="text-yellow-500" size={16} />;
      case 'success': return <CheckCircle className="text-green-500" size={16} />;
      default: return <Info className="text-blue-500" size={16} />;
    }
  };

  const getLogColor = (level: DebugLog['level']) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warn': return 'text-yellow-700 bg-yellow-50';
      case 'success': return 'text-green-600 bg-green-50';
      default: return 'text-slate-700 bg-slate-50';
    }
  };

  const filteredLogs = logs.filter(log => {
    // Filter by level
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const messageMatch = log.message.toLowerCase().includes(searchLower);
      const detailsMatch = log.details ? JSON.stringify(log.details).toLowerCase().includes(searchLower) : false;
      return messageMatch || detailsMatch;
    }
    
    return true;
  });

  const copyLogsToClipboard = () => {
    const logText = filteredLogs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const details = log.details ? `\n${JSON.stringify(log.details, null, 2)}` : '';
      return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}${details}`;
    }).join('\n\n');
    
    navigator.clipboard.writeText(logText);
    alert('Logs copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Terminal className="text-brand-600" size={24} />
            <h2 className="text-xl font-bold text-slate-900">Debug Logs</h2>
            <span className="text-sm text-slate-500">({filteredLogs.length}/{logs.length} entries)</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
            <button
              onClick={copyLogsToClipboard}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Copy logs to clipboard"
            >
              Copy
            </button>
            <button
              onClick={handleClearLogs}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear logs"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Filter:</span>
            <button
              onClick={() => setFilterLevel('all')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filterLevel === 'all' 
                  ? 'bg-slate-700 text-white' 
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterLevel('success')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filterLevel === 'success' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-white text-green-600 hover:bg-green-50'
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setFilterLevel('error')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filterLevel === 'error' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-white text-red-600 hover:bg-red-50'
              }`}
            >
              Errors
            </button>
            <button
              onClick={() => setFilterLevel('warn')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filterLevel === 'warn' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-white text-yellow-600 hover:bg-yellow-50'
              }`}
            >
              Warnings
            </button>
          </div>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Log Content */}
        <div 
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <Terminal size={48} className="mx-auto mb-2 opacity-50" />
              <p>{logs.length === 0 ? 'No logs yet. Start processing receipts to see debug information.' : 'No logs match your filters.'}</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getLogColor(log.level)} border-current/20`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getIcon(log.level)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs opacity-60">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-xs font-bold uppercase opacity-60">
                        {log.level}
                      </span>
                    </div>
                    <div className="font-medium mb-1">{log.message}</div>
                    {log.details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs opacity-70 hover:opacity-100">
                          View details
                        </summary>
                        <pre className="mt-2 p-2 bg-white/50 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
          <p>💡 Tip: These logs show detailed communication with your LLM provider (Gemini/OpenRouter). Use them to debug API issues.</p>
        </div>
      </div>
    </div>
  );
};

export default DebugLogViewer;
