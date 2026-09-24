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
import { FinanceTracker } from './components/finance/FinanceTracker';
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

// Authentication
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginModal } from './components/auth/LoginModal';

export const AppContent: React.FC = () => {
  const isRentMode = (import.meta as any).env?.VITE_APP_MODE === 'rent';
  const [activeTab, setActiveTab] = useState<NavTab>(isRentMode ? 'rent' : 'dashboard');
  // Default to 2026-09 (current month matching spec)
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [reportCategory, setReportCategory] = useState<ReportCategory>(isRentMode ? 'rent' : 'milk');
  const [isDbReady, setIsDbReady] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);

  const { isRecoveryMode, recoveryError } = useAuth();

  // Auto-open LoginModal when recovery mode or recovery error is detected from URL
  useEffect(() => {
    if (isRecoveryMode || recoveryError) {
      setIsLoginModalOpen(true);
    }
  }, [isRecoveryMode, recoveryError]);

  useEffect(() => {
    let disposed = false;
    let cleanupSync = () => {};

    // 1. Initialize local Dexie database
    initializeDefaultData().then(() => {
      if (disposed) return;
      setIsDbReady(true);
      // 2. Initialize Supabase cloud synchronization
      cleanupSync = initSyncService();
    });

    // 3. PWA install prompt handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      disposed = true;
      cleanupSync();
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
      <div className="min-h-screen bg-[#071724] text-[#F4F8FB] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#059669] to-[#18E6BE] text-[#06131F] font-black text-2xl flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(24,230,190,0.35)] animate-pulse">
            {isRentMode ? '🏠' : 'TT'}
          </div>
          <h2 className="font-extrabold text-lg text-[#F4F8FB]">
            {isRentMode ? 'Rent Tracking' : 'Tahir Tracker'}
          </h2>
          <p className="text-xs text-[#6F899B]">
            {isRentMode ? 'Loading rental portions & cloud sync...' : 'Loading offline database & cloud sync...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#071724] text-[#F4F8FB] flex flex-col antialiased selection:bg-[#18E6BE] selection:text-[#06131F] w-full max-w-full overflow-x-clip">
      {/* Top App Bar with Cloud Sync & PWA Install */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        onOpenAI={!isRentMode ? () => setIsAIAssistantOpen(true) : undefined}
        installPrompt={deferredInstallPrompt}
        onInstallPWA={handleInstallPWA}
        onOpenLogin={() => setIsLoginModalOpen(true)}
      />

      {/* Main Content Area */}
      <main 
        className="flex-1 max-w-[1680px] w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-5 pb-28"
        style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 6.5rem), 7rem)' }}
      >
        {/* Sub Navigation Switcher only for Full Household Tracker */}
        {!isRentMode && (
          <TrackerSubNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}

        {isRentMode ? (
          <>
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
                initialCategory="rent"
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView />
            )}
          </>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                selectedMonth={selectedMonth}
                setActiveTab={setActiveTab}
                onOpenReportWithCategory={openReportWithCategory}
              />
            )}

            {activeTab === 'finance' && (
              <FinanceTracker
                selectedMonth={selectedMonth}
                setSelectedMonth={setSelectedMonth}
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
          </>
        )}
      </main>

      {!isRentMode && (
        <>
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

          {/* Quick Add Bottom Sheet */}
          <QuickAddSheet
            isOpen={isQuickAddOpen}
            onClose={() => setIsQuickAddOpen(false)}
            onSelectAction={handleSelectQuickAction}
          />
        </>
      )}

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
      />

      {/* Supabase Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        isRentMode={isRentMode}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
