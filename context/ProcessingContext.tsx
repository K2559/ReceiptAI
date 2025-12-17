import React, { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { extractReceiptData, addDebugLog } from '../services/llmService';
import { addReceipt, initStorage } from '../services/storageService';
import { getSettings } from '../services/settingsService';

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

  // Initialize IndexedDB storage on mount
  useEffect(() => {
    initStorage().catch(console.error);
  }, []);

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
    
    // Get concurrency setting from user settings
    const settings = getSettings();
    const BATCH_SIZE = settings.concurrentApiCalls || 10;
    
    try {
        let pendingItems = queueRef.current.filter(i => i.status === 'pending');
        if (pendingItems.length === 0) {
            addLog("No pending files to process.");
        } else {
            addLog(`Starting batch processing for ${pendingItems.length} files (concurrency: ${BATCH_SIZE})...`);
        }
        
        while (pendingItems.length > 0) {
            const batch = pendingItems.slice(0, BATCH_SIZE);
            
            await Promise.all(batch.map(async (item) => {
                updateItemStatus(item.id, 'processing');
                try {
                    addLog(`📤 Analyzing ${item.file.name}...`);
                    addDebugLog('info', `[ProcessingContext] Starting processing for ${item.file.name}`);
                    
                    const data = await extractReceiptData(item.file);
                    
                    // Debug: Log what we got back
                    console.log(`[DEBUG] Extracted data for ${item.file.name}:`, data);
                    addDebugLog('info', `[ProcessingContext] Received data from extraction`, {
                        fileName: item.file.name,
                        hasId: !!data.id,
                        hasStatus: !!data.status,
                        hasCreatedAt: !!data.createdAt,
                        status: data.status,
                        dataKeys: Object.keys(data)
                    });
                    
                    // Validate required fields
                    const hasRequiredFields = data.id && data.status && data.createdAt;
                    if (!hasRequiredFields) {
                        const missing = [];
                        if (!data.id) missing.push('id');
                        if (!data.status) missing.push('status');
                        if (!data.createdAt) missing.push('createdAt');
                        
                        addDebugLog('error', `[ProcessingContext] Validation failed: Missing required fields`, {
                            fileName: item.file.name,
                            missing,
                            receivedData: data
                        });
                        updateItemStatus(item.id, 'error', `Missing required fields: ${missing.join(', ')}`);
                        addLog(`❌ Validation failed for ${item.file.name}: Missing ${missing.join(', ')}`);
                        return;
                    }
                    
                    // Check if extraction actually failed
                    if (data.status === 'error') {
                        addDebugLog('error', `[ProcessingContext] Data status is error`, {
                            fileName: item.file.name,
                            error: data.error
                        });
                        updateItemStatus(item.id, 'error', data.error || 'Extraction returned error status');
                        addLog(`❌ Extraction error: ${item.file.name} - ${data.error || 'Unknown error'}`);
                    } else {
                        // Save to database
                        addDebugLog('info', `[ProcessingContext] Saving to database`, {
                            fileName: item.file.name,
                            receiptId: data.id
                        });
                        
                        try {
                            await addReceipt(data);
                            addDebugLog('success', `[ProcessingContext] Successfully saved to database`, {
                                fileName: item.file.name,
                                receiptId: data.id
                            });
                        } catch (dbError) {
                            addDebugLog('error', `[ProcessingContext] Database save failed`, {
                                fileName: item.file.name,
                                error: (dbError as Error).message
                            });
                            throw dbError;
                        }
                        
                        // Trigger DB refresh in other components
                        setLastUpdated(Date.now());
                        
                        updateItemStatus(item.id, 'completed');
                        addLog(`✅ Successfully processed ${item.file.name}`);
                        addDebugLog('success', `[ProcessingContext] ✅ Processing completed for ${item.file.name}`);
                    }
                } catch (e) {
                    const errorMsg = (e as Error).message;
                    const errorStack = (e as Error).stack;
                    console.error(`[ERROR] Processing ${item.file.name}:`, e);
                    addDebugLog('error', `[ProcessingContext] Critical failure during processing`, {
                        fileName: item.file.name,
                        error: errorMsg,
                        stack: errorStack
                    });
                    updateItemStatus(item.id, 'error', errorMsg);
                    addLog(`❌ Critical failure: ${item.file.name} - ${errorMsg}`);
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