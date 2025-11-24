import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { extractReceiptData } from '../services/llmService';
import { addReceipt } from '../services/storageService';

export interface QueueItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface ProcessingContextType {
  queue: QueueItem[];
  isProcessing: boolean;
  logs: string[];
  processedCount: number;
  lastUpdated: number;
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearQueue: () => void;
  startProcessing: () => Promise<void>;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

export const ProcessingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  
  // Use ref to access latest queue state inside async loops
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const addFiles = useCallback((files: File[]) => {
    const newItems = files.map(file => ({
      id: uuidv4(),
      file,
      status: 'pending' as const
    }));
    setQueue(prev => [...prev, ...newItems]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    if (isProcessing) return;
    setQueue([]);
    setLogs([]);
  }, [isProcessing]);

  const updateItemStatus = (id: string, status: QueueItem['status'], error?: string) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status, error } : item
    ));
  };

  const startProcessing = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setLogs([]); 
    
    const BATCH_SIZE = 3;
    
    try {
        let pendingItems = queueRef.current.filter(i => i.status === 'pending');
        if (pendingItems.length === 0) {
            addLog("No pending files to process.");
        } else {
            addLog(`Starting batch processing for ${pendingItems.length} files...`);
        }
        
        while (pendingItems.length > 0) {
            const batch = pendingItems.slice(0, BATCH_SIZE);
            
            await Promise.all(batch.map(async (item) => {
                updateItemStatus(item.id, 'processing');
                try {
                    addLog(`Analyzing ${item.file.name}...`);
                    const data = await extractReceiptData(item.file);
                    addReceipt(data);
                    
                    // Trigger DB refresh in other components
                    setLastUpdated(Date.now());
                    
                    if (data.status === 'error') {
                        updateItemStatus(item.id, 'error', 'Extraction returned error');
                        addLog(`❌ Error processing ${item.file.name}`);
                    } else {
                        updateItemStatus(item.id, 'completed');
                        addLog(`✅ Successfully extracted ${item.file.name}`);
                    }
                } catch (e) {
                    updateItemStatus(item.id, 'error', (e as Error).message);
                    addLog(`❌ Critical failure: ${item.file.name}`);
                }
            }));
            
            // Re-evaluate pending items from the ref to continue the loop
            pendingItems = queueRef.current.filter(i => i.status === 'pending');
        }
    } catch (e) {
        console.error("Batch processing loop error", e);
        addLog("❌ Batch processing interrupted by system error.");
    } finally {
        setIsProcessing(false);
        addLog('Processing queue finished.');
    }
  }, [isProcessing]);

  const processedCount = queue.filter(i => i.status === 'completed' || i.status === 'error').length;

  return (
    <ProcessingContext.Provider value={{
      queue,
      isProcessing,
      logs,
      processedCount,
      lastUpdated,
      addFiles,
      removeFile,
      clearQueue,
      startProcessing
    }}>
      {children}
    </ProcessingContext.Provider>
  );
};

export const useProcessing = () => {
  const context = useContext(ProcessingContext);
  if (!context) throw new Error("useProcessing must be used within a ProcessingProvider");
  return context;
};