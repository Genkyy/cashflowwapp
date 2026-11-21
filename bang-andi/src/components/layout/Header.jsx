import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../lib/store.js';
import { useAuthStore } from '../../lib/authStore.js';
import { syncFromSupabase, onSyncStatusChange } from '../../lib/supabaseService.js';
import { useLiveQuery } from '../../hooks/useLiveQuery.js';
import { db } from '../../lib/db.js';
import {
  Plus,
  RefreshCw as ArrowClockwise,
  Cloud,
  CloudOff as CloudSlash,
  Settings as Gear,
  Bell,
  ChevronRight,
  AlertTriangle as Warning,
  Clock,
  X
} from 'lucide-react';

/**
 * FlowMint Translucent Header
 * 
 * Features:
 * - Dynamic Page Breadcrumb & Context on Desktop (reacts clearly to tab changes)
 * - Global Notification Bell with Live Alerts (Low stock, due transactions)
 * - Cloud Sync Status Capsule
 * - Quick Action CTA (Catat Transaksi)
 * - Glassmorphism: bg-white/85 backdrop-blur-xl border-b border-slate-200/60
 */
export default function Header() {
  const { setShowTransactionForm, setActiveTab, activeTab } = useAppStore();
  const { isConfigured } = useAuthStore();
  const [syncState, setSyncState] = useState({ syncing: false, lastSync: null, error: null });
  const [isRotating, setIsRotating] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);

  // Live alerts for notification bell
  const items = useLiveQuery(() => db.items.toArray(), [], []);
  const transactions = useLiveQuery(() => db.transactions.toArray(), [], []);

  const lowStockItems = useMemo(() => {
    return (items || []).filter((it) => Number(it.stock) <= (Number(it.min_stock) || 0));
  }, [items]);

  const dueTransactions = useMemo(() => {
    const nowTime = new Date().getTime();
    return (transactions || []).filter((tx) => {
      if (tx.status === 'void' || tx.payment_status === 'paid' || !tx.due_date) return false;
      const dueTime = new Date(tx.due_date).getTime();
      return dueTime <= nowTime + 3 * 24 * 3600 * 1000; // Overdue or due within 3 days
    });
  }, [transactions]);

  const totalAlerts = lowStockItems.length + dueTransactions.length;

  useEffect(() => {
    return onSyncStatusChange((status) => {
      setSyncState((prev) => ({ ...prev, ...status }));
    });
  }, []);

  const handleManualSync = async () => {
    setIsRotating(true);
    await syncFromSupabase();
    setTimeout(() => setIsRotating(false), 800);
  };

  const pageMeta = useMemo(() => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'Beranda',
          subtitle: 'Ikhtisar performa & analitik komoditas',
          badge: 'FlowMint'
        };
      case 'transactions':
        return {
          title: 'Transaksi',
          subtitle: 'Buku kas, mutasi & riwayat faktur',
          badge: 'Ledger'
        };
      case 'stock':
        return {
          title: 'Stok Komoditas',
          subtitle: 'Gudang, batch kedaluwarsa & HPP average',
          badge: 'Inventory'
        };
      case 'reports':
        return {
          title: 'Laporan Keuangan',
          subtitle: 'Laba rugi, arus kas & perputaran aset',
          badge: 'Insights'
        };
      case 'settings':
        return {
          title: 'Pengaturan',
          subtitle: 'Sinkronisasi cloud Supabase & setelan sistem',
          badge: 'Config'
        };
      default:
        return {
          title: 'CV Amanah Barokah',
          subtitle: 'Amanah Dalam Usaha, Barokah Untuk Semua',
          badge: 'Pro'
        };
    }
  }, [activeTab]);

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/60 transition-colors safe-area-top shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">

        {/* Brand Logo & Dynamic Page Breadcrumb */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Company Logo Emblem */}
          <div
            onClick={() => setActiveTab('dashboard')}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-xs select-none ios-spring-tap cursor-pointer hover:border-[#00D29E] transition"
            title="CV Amanah Barokah - Beranda"
          >
            <img src="/logo.png" alt="CV Amanah Barokah" className="w-full h-full object-contain" />
          </div>

          <div>
            {/* Desktop Dynamic Breadcrumb */}
            <div className="flex items-center gap-2">
              <span
                onClick={() => setActiveTab('dashboard')}
                className="font-extrabold text-base md:text-lg tracking-tight text-[#071A24] select-none cursor-pointer hover:text-[#00D29E] transition"
              >
                CV AMANAH BAROKAH
              </span>

              {/* Dynamic Separator & Tab Name on Desktop */}
              <div className="hidden sm:flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-slate-300 stroke-[2.5]" />
                <span className="font-bold text-sm text-[#071A24]">
                  {pageMeta.title}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-50 text-[#00D29E] border border-emerald-200/60">
                  {pageMeta.badge}
                </span>
              </div>
            </div>

            {/* Dynamic Subtitle */}
            <p className="text-[11px] text-slate-400 hidden sm:block font-medium">
              {pageMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Right Controls: Sync, Global Notification Bell, Primary CTA */}
        <div className="flex items-center gap-2 sm:gap-2.5">

          {/* Cloud Sync Status Capsule */}
          <button
            type="button"
            onClick={isConfigured ? handleManualSync : undefined}
            title={isConfigured ? 'Klik untuk sinkronisasi manual ke cloud' : 'Mode Offline (Lokal)'}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition select-none min-h-[38px] touch-target ios-spring-tap ${
              isConfigured
                ? 'bg-slate-100 hover:bg-slate-200/70 text-slate-700 border border-slate-200/60 cursor-pointer'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {syncState.syncing || isRotating ? (
              <ArrowClockwise className="w-3.5 h-3.5 animate-spin text-[#00D29E] shrink-0" />
            ) : isConfigured ? (
              <Cloud className="w-3.5 h-3.5 text-[#00D29E] shrink-0" />
            ) : (
              <CloudSlash className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )}

            <span className="hidden md:inline tabular-nums text-xs">
              {syncState.syncing || isRotating
                ? 'Menyinkronkan...'
                : isConfigured
                  ? 'Terhubung'
                  : 'Mode Offline'}
            </span>
          </button>

          {/* Global Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotificationMenu(!showNotificationMenu)}
              className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center text-slate-700 hover:text-[#00D29E] transition cursor-pointer relative"
              title="Notifikasi & Peringatan Sistem"
            >
              <Bell className="w-4.5 h-4.5" />
              {totalAlerts > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#00D29E] ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* Notification Popover */}
            {showNotificationMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl p-4 shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-[#00D29E]" />
                    <span className="text-xs font-bold text-slate-800">Pusat Peringatan & Info</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNotificationMenu(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2 text-xs max-h-72 overflow-y-auto">
                  {lowStockItems.length > 0 && (
                    <div
                      onClick={() => {
                        setActiveTab('stock');
                        setShowNotificationMenu(false);
                      }}
                      className="p-2.5 rounded-2xl bg-amber-50/80 text-amber-900 border border-amber-200/80 flex items-start gap-2.5 cursor-pointer hover:bg-amber-100/70 transition"
                    >
                      <Warning className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Stok Menipis ({lowStockItems.length} barang)</strong>
                        <span>
                          {lowStockItems.map((i) => i.name).slice(0, 2).join(', ')}
                          {lowStockItems.length > 2 ? '...' : ''} berada di bawah batas aman.
                        </span>
                      </div>
                    </div>
                  )}

                  {dueTransactions.length > 0 && (
                    <div
                      onClick={() => {
                        setActiveTab('transactions');
                        setShowNotificationMenu(false);
                      }}
                      className="p-2.5 rounded-2xl bg-emerald-50/80 text-emerald-900 border border-emerald-200/80 flex items-start gap-2.5 cursor-pointer hover:bg-emerald-100/70 transition"
                    >
                      <Clock className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Jatuh Tempo ({dueTransactions.length} tagihan)</strong>
                        <span>Ada transaksi yang mendekati atau melewati tenggat pembayaran.</span>
                      </div>
                    </div>
                  )}

                  {totalAlerts === 0 && (
                    <div className="py-6 text-center text-slate-400">
                      <p className="font-semibold text-xs text-slate-600">Semua aman & terkendali! 🎉</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Tidak ada stok kritis atau tagihan jatuh tempo.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Add Button - Desktop/Tablet (FlowMint Style) */}
          <button
            type="button"
            onClick={() => setShowTransactionForm(true)}
            className="hidden md:inline-flex items-center gap-2 bg-[#071A24] hover:bg-[#0B2533] active:scale-95 text-white px-3.5 py-2 rounded-2xl font-bold text-xs sm:text-sm shadow-xs transition ios-spring-tap min-h-[38px] cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#00D29E] stroke-[2.5]" />
            <span>Catat Transaksi</span>
          </button>

          {/* Settings Shortcut Button - Mobile */}
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-2xl text-slate-600 hover:text-[#071A24] hover:bg-slate-100 transition cursor-pointer"
            title="Buka Pengaturan"
          >
            <Gear className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
