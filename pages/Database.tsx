import React, { useEffect, useState, useMemo } from 'react';
import { getReceipts, updateReceipt, deleteReceipt, clearDatabase, exportDatabaseJSON, importDatabaseJSON } from '../services/storageService';
import { getSettings } from '../services/settingsService';
import { exportToExcel } from '../utils/excelUtils';
import { generatePDFReport } from '../utils/pdfUtils';
import { ReceiptData, ReceiptStatus } from '../types';
import { Download, Trash2, Eye, Search, Check, X, ZoomIn, ZoomOut, RotateCcw, Save, ChevronUp, ChevronDown, ChevronsUpDown, Filter, FileText, Upload as UploadIcon, Database as DatabaseIcon } from 'lucide-react';
import { useProcessing } from '../context/ProcessingContext';

// --- Helper Components ---

const StatusBadge = ({ status }: { status: ReceiptStatus }) => {
  const styles = {
    processing: 'bg-blue-100 text-blue-800',
    draft: 'bg-gray-100 text-gray-800 border border-gray-200',
    approved: 'bg-green-100 text-green-800 border border-green-200',
    rejected: 'bg-red-100 text-red-800 border border-red-200',
    error: 'bg-red-50 text-red-600',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
};

const formatDateTime = (timestamp: number) => {
  // Format: dd MMM yyyy HH:mm (e.g., 25 Feb 2024 14:30)
  return new Date(timestamp).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
  });
};

const formatDateOnly = (dateString: any) => {
  // Format: dd MMM yyyy (e.g., 25 Feb 2024)
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    return date.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return String(dateString);
  }
};

const SortIcon = ({ active, direction }: { active: boolean, direction?: 'asc' | 'desc' }) => {
    if (!active) return <ChevronsUpDown size={14} className="text-slate-300" />;
    return direction === 'asc' 
        ? <ChevronUp size={14} className="text-brand-600" /> 
        : <ChevronDown size={14} className="text-brand-600" />;
};

// --- Main Page Component ---

