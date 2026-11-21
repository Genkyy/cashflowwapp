import { useEffect } from 'react';
import { useAppStore } from './lib/store.js';
import { useAuthStore } from './lib/authStore.js';
import { seedDatabase } from './lib/seed.js';
import { setupRealtimeSync } from './lib/supabaseService.js';
import LoginPage from './components/auth/LoginPage.jsx';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import BottomNav from './components/layout/BottomNav.jsx';
import DashboardView from './components/dashboard/DashboardView.jsx';
import TransactionsView from './components/transactions/TransactionsView.jsx';
import StockView from './components/stock/StockView.jsx';
import ReportsView from './components/reports/ReportsView.jsx';
import SettingsView from './components/settings/SettingsView.jsx';
import { Toast } from './components/ui/Toast.jsx';

/**
 * Main Application Shell (Apple HIG Style)
 * 
 * Palette:
 * - 60% Dominan: #F2F2F7 (iOS Grouped Background)
 * - 30% Sekunder: #064E3B (iPad Sidebar & Structure)
 * - 10% Aksen: #D97706 (Warm Amber Gold on CTA & active states)
 */
export default function App() {
  const { activeTab } = useAppStore();
  const { user, isGuest, loading, initializeAuth } = useAuthStore();

  useEffect(() => {
    // 1. Initialize Supabase Auth
    initializeAuth();

    // 2. Ensure initial seed data exists locally
    seedDatabase().catch((e) => console.warn('Seed database warning:', e));

    // 3. Setup Supabase Realtime synchronization across iPad and HP
    const cleanupRealtime = setupRealtimeSync();

    return () => {
      if (typeof cleanupRealtime === 'function') {
        cleanupRealtime();
      }
    };
  }, [initializeAuth]);

  // Loading Screen (Apple Clean Aesthetic)
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center p-2 mb-4 shadow-xl border border-slate-200/80 animate-pulse">
          <img src="/logo.png" alt="CV Amanah Barokah" className="w-full h-full object-contain" />
        </div>
        <div className="text-xl font-extrabold tracking-tight text-[#071A24]">CV AMANAH BAROKAH</div>
        <p className="text-xs text-[#00D29E] mt-1 font-bold">Amanah Dalam Usaha, Barokah Untuk Semua</p>
      </div>
    );
  }

  // Auth Guard: Show Login if not authenticated and not continuing as guest
  if (!user && !isGuest) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F2F7] text-[#0F172A] selection:bg-[#D97706]/20 selection:text-[#064E3B]">
      {/* Translucent Glass Header (Apple HIG) */}
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

      {/* Apple Dynamic Island Style Floating Alert */}
      <Toast />
    </div>
  );
}
