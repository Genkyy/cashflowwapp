import { useState, useEffect, useRef } from 'react';
import { useAppStore } from './lib/store.js';
import { useAuthStore } from './lib/authStore.js';
import { seedDatabase, syncStandardCatalog } from './lib/seed.js';
import { setupRealtimeSync } from './lib/supabaseService.js';
import SplashScreen from './components/layout/SplashScreen.jsx';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import BottomNav from './components/layout/BottomNav.jsx';
import DashboardView from './components/dashboard/DashboardView.jsx';
import TransactionsView from './components/transactions/TransactionsView.jsx';
import StockView from './components/stock/StockView.jsx';
import ReportsView from './components/reports/ReportsView.jsx';
import SettingsView from './components/settings/SettingsView.jsx';
import { Toast } from './components/ui/Toast.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import OfflineBanner from './components/ui/OfflineBanner.jsx';
import AuthModal from './components/auth/AuthModal.jsx';

/**
 * Main Application Shell (CV Amanah Barokah Mobile & iPad System)
 * 
 * Features:
 * - Bank-grade Mobile Animated Splash & Loading Screen
 * - Zero Login / Signup Wall on startup (Instant Direct Access)
 * - Seamless FlowMint Midnight & Emerald palette
 */
export default function App() {
  const { activeTab } = useAppStore();
  const { initializeAuth, isAuthModalOpen, setAuthModalOpen } = useAuthStore();
  const [isSplashDone, setIsSplashDone] = useState(false);
  const hasSeededRef = useRef(false);

  useEffect(() => {
    // 1. Initialize Supabase Auth in background
    initializeAuth();

    // 2. Ensure initial seed data exists locally & standard catalog is synchronized
    if (!hasSeededRef.current) {
      hasSeededRef.current = true;
      seedDatabase()
        .then(() => syncStandardCatalog())
        .catch((e) => console.warn('Seed database warning:', e));
    }

    // 3. Setup Supabase Realtime synchronization across iPad and HP
    const cleanupRealtime = setupRealtimeSync();

    return () => {
      if (typeof cleanupRealtime === 'function') {
        cleanupRealtime();
      }
    };
  }, [initializeAuth]);

  // Mobile Banking Animated Splash Screen
  if (!isSplashDone) {
    return <SplashScreen onComplete={() => setIsSplashDone(true)} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-[#F2F2F7] text-[#0F172A] selection:bg-[#00D29E]/20 selection:text-[#071A24] animate-in fade-in duration-300">
        {/* Offline Connection Status Banner */}
        <OfflineBanner />

        {/* Translucent Glass Header (Apple HIG / FlowMint) */}
        <Header />

        {/* Main Layout: iPadOS Sidebar + Content Area */}
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <Sidebar />

          <main className="flex-1 px-4 py-5 md:p-6 lg:p-8 min-w-0 pb-28 md:pb-12">
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'transactions' && <TransactionsView />}
            {activeTab === 'stock' && <StockView />}
            {activeTab === 'reports' && <ReportsView />}
            {activeTab === 'settings' && <SettingsView />}
          </main>
        </div>

        {/* Translucent Bottom Navigation for Mobile (iOS HIG) */}
        <BottomNav />

        {/* Dynamic Alert Toast */}
        <Toast />

        {/* Bank-Grade Auth & Session Modal */}
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    </ErrorBoundary>
  );
}
