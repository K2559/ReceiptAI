import React, { useCallback } from 'react';
import { Upload as UploadIcon, X, FileText, Loader2, CheckCircle, AlertCircle, Terminal } from 'lucide-react';
import { useProcessing } from '../context/ProcessingContext';
import { useNavigate } from 'react-router-dom';
import DebugLogViewer from '../components/DebugLogViewer';

const UploadPage: React.FC = () => {
  const { 
    queue, 
    addFiles, 
    removeFile, 
    clearQueue, 
    startProcessing, 
    isProcessing, 
    processedCount, 
    logs 
  } = useProcessing();
  
  const [isDragging, setIsDragging] = React.useState(false);
  const [showDebugLogs, setShowDebugLogs] = React.useState(false);
  const navigate = useNavigate();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((file: File) => 
        file.type.startsWith('image/')
      );
      addFiles(droppedFiles);
    }
  }, [addFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files).filter((file: File) => 
        file.type.startsWith('image/')
      );
      addFiles(selectedFiles);
    }
  };

  const handleStart = async () => {
    await startProcessing();
    // Optional: Auto-navigate only if user is still on this page and everything is done?
    // For now we just let them stay or click Database manually, or we can use the visual feedback.
    // If you want auto-redirect after *all* are done:
    // navigate('/database'); 
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-slate-900">Upload Receipts</h1>
          <button
            onClick={() => setShowDebugLogs(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Terminal size={18} />
            Debug Logs
          </button>
        </div>
        <p className="text-slate-600">Drag and drop images. Processing continues in the background if you switch pages.</p>
      </div>

      <DebugLogViewer isOpen={showDebugLogs} onClose={() => setShowDebugLogs(false)} />

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200
          ${isDragging 
            ? 'border-brand-500 bg-brand-50 scale-[1.01]' 
            : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
          }
        `}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="bg-white p-4 rounded-full shadow-sm">
            <UploadIcon className={`w-10 h-10 ${isDragging ? 'text-brand-600' : 'text-slate-400'}`} />
          </div>
          <div>
            <p className="text-lg font-medium text-slate-900">Click to upload or drag and drop</p>
            <p className="text-sm text-slate-500 mt-1">PNG, JPG, WEBP up to 10MB</p>
          </div>
        </div>
      </div>

      {/* File List */}
      {queue.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Queue ({queue.length})</h2>
            <button
              onClick={clearQueue}
              disabled={isProcessing}
              className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {queue.map((item) => (
              <div key={item.id} className={`relative group bg-white border rounded-lg p-3 shadow-sm transition-all ${
                  item.status === 'processing' ? 'border-brand-400 ring-2 ring-brand-100' :
                  item.status === 'completed' ? 'border-green-400' :
                  item.status === 'error' ? 'border-red-400' : 'border-slate-200'
              }`}>
                {/* Remove button only if not processing */}
                {!isProcessing && item.status === 'pending' && (
                    <button
                    onClick={() => removeFile(item.id)}
                    className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 rounded-full p-1 shadow border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                    <X size={14} />
                    </button>
                )}
                
                {/* Status Indicator Overlays */}
                <div className="absolute top-2 right-2 z-10">
                    {item.status === 'processing' && <Loader2 className="animate-spin text-brand-600 bg-white rounded-full p-0.5" size={20} />}
                    {item.status === 'completed' && <CheckCircle className="text-green-500 bg-white rounded-full" size={20} />}
                    {item.status === 'error' && <AlertCircle className="text-red-500 bg-white rounded-full" size={20} />}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="w-full h-24 bg-slate-100 rounded-md overflow-hidden flex items-center justify-center relative">
                    <img 
                      src={URL.createObjectURL(item.file)} 
                      alt="Preview" 
                      className={`w-full h-full object-cover transition-opacity ${item.status === 'processing' ? 'opacity-75' : ''}`}
                    />
                  </div>
                  <p className="text-xs text-slate-600 truncate w-full text-center font-medium">
                    {item.file.name}
                  </p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    {item.status}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Action Area */}
          <div className="flex flex-col gap-4 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
             {/* Progress Info */}
             {(isProcessing || processedCount > 0) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                     <span className="flex items-center gap-2">
                        {isProcessing ? <Loader2 className="animate-spin text-brand-600" size={16} /> : <CheckCircle className="text-green-600" size={16} />}
                        {isProcessing ? 'Processing in background...' : 'Batch Complete'}
                     </span>
                     <span>{processedCount} / {queue.length}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-brand-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(processedCount / Math.max(queue.length, 1)) * 100}%` }}
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto text-xs font-mono text-slate-500 space-y-1 border-t border-slate-100 pt-2">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                  </div>
                </div>
             )}

             <button
                 onClick={handleStart}
                 disabled={isProcessing || queue.filter(i => i.status === 'pending').length === 0}
                 className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
               >
                 <FileText size={20} />
                 {isProcessing ? 'Processing...' : 'Start Batch Extraction'}
             </button>
             
             {/* Link to Database if complete */}
             {!isProcessing && processedCount > 0 && processedCount === queue.length && (
                 <button 
                    onClick={() => navigate('/database')}
                    className="w-full py-2 text-brand-600 hover:bg-brand-50 border border-brand-200 rounded-lg text-sm font-medium"
                 >
                    View Results in Database
                 </button>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadPage;