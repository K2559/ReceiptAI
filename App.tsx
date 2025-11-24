import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import UploadPage from './pages/Upload';
import DatabasePage from './pages/Database';
import SettingsPage from './pages/Settings';
import { ProcessingProvider } from './context/ProcessingContext';

const App: React.FC = () => {
  return (
    <ProcessingProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<UploadPage />} />
              <Route path="/database" element={<DatabasePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          
          <footer className="bg-white border-t border-gray-200 py-6 text-center text-slate-500 text-sm">
             <p>© {new Date().getFullYear()} ReceiptAI. Powered by LLMs.</p>
          </footer>
        </div>
      </Router>
    </ProcessingProvider>
  );
};

export default App;