const DatabasePage: React.FC = () => {
  const [data, setData] = useState<ReceiptData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [columns, setColumns] = useState<{key: string, title: string}[]>([]);
  
  // Sorting and Filtering State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | 'all'>('all');
  
  // Multi-select State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExiting, setIsExiting] = useState(false);
  
  // Connect to global context to detect updates
  const { lastUpdated } = useProcessing();
  
  // Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  // Reload data whenever lastUpdated changes (background processing finished an item)
  useEffect(() => {
    loadData();
  }, [lastUpdated]);

  useEffect(() => {
    loadColumns();
  }, []);

  const loadData = () => {
    setData(getReceipts());
  };

  const loadColumns = () => {
    try {
        const settings = getSettings();
        const schema = JSON.parse(settings.outputSchema);
        const cols: {key: string, title: string}[] = [];
        
        if (schema.properties) {
            Object.keys(schema.properties).forEach(key => {
                const prop = schema.properties[key];
                if (prop.type !== 'array' && prop.type !== 'object') {
                    cols.push({
                        key: key,
                        title: prop.title || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
                    });
                }
            });
        }
        setColumns(cols);
    } catch (e) {
        setColumns([
            { key: 'transactionDate', title: 'Date' },
            { key: 'merchantName', title: 'Merchant' },
            { key: 'totalAmount', title: 'Amount' },
        ]);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this receipt?')) {
      const updated = deleteReceipt(id);
      setData(updated);
      if (selectedReceipt?.id === id) setSelectedReceipt(null);
    }
  };

  const handleUpdate = (id: string, updates: Partial<ReceiptData>) => {
    const updated = updateReceipt(id, updates);
    setData(updated);
    // If updating the currently open receipt, update local state too
    if (selectedReceipt && selectedReceipt.id === id) {
        setSelectedReceipt({ ...selectedReceipt, ...updates });
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Multi-select handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedData.map(r => r.id)));
    }
  };

  const handleGeneratePDF = () => {
    const selectedReceipts = data.filter(r => selectedIds.has(r.id));
    if (selectedReceipts.length === 0) {
      alert('Please select at least one receipt to generate PDF');
      return;
    }
    generatePDFReport(selectedReceipts, {
      title: 'Receipt Report',
      includeLineItems: true
    });
  };

  const handleExportSelected = () => {
    const selectedReceipts = data.filter(r => selectedIds.has(r.id));
    if (selectedReceipts.length === 0) {
      alert('Please select at least one receipt to export');
      return;
    }
    exportToExcel(selectedReceipts);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const imported = await importDatabaseJSON(file);
      setData(imported);
      alert(`Successfully imported ${imported.length} receipts (duplicates were skipped)`);
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    // Reset input so the same file can be imported again
    e.target.value = '';
  };

  // Process Data: Filter -> Sort
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Status Filter
    if (statusFilter !== 'all') {
        result = result.filter(r => r.status === statusFilter);
    }

    // 2. Search Term
    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        result = result.filter(item => 
            Object.values(item).some(val => 
                String(val).toLowerCase().includes(lowerTerm)
            )
        );
    }

    // 3. Sorting
    if (sortConfig) {
        result.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];

            // Handle undefined/null gracefully
            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    } else {
        // Default Sort: Created At Descending
        result.sort((a, b) => b.createdAt - a.createdAt);
    }

    return result;
  }, [data, searchTerm, statusFilter, sortConfig]);


  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Receipt Database</h1>
          <p className="text-slate-600 mt-1">Review and approve extracted receipts.</p>
        </div>
        <div className="flex items-center gap-3">
            {(selectedIds.size > 0 || isExiting) && (
              <>
                <button
                  onClick={() => {
                    setIsExiting(true);
                    setTimeout(() => {
                      setSelectedIds(new Set());
                      setIsExiting(false);
                    }, 200);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-all text-slate-700 bg-white border-slate-300 hover:bg-slate-50 whitespace-nowrap shadow-sm ${
                    isExiting ? 'animate-[fadeOut_0.2s_ease-in]' : 'animate-[fadeIn_0.3s_ease-out]'
                  }`}
                >
                  Clear ({selectedIds.size})
                </button>
                <button
                  onClick={handleGeneratePDF}
                  className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-all whitespace-nowrap ${
                    isExiting ? 'animate-[fadeOut_0.2s_ease-in]' : 'animate-[fadeIn_0.3s_ease-out]'
                  }`}
                  disabled={isExiting}
                >
                  <FileText size={18} />
                  Generate PDF
                </button>
                <button
                  onClick={handleExportSelected}
                  className={`flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm font-medium transition-all whitespace-nowrap ${
                    isExiting ? 'animate-[fadeOut_0.2s_ease-in]' : 'animate-[fadeIn_0.3s_ease-out]'
                  }`}
                  disabled={isExiting}
                >
                  <Download size={18} />
                  Export Excel
                </button>
              </>
            )}
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition-all cursor-pointer whitespace-nowrap">
              <UploadIcon size={18} />
              Import JSON
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
            <button
              onClick={exportDatabaseJSON}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm font-medium transition-all whitespace-nowrap"
              title="Export database with images as JSON"
            >
              <DatabaseIcon size={18} />
              Export JSON
            </button>
            <button
              onClick={() => {
                  if(confirm("Clear all data?")) {
                      clearDatabase();
                      setData([]);
                  }
              }}
              className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 font-medium transition-all whitespace-nowrap shadow-sm"
            >
              Clear DB
            </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search by merchant, amount, or date..." 
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-shadow"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="relative min-w-[200px]">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full pl-10 pr-8 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none bg-white appearance-none cursor-pointer"
                >
                    <option value="all">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="error">Error</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4 w-12">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === processedData.length && processedData.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                  />
                </th>
                <th 
                    className="p-4 w-24 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort('status')}
                >
                    <div className="flex items-center gap-1">
                        Status
                        <SortIcon active={sortConfig?.key === 'status'} direction={sortConfig?.direction} />
                    </div>
                </th>
                <th 
                    className="p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                    onClick={() => handleSort('createdAt')}
                >
                    <div className="flex items-center gap-1">
                        Created At
                        <SortIcon active={sortConfig?.key === 'createdAt'} direction={sortConfig?.direction} />
                    </div>
                </th>
                {columns.map(col => (
                    <th 
                        key={col.key} 
                        className="p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                        onClick={() => handleSort(col.key)}
                    >
                        <div className="flex items-center gap-1">
                            {col.title}
                            <SortIcon active={sortConfig?.key === col.key} direction={sortConfig?.direction} />
                        </div>
                    </th>
                ))}
                <th className="p-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedData.length === 0 ? (
                <tr>
                    <td colSpan={columns.length + 4} className="p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-2">
                            <Search size={32} className="text-slate-300" />
                            <p>No receipts found matching your filters.</p>
                        </div>
                    </td>
                </tr>
              ) : (
                processedData.map((receipt) => (
                  <tr 
                    key={receipt.id} 
                    className={`hover:bg-brand-50 transition-colors cursor-pointer group ${
                      selectedIds.has(receipt.id) ? 'bg-brand-100' : ''
                    }`}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(receipt.id)}
                        onChange={() => toggleSelection(receipt.id)}
                        className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-4" onClick={() => setSelectedReceipt(receipt)}>
                      <StatusBadge status={receipt.status} />
                    </td>
                    <td className="p-4 text-sm text-slate-500 whitespace-nowrap font-mono" onClick={() => setSelectedReceipt(receipt)}>
                        {formatDateTime(receipt.createdAt)}
                    </td>
                    {columns.map(col => (
                        <td key={col.key} className="p-4 text-sm text-slate-700" onClick={() => setSelectedReceipt(receipt)}>
                            <span className="block truncate max-w-[200px]">
                                {/* Apply custom formatting to date columns */}
                                {(col.key.toLowerCase().includes('date') || col.key === 'transactionDate') 
                                    ? formatDateOnly(receipt[col.key]) 
                                    : (receipt[col.key] !== undefined ? String(receipt[col.key]) : '-')
                                }
                            </span>
                        </td>
                    ))}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setSelectedReceipt(receipt)} className="text-brand-600 hover:text-brand-700 p-1" title="Review">
                              <Eye size={18} />
                          </button>
                          <button onClick={(e) => handleDelete(receipt.id, e)} className="text-red-400 hover:text-red-600 p-1" title="Delete">
                              <Trash2 size={18} />
                          </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50 p-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
            <span>Showing {processedData.length} of {data.length} receipts</span>
        </div>
      </div>

      {/* Review Modal */}
      {selectedReceipt && (
        <ReviewModal 
            receipt={selectedReceipt} 
            onClose={() => setSelectedReceipt(null)} 
            onSave={(id, data) => handleUpdate(id, data)}
        />
      )}
    </div>
  );
};

