import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, resetSettings } from '../services/settingsService';
import { AppSettings, LLMProvider } from '../types';
import { Save, RotateCcw, CheckCircle } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [saved, setSaved] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleChange = (field: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    if (field === 'outputSchema') {
        try {
            JSON.parse(value);
            setJsonError(null);
        } catch (e) {
            setJsonError("Invalid JSON format");
        }
    }
  };

  const handleSave = () => {
    if (jsonError) return;
    saveSettings(settings);
    setSaved(true);
  };

  const handleReset = () => {
    if (confirm("Reset all settings to default? This will lose your custom schema and API keys.")) {
        setSettings(resetSettings());
        setJsonError(null);
        setSaved(true);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-600">Configure LLM provider, model, and database structure.</p>
        </div>
        <div className="flex items-center gap-3">
            <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
                <RotateCcw size={18} />
                Reset Defaults
            </button>
            <button 
                onClick={handleSave}
                disabled={!!jsonError}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-all ${
                    saved ? 'bg-green-600' : 'bg-brand-600 hover:bg-brand-700'
                } ${jsonError ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {saved ? <CheckCircle size={18} /> : <Save size={18} />}
                {saved ? 'Saved!' : 'Save Settings'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - Provider & Model */}
        <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">LLM Provider</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
                        <select 
                            value={settings.provider}
                            onChange={(e) => handleChange('provider', e.target.value as LLMProvider)}
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-slate-50"
                        >
                            <option value="gemini">Google Gemini</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="local">Local (Ollama/LM Studio)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Model Name</label>
                        <input 
                            type="text"
                            value={settings.model}
                            onChange={(e) => handleChange('model', e.target.value)}
                            placeholder="e.g. gemini-2.5-flash"
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            {settings.provider === 'gemini' && 'Recommended: gemini-2.5-flash or gemini-3-pro-preview'}
                            {settings.provider === 'local' && 'e.g. llama3, mistral'}
                        </p>
                    </div>

                    {settings.provider !== 'gemini' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Base URL</label>
                            <input 
                                type="text"
                                value={settings.baseUrl}
                                onChange={(e) => handleChange('baseUrl', e.target.value)}
                                placeholder={settings.provider === 'local' ? 'http://localhost:11434/v1' : 'https://openrouter.ai/api/v1'}
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            API Key 
                            {settings.provider === 'gemini' && <span className="text-slate-400 font-normal ml-1">(Optional if using env)</span>}
                        </label>
                        <input 
                            type="password"
                            value={settings.apiKey}
                            onChange={(e) => handleChange('apiKey', e.target.value)}
                            placeholder="sk-..."
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">System Prompt</h2>
                <textarea 
                    value={settings.systemPrompt}
                    onChange={(e) => handleChange('systemPrompt', e.target.value)}
                    className="w-full h-64 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm leading-relaxed"
                />
            </div>
        </div>

        {/* Right Column - Database Structure (JSON Schema) */}
        <div className="md:col-span-2">
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">Database Structure (JSON Schema)</h2>
                    {jsonError && <span className="text-red-500 text-sm font-medium">{jsonError}</span>}
                </div>
                <p className="text-slate-500 text-sm mb-4">
                    Define the fields you want to extract. This schema defines the columns in your database.
                    Use standard JSON Schema format.
                </p>
                <div className="flex-1 relative">
                    <textarea 
                        value={settings.outputSchema}
                        onChange={(e) => handleChange('outputSchema', e.target.value)}
                        className={`w-full h-full min-h-[500px] p-4 font-mono text-sm bg-slate-50 border rounded-lg focus:ring-2 outline-none resize-y ${
                            jsonError ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:ring-brand-500'
                        }`}
                        spellCheck={false}
                    />
                </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
