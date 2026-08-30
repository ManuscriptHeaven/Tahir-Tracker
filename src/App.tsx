import React, { useState, useEffect } from 'react';
import { NavTab } from './types';
import { initializeDefaultData } from './db/db';
import { initSyncService } from './services/syncService';

// Layout
import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';
import { TrackerSubNav } from './components/layout/TrackerSubNav';
import { QuickAddSheet } from './components/layout/QuickAddSheet';

// Views
import { Dashboard } from './components/dashboard/Dashboard';
import { UtilityTracker } from './components/utility/UtilityTracker';
import { LoanTracker } from './components/loan/LoanTracker';
import { MilkTracker } from './components/milk/MilkTracker';
import { PetrolTracker } from './components/petrol/PetrolTracker';
import { RentTracker } from './components/rent/RentTracker';
import { ReportsView, ReportCategory } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';

// AI Assistant
import { AIAssistantModal } from './components/ai/AIAssistantModal';
import { AIFloatingButton } from './components/ai/AIFloatingButton';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  // Default to 2026-08 (as specified in user prompt, or current month)
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');
  const [reportCategory, setReportCategory] = useState<ReportCategory>('milk');
  const [isDbReady, setIsDbReady] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Initialize local Dexie database
    initializeDefaultData().then(() => {
      setIsDbReady(true);
      // 2. Initialize Supabase cloud synchronization
      initSyncService();
    });

    // 3. PWA install prompt handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted PWA installation');
      }
      setDeferredInstallPrompt(null);
    }
  };

  const openReportWithCategory = (category: ReportCategory) => {
    setReportCategory(category);
    setActiveTab('reports');
  };

  const handleSelectQuickAction = (action: NavTab | 'mark_today_milk' | 'manage_persons' | 'ai_assistant') => {
    if (action === 'ai_assistant') {
      setIsAIAssistantOpen(true);
    } else if (action === 'manage_persons') {
      setActiveTab('utility');
    } else if (action === 'mark_today_milk') {
      setActiveTab('milk');
    } else {
      setActiveTab(action);
    }
  };

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white font-black text-xl flex items-center justify-center mx-auto animate-bounce shadow-lg shadow-emerald-500/30">
            TT
          </div>
          <h2 className="font-bold text-lg text-slate-100">Personal Finance & Household Tracker</h2>
          <p className="text-xs text-slate-400">Loading offline local database & cloud sync...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased">
      {/* Top App Bar with Cloud Sync & PWA Install */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        onOpenAI={() => setIsAIAssistantOpen(true)}
        installPrompt={deferredInstallPrompt}
        onInstallPWA={handleInstallPWA}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24">
        {/* Sub Navigation Switcher for Household Trackers */}
        <TrackerSubNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {activeTab === 'dashboard' && (
          <Dashboard
            selectedMonth={selectedMonth}
            setActiveTab={setActiveTab}
            onOpenReportWithCategory={openReportWithCategory}
          />
        )}

        {activeTab === 'utility' && (
          <UtilityTracker
            onOpenReport={() => openReportWithCategory('utility')}
          />
        )}

        {activeTab === 'loans' && (
          <LoanTracker
            onOpenReport={() => openReportWithCategory('loans')}
          />
        )}

        {activeTab === 'milk' && (
          <MilkTracker
            selectedMonth={selectedMonth}
            onOpenReport={() => openReportWithCategory('milk')}
          />
        )}

        {activeTab === 'petrol' && (
          <PetrolTracker
            selectedMonth={selectedMonth}
            onOpenReport={() => openReportWithCategory('petrol')}
          />
        )}

        {activeTab === 'rent' && (
          <RentTracker
            selectedMonth={selectedMonth}
            onOpenReport={() => openReportWithCategory('rent')}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            initialCategory={reportCategory}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView />
        )}
      </main>

      {/* Floating AI Voice Assistant Button */}
      <AIFloatingButton
        onClick={() => setIsAIAssistantOpen(true)}
      />

      {/* AI Voice & Text Assistant Modal */}
      <AIAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      {/* Mobile Bottom Navigation (4-Tab Standard + Center Quick Add) */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
      />

      {/* Quick Add Bottom Sheet */}
      <QuickAddSheet
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onSelectAction={handleSelectQuickAction}
      />
    </div>
  );
};

export default App;