// --- Review Modal Component ---

const ReviewModal: React.FC<{
    receipt: ReceiptData; 
    onClose: () => void;
    onSave: (id: string, updates: Partial<ReceiptData>) => void;
}> = ({ receipt, onClose, onSave }) => {
    const [formData, setFormData] = useState<ReceiptData>({ ...receipt });
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    
    // Schema for rendering inputs
    const [schemaProperties, setSchemaProperties] = useState<Record<string, any>>({});

    useEffect(() => {
        const settings = getSettings();
        try {
            const schema = JSON.parse(settings.outputSchema);
            setSchemaProperties(schema.properties || {});
        } catch(e) { console.error(e); }
    }, []);

    // --- Image Viewer Logic ---
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setScale(s => Math.min(Math.max(0.5, s * delta), 5));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    // --- Form Logic ---
    const handleInputChange = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleJsonChange = (key: string, jsonString: string) => {
        try {
            const val = JSON.parse(jsonString);
            setFormData(prev => ({ ...prev, [key]: val }));
        } catch (e) {
            // Squelch parsing errors during typing
        }
    };

    const saveAndClose = (status?: ReceiptStatus) => {
        const updates = { ...formData };
        if (status) updates.status = status;
        onSave(receipt.id, updates);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-800">Review Receipt</h2>
                        <StatusBadge status={formData.status} />
                        <span className="text-slate-400 text-sm font-mono">{receipt.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Body - Split View */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* Left: Image Viewer */}
                    <div className="w-1/2 bg-slate-100 relative overflow-hidden border-r border-slate-200 flex flex-col">
                        <div 
                            className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-center"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onWheel={handleWheel}
                        >
                            {receipt.rawImage ? (
                                <img 
                                    src={receipt.rawImage} 
                                    alt="Receipt" 
                                    className="max-w-none transition-transform duration-75 ease-out select-none shadow-lg"
                                    style={{ 
                                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                        maxHeight: '80%',
                                        maxWidth: '80%'
                                    }}
                                    draggable={false}
                                />
                            ) : (
                                <div className="text-slate-400 flex flex-col items-center">
                                    <X size={48} />
                                    <span className="mt-2">No Image Available</span>
                                </div>
                            )}
                        </div>
                        
                        {/* Zoom Toolbar */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-md rounded-full px-4 py-2 flex items-center gap-4 z-10 border border-slate-200">
                            <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1 hover:text-brand-600"><ZoomOut size={20} /></button>
                            <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                            <button onClick={() => setScale(s => Math.min(5, s + 0.2))} className="p-1 hover:text-brand-600"><ZoomIn size={20} /></button>
                            <div className="w-px h-4 bg-slate-300 mx-1"></div>
                            <button onClick={() => { setScale(1); setPosition({x:0, y:0}); }} className="p-1 hover:text-brand-600" title="Reset View"><RotateCcw size={18} /></button>
                        </div>
                    </div>

                    {/* Right: Edit Form */}
                    <div className="w-1/2 overflow-y-auto bg-white p-6 md:p-8">
                        <div className="space-y-6">
                            {/* Render inputs based on schema keys, fallback to formData keys */}
                            {Object.keys(schemaProperties).length > 0 ? (
                                Object.keys(schemaProperties).map(key => {
                                    const prop = schemaProperties[key];
                                    const isComplex = prop.type === 'array' || prop.type === 'object';
                                    const value = formData[key];

                                    return (
                                        <div key={key}>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1.5 capitalize">
                                                {prop.title || key.replace(/([A-Z])/g, ' $1')}
                                            </label>
                                            
                                            {isComplex ? (
                                                <div className="space-y-1">
                                                     <textarea 
                                                        className="w-full h-48 p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                                        defaultValue={JSON.stringify(value, null, 2)}
                                                        onChange={(e) => handleJsonChange(key, e.target.value)}
                                                     />
                                                     <p className="text-xs text-slate-400">Edit strict JSON for complex fields.</p>
                                                </div>
                                            ) : (
                                                <input 
                                                    type={prop.type === 'number' || prop.type === 'integer' ? 'number' : 'text'}
                                                    className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none transition-shadow"
                                                    value={value || ''}
                                                    onChange={(e) => handleInputChange(key, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                // Fallback if no schema (shouldn't happen often)
                                Object.keys(formData).filter(k => !['id', 'createdAt', 'status', 'rawImage'].includes(k)).map(key => (
                                    <div key={key}>
                                        <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">{key}</label>
                                        <input 
                                            className="w-full p-2 border rounded"
                                            value={typeof formData[key] === 'object' ? JSON.stringify(formData[key]) : formData[key]}
                                            onChange={(e) => handleInputChange(key, e.target.value)}
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer - Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button 
                        onClick={() => saveAndClose('rejected')}
                        className="px-4 py-2.5 text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Trash2 size={18} />
                        Reject
                    </button>
                    <button 
                        onClick={() => saveAndClose('draft')}
                        className="px-4 py-2.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Save size={18} />
                        Save Draft
                    </button>
                    <button 
                        onClick={() => saveAndClose('approved')}
                        className="px-6 py-2.5 text-white bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-md shadow-brand-500/20"
                    >
                        <Check size={18} />
                        Approve & Finish
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DatabasePage;