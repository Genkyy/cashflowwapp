import { useState, useRef } from 'react';
import { useLiveQuery } from '../../hooks/useLiveQuery.js';
import { db } from '../../lib/db.js';
import { useAuthStore } from '../../lib/authStore.js';
import { useAppStore } from '../../lib/store.js';
import { syncFromSupabase, resetSupabaseDatabase, updateSupabaseAccount } from '../../lib/supabaseService.js';
import { formatCurrency } from '../../lib/formatters.js';
import { exportToJSON } from '../../lib/exporters.js';
import { resetDatabaseToReal } from '../../lib/seed.js';
import { translateErrorMessage } from '../../lib/errorHandler.js';
import BottomSheet from '../ui/BottomSheet.jsx';
import Button from '../ui/Button.jsx';
import LoadMoreButton from '../ui/LoadMoreButton.jsx';
import usePagination from '../../hooks/usePagination.js';
import {
  Cloud,
  Wallet,
  Download,
  Upload,
  RefreshCw,
  Plus,
  ChevronRight,
  CheckSquare,
  Square,
  Edit2,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Check,
  ShieldCheck
} from 'lucide-react';

/**
 * Apple HIG Settings View (iPhone Settings Inset Grouped Style)
 * 
 * Scaled & Optimized:
 * 1. Single Primary Cash Account with full editability (name, type, account number, balance)
 * 2. Purged Contacts (Pelanggan & Supplier) - no debt/receivables workflow
 * 3. Database Reset to Real Testing Mode (purges all dummy records)
 * 4. Operational Notes (F5.4) & Cloud Sync
 */
export default function SettingsView() {
  const { isConfigured, user, setAuthModalOpen } = useAuthStore();
  const { addNotification } = useAppStore();
  const accounts = useLiveQuery(() => db.accounts.toArray(), [], []);
  const operationalNotes = useLiveQuery(() => db.operational_notes.toArray(), [], []);

  const primaryAccount = accounts?.[0] || null;

  const [activeSection, setActiveSection] = useState('overview'); // overview | cloud | accounts | notes | reset_confirm
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  // Edit Single Account State
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editAccName, setEditAccName] = useState('');
  const [editAccType, setEditAccType] = useState('cash');
  const [editAccNumber, setEditAccNumber] = useState('');
  const [editAccBalance, setEditAccBalance] = useState('');

  const handleOpenEditAccount = () => {
    if (primaryAccount) {
      setEditAccName(primaryAccount.name || 'Kas Utama');
      setEditAccType(primaryAccount.type || 'cash');
      setEditAccNumber(primaryAccount.account_number || '');
      setEditAccBalance(String(primaryAccount.balance ?? 0));
    } else {
      setEditAccName('Kas Utama');
      setEditAccType('cash');
      setEditAccNumber('');
      setEditAccBalance('0');
    }
    setShowEditAccountModal(true);
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (isSavingAccount) return;
    setIsSavingAccount(true);

    try {
      const updatedData = {
        name: editAccName.trim() || 'Kas Utama',
        type: editAccType,
        account_number: editAccNumber.trim(),
        balance: Math.round(Number(editAccBalance) || 0),
        is_active: 1,
        updated_at: new Date().toISOString(),
      };

      if (primaryAccount) {
        await db.accounts.update(primaryAccount.id, updatedData);
        if (isConfigured) {
          await updateSupabaseAccount(primaryAccount.id, updatedData);
        }
      } else {
        const newAccId = await db.accounts.add({
          code: 'ACC-KAS',
          ...updatedData,
          created_at: new Date().toISOString(),
        });
        if (isConfigured) {
          await updateSupabaseAccount(newAccId, updatedData);
        }
      }

      addNotification({
        message: 'Informasi dan saldo kas berhasil diperbarui.',
        type: 'success',
      });
      setShowEditAccountModal(false);
    } catch (err) {
      addNotification({
        message: translateErrorMessage(err, 'Gagal menyimpan perubahan akun kas.'),
        type: 'error',
      });
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Database Reset Handler
  const handleConfirmReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      // 1. Reset Supabase Cloud database jika terkonfigurasi & online
      let cloudResetSuccess = false;
      if (isConfigured) {
        try {
          await resetSupabaseDatabase();
          cloudResetSuccess = true;
        } catch (cloudErr) {
          console.warn('Gagal reset di Supabase Cloud:', cloudErr);
        }
      }

      // 2. Reset Local Dexie IndexedDB
      await resetDatabaseToReal();

      setActiveSection('overview');

      if (isConfigured && !cloudResetSuccess) {
        addNotification({
          message: 'Penyimpanan lokal di perangkat Anda telah bersih (0 transaksi & 0 stok). Catatan: Supabase Cloud memerlukan izin TRUNCATE di SQL Editor.',
          type: 'warning',
        });
      } else {
        addNotification({
          message: 'Database berhasil direset bersih! Seluruh data di perangkat dan Supabase Cloud telah dikosongkan.',
          type: 'success',
        });
      }
    } catch (err) {
      addNotification({
        message: 'Gagal mereset database: ' + err.message,
        type: 'error',
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Operational Notes State (F5.4)
  const [notesTab, setNotesTab] = useState('active'); // 'active' (Belum Selesai) | 'completed' (Catatan Operasional Selesai)
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState('Umum');
  const [notePriority, setNotePriority] = useState('medium');
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));

  const activeNotes = (operationalNotes || []).filter((n) => !n.is_completed);
  const completedNotes = (operationalNotes || []).filter((n) => !!n.is_completed);

  // Anti-Lag Pagination: 20 items initial for completed operational notes
  const {
    displayedItems: paginatedCompletedNotes,
    remainingCount: remainingCompletedNotes,
    loadMore: loadMoreCompletedNotes,
  } = usePagination(completedNotes, {
    initialLimit: 20,
    step: 20,
    resetDependencies: [notesTab, activeSection],
  });

  const handleToggleNote = async (note) => {
    await db.operational_notes.update(note.id, {
      is_completed: note.is_completed ? 0 : 1,
      completed_at: !note.is_completed ? new Date().toISOString() : null,
    });
  };

  const handleDeleteNote = async (id) => {
    await db.operational_notes.delete(id);
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    await db.operational_notes.add({
      title: noteTitle.trim(),
      category: noteCategory,
      priority: notePriority,
      date: new Date(noteDate).toISOString(),
      is_completed: 0,
      created_at: new Date().toISOString(),
    });
    setNoteTitle('');
    setShowNoteModal(false);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncFromSupabase();
    setTimeout(() => setIsSyncing(false), 800);
  };

  const restoreInputRef = useRef(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleExportBackup = async () => {
    const backupData = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      accounts: await db.accounts.toArray(),
      commodities: await db.commodities.toArray(),
      items: await db.items.toArray(),
      unit_conversions: await db.unit_conversions.toArray(),
      transactions: await db.transactions.toArray(),
      transaction_items: await db.transaction_items.toArray(),
      stock_mutations: await db.stock_mutations.toArray(),
      capital_rotations: db.capital_rotations ? await db.capital_rotations.toArray() : [],
      operational_notes: await db.operational_notes.toArray(),
    };
    exportToJSON(backupData, `backup_amanah_barokah_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleRestoreBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('PERINGATAN: Memulihkan cadangan akan menggabungkan/memperbarui data di database lokal. Lanjutkan?')) {
      e.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object') {
        throw new Error('Format file cadangan JSON tidak valid.');
      }

      const tablesToLock = [
        db.accounts,
        db.commodities,
        db.items,
        db.unit_conversions,
        db.transactions,
        db.transaction_items,
        db.stock_mutations,
        db.operational_notes,
      ];
      if (db.capital_rotations) {
        tablesToLock.push(db.capital_rotations);
      }

      await db.transaction('rw', tablesToLock, async () => {
        if (Array.isArray(data.accounts) && data.accounts.length > 0) {
          await db.accounts.bulkPut(data.accounts);
        }
        if (Array.isArray(data.commodities) && data.commodities.length > 0) {
          await db.commodities.bulkPut(data.commodities);
        }
        if (Array.isArray(data.items) && data.items.length > 0) {
          await db.items.bulkPut(data.items);
        }
        if (Array.isArray(data.unit_conversions) && data.unit_conversions.length > 0) {
          await db.unit_conversions.bulkPut(data.unit_conversions);
        }
        if (Array.isArray(data.transactions) && data.transactions.length > 0) {
          await db.transactions.bulkPut(data.transactions);
        }
        if (Array.isArray(data.transaction_items) && data.transaction_items.length > 0) {
          await db.transaction_items.bulkPut(data.transaction_items);
        }
        if (Array.isArray(data.stock_mutations) && data.stock_mutations.length > 0) {
          await db.stock_mutations.bulkPut(data.stock_mutations);
        }
        if (Array.isArray(data.capital_rotations) && data.capital_rotations.length > 0 && db.capital_rotations) {
          await db.capital_rotations.bulkPut(data.capital_rotations);
        }
        if (Array.isArray(data.operational_notes) && data.operational_notes.length > 0) {
          await db.operational_notes.bulkPut(data.operational_notes);
        }
      });

      addNotification({
        message: 'Berhasil memulihkan cadangan data JSON! Memuat ulang sistem...',
        type: 'success',
      });
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error('Error restore backup:', err);
      const friendly = translateErrorMessage(err, 'Gagal memulihkan cadangan data.');
      addNotification({ message: friendly, type: 'error' });
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. APPLE LARGE TITLE */}
      <div className="pt-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
          Pengaturan
        </h1>
        <p className="text-xs text-[#64748B] mt-0.5 font-medium">
          Konfigurasi akun kas usaha, sinkronisasi Supabase Cloud, dan manajemen data
        </p>
      </div>

      {/* 2. SECTION 1: KEUANGAN & AKUN KAS TUNGGAL */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Keuangan & Rekening
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Row: Akun Kas Utama */}
          <div
            onClick={() => setActiveSection('accounts')}
            className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#D97706] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0F172A] tracking-tight">
                  {primaryAccount?.name || 'Kas Utama'}
                </div>
                <div className="text-xs text-[#64748B]">
                  {primaryAccount?.type === 'bank' ? 'Rekening Bank' : 'Kas Tunai Fisik'}
                  {primaryAccount?.account_number ? ` • Rek: ${primaryAccount.account_number}` : ''}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-black text-emerald-600 tabular-nums">
                {formatCurrency(primaryAccount?.balance || 0)}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECTION 2: OPERASIONAL */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Operasional Komoditas
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Row: Catatan & Pengingat Operasional (F5.4) */}
          <div
            onClick={() => setActiveSection('notes')}
            className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#00D29E] text-[#071A24] flex items-center justify-center shrink-0 shadow-2xs font-bold">
                <CheckSquare className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Catatan & Pengingat Operasional
                </div>
                <div className="text-xs text-[#64748B]">
                  To-do list harian, pengiriman komoditas, & jadwal kandang
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-700 tabular-nums">
                {activeNotes.length} Aktif
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECTION 3: CLOUD & SINKRONISASI */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Koneksi & Sinkronisasi Cloud
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Status Sinkronisasi Multi-Device Otomatis */}
          <div className="p-4 sm:px-5 flex items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#00D29E] border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Sinkronisasi HP, Tablet & Laptop
                </div>
                <div className="text-xs text-[#64748B] truncate">
                  {isConfigured
                    ? 'Otomatis aktif real-time (tanpa perlu login)'
                    : 'Koneksi Supabase belum aktif'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${isConfigured
                  ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
              >
                {isConfigured ? 'Tersambung' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Row 1: Cloud Sync Status */}
          <div
            onClick={() => setActiveSection('cloud')}
            className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Supabase Cloud Realtime
                </div>
                <div className="text-xs text-[#64748B] truncate">
                  Sinkronisasi otomatis multi-device iPad & HP
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${isConfigured
                  ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                  : 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                  }`}
              >
                {isConfigured ? 'Terhubung' : 'Offline'}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>

          {/* Row: Akun & Sesi Supabase */}
          <div
            onClick={() => setAuthModalOpen(true)}
            className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <ShieldCheck className="w-5 h-5 text-[#00D29E]" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Akun & Sesi Cloud Supabase
                </div>
                <div className="text-xs text-[#64748B] truncate">
                  {user ? `Masuk sebagai: ${user.email}` : 'Masuk akun admin untuk hak akses cloud penuh'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${user
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
              >
                {user ? 'Terotentikasi' : 'Masuk'}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>

          {/* Row 2: Sinkronkan Sekarang */}
          <div
            onClick={handleManualSync}
            className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#064E3B] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Sinkronisasi Manual
                </div>
                <div className="text-xs text-[#64748B]">
                  Unduh pembaruan terbaru dari database PostgreSQL
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-xs font-semibold text-[#064E3B]">
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. SECTION 4: CADANGAN & PEMULIHAN */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Cadangan & Pemulihan
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Row: Ekspor Backup */}
          <div
            onClick={handleExportBackup}
            className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Download className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Unduh Cadangan Database (JSON)
                </div>
                <div className="text-xs text-[#64748B]">
                  Simpan cadangan offline seluruh data transaksi & stok
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[#064E3B]">Ekspor</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>

          {/* Row: Impor / Restore Backup */}
          <div
            onClick={() => restoreInputRef.current?.click()}
            className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Upload className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Pulihkan Cadangan (Restore JSON)
                </div>
                <div className="text-xs text-[#64748B]">
                  {isRestoring ? 'Sedang memulihkan data...' : 'Impor file cadangan JSON untuk pemulihan database'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-amber-600">Pulihkan</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>

          <input
            type="file"
            ref={restoreInputRef}
            accept=".json,application/json"
            onChange={handleRestoreBackup}
            className="hidden"
          />

          {/* Row: Reset Database ke Data Riil */}
          <div
            onClick={() => setActiveSection('reset_confirm')}
            className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-rose-50/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-rose-600 tracking-tight">
                  Reset Database (Mulai Data Riil)
                </div>
                <div className="text-xs text-rose-500/80">
                  Kosongkan data dummy untuk memulai pengujian riil aplikasi
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-rose-600">Reset</span>
              <ChevronRight className="w-4 h-4 text-rose-300" />
            </div>
          </div>
        </div>
      </div>

      {/* 6. SECTION 5: TENTANG APLIKASI */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Informasi Sistem
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs">
              <img src="/logo.png" alt="CV Amanah Barokah" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-extrabold text-base text-[#0F172A] tracking-tight">
                CV Amanah Barokah
              </div>
              <div className="text-xs text-[#00D29E] font-semibold">
                Amanah Dalam Usaha, Barokah Untuk Semua
              </div>
            </div>


          </div>
          <p className="text-xs text-[#64748B] leading-relaxed pt-2 border-t border-slate-100">
            Sistem manajemen komoditas terpadu untuk <strong>Minyak, Telur, Sapi, Domba, dan Susu</strong>. Dilengkapi Moving Average HPP, pencatatan nota offline-first, dan sinkronisasi real-time Supabase PostgreSQL.
          </p>
        </div>
      </div>

      {/* =========================================================================
          SUB-VIEW MODAL: KELOLA AKUN KAS UTAMA
         ========================================================================= */}
      <BottomSheet
        isOpen={activeSection === 'accounts'}
        onClose={() => setActiveSection('overview')}
        title={
          <div className="flex items-center gap-2 text-[#064E3B]">
            <Wallet className="w-5 h-5 text-[#D97706]" />
            <span>Akun Kas Usaha</span>
          </div>
        }
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-tr from-[#071A24] to-[#0F2D3D] text-white shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Akun Kas Utama</span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-[#00D29E] border border-emerald-500/30">
                {primaryAccount?.type === 'bank' ? 'Rekening Bank' : 'Kas Tunai Fisik'}
              </span>
            </div>

            <div>
              <div className="text-xs text-slate-400 font-medium">Saldo Kas Saat Ini</div>
              <div className="text-2xl sm:text-3xl font-black text-[#00D29E] tabular-nums tracking-tight">
                {formatCurrency(primaryAccount?.balance || 0)}
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
              <span className="font-bold">{primaryAccount?.name || 'Kas Utama'}</span>
              <span className="font-mono text-slate-400">
                {primaryAccount?.account_number ? `Rek: ${primaryAccount.account_number}` : 'Tanpa No. Rek'}
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
            <div className="font-bold text-[#071A24]">Keterangan:</div>
            <p>
              Sistem menggunakan 1 Akun Kas Tunggal untuk mencatat seluruh arus kas masuk (penjualan) dan kas keluar (pembelian/operasional). Anda dapat mengubah nama akun atau memperbarui saldo kas langsung di bawah.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="primary"
              size="md"
              icon={Edit2}
              onClick={handleOpenEditAccount}
              className="w-full sm:flex-1"
            >
              Ubah Data & Saldo Kas
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setActiveSection('overview')}
              className="w-full sm:w-auto"
            >
              Selesai
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* =========================================================================
          MODAL EDIT AKUN KAS
         ========================================================================= */}
      <BottomSheet
        isOpen={showEditAccountModal}
        onClose={() => setShowEditAccountModal(false)}
        title={
          <div className="flex items-center gap-2 text-[#071A24]">
            <Edit2 className="w-5 h-5 text-[#00D29E]" />
            <span className="font-extrabold text-base">Ubah Data & Saldo Kas</span>
          </div>
        }
        size="md"
      >
        <form onSubmit={handleSaveAccount} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Nama Akun Kas
            </label>
            <input
              type="text"
              value={editAccName}
              onChange={(e) => setEditAccName(e.target.value)}
              placeholder="Contoh: Kas Utama / BCA Usaha"
              className="input-field rounded-xl"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Tipe Kas
            </label>
            <select
              value={editAccType}
              onChange={(e) => setEditAccType(e.target.value)}
              className="input-field font-semibold rounded-xl"
            >
              <option value="cash">Kas Tunai (Fisik)</option>
              <option value="bank">Rekening Bank</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Nomor Rekening (Opsional jika bank)
            </label>
            <input
              type="text"
              value={editAccNumber}
              onChange={(e) => setEditAccNumber(e.target.value)}
              placeholder="Contoh: 1234567890 (BCA)"
              className="input-field font-mono rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Saldo Kas (Rp)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={editAccBalance}
              onChange={(e) => setEditAccBalance(e.target.value)}
              placeholder="0"
              className="input-field tabular-nums text-base font-bold rounded-xl"
              required
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Perbarui nominal saldo kas riil usaha Anda saat ini.
            </span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowEditAccountModal(false)}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Check}
              loading={isSavingAccount}
              disabled={isSavingAccount}
              className="w-full sm:w-auto shadow-xs"
            >
              {isSavingAccount ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* =========================================================================
          SUB-VIEW MODAL: RESET DATABASE KE DATA RIIL
         ========================================================================= */}
      <BottomSheet
        isOpen={activeSection === 'reset_confirm'}
        onClose={() => setActiveSection('overview')}
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            <span className="font-extrabold text-base">Reset Database (Mode Data Riil)</span>
          </div>
        }
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-900 leading-relaxed">
            <p className="font-extrabold text-sm text-rose-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Konfirmasi Reset Database Total (Perangkat & Cloud)
            </p>
            <p>
              Tindakan ini akan <strong>menghapus permanen</strong> seluruh data di perangkat ini dan Supabase Cloud:
            </p>
            <ul className="list-disc pl-5 space-y-0.5 text-rose-800">
              <li>Semua riwayat transaksi mutasi kas & dagang</li>
              <li>Semua data stok & penyesuaian komoditas</li>
              <li>Semua proyek perputaran modal (rotasi)</li>
              <li>Semua kontak rekanan & catatan operasional</li>
            </ul>
            <p className="pt-1 text-[11px] text-rose-700">
              Setelah reset, sistem akan menyiapkan <strong>1 Akun Kas Utama Bersih (Saldo: Rp 0)</strong> di HP/Laptop dan Supabase Cloud.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setActiveSection('overview')}
              className="w-full sm:w-auto"
            >
              Batalkan
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={isResetting}
              icon={RotateCcw}
              onClick={handleConfirmReset}
              className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isResetting ? 'Sedang Mereset...' : 'Ya, Reset Semua Data ke Mode Riil'}
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* =========================================================================
          SUB-VIEW MODAL: SUPABASE CLOUD DETAILS
         ========================================================================= */}
      <BottomSheet
        isOpen={activeSection === 'cloud'}
        onClose={() => setActiveSection('overview')}
        title={
          <div className="flex items-center gap-2 text-[#064E3B]">
            <Cloud className="w-5 h-5 text-emerald-500" />
            <span>Koneksi Supabase Cloud</span>
          </div>
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2 text-xs text-slate-700">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="font-semibold text-[#64748B]">Status Sinkronisasi:</span>
              <span className="font-bold text-[#059669]">
                {isConfigured ? 'Aktif & Realtime' : 'Kredensial Belum Dikonfigurasi'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="font-semibold text-[#64748B]">Target PostgreSQL:</span>
              <span className="font-mono text-slate-800 text-[11px]">8 Tabel Utama</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="font-semibold text-[#64748B]">Storage Bucket Foto Nota:</span>
              <span className="font-mono text-slate-800">'receipts'</span>
            </div>
          </div>

          <div className="p-4 bg-[#064E3B] text-emerald-100 rounded-2xl font-mono text-xs space-y-1.5 border border-emerald-900 overflow-x-auto">
            <div className="text-[#D97706] font-bold">// Lokasi File Skema SQL:</div>
            <div>c:\laragon\www\cashflowapp\bang-andi\supabase_schema.sql</div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setActiveSection('overview')}
            >
              Tutup
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleManualSync}
              loading={isSyncing}
              icon={RefreshCw}
            >
              Sinkronkan Sekarang
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* =========================================================================
          MODAL CATATAN & PENGINGAT OPERASIONAL (F5.4 - ANTI-LAG PAGINATION)
         ========================================================================= */}
      <BottomSheet
        isOpen={activeSection === 'notes'}
        onClose={() => setActiveSection('overview')}
        title={
          <div className="flex items-center gap-2.5 text-[#071A24]">
            <div className="w-8 h-8 rounded-xl bg-[#00D29E]/20 text-[#00D29E] flex items-center justify-center font-bold">
              <CheckSquare className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-base">Catatan & Pengingat Operasional</span>
          </div>
        }
        size="lg"
      >
        <div className="space-y-4">
          {/* Header Action & Segmented Tab */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/60 self-start">
              <button
                type="button"
                onClick={() => setNotesTab('active')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${notesTab === 'active'
                    ? 'bg-[#071A24] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <span>Belum Selesai</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${notesTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                  {activeNotes.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setNotesTab('completed')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${notesTab === 'completed'
                    ? 'bg-[#00D29E] text-[#071A24] font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <span>Catatan Selesai</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${notesTab === 'completed' ? 'bg-[#071A24]/15 text-[#071A24]' : 'bg-slate-200 text-slate-700'
                  }`}>
                  {completedNotes.length}
                </span>
              </button>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowNoteModal(!showNoteModal)}
              className="self-start sm:self-auto gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Catatan</span>
            </Button>
          </div>

          {/* Quick Note Creation Form */}
          {showNoteModal && (
            <form onSubmit={handleCreateNote} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="text-xs font-extrabold text-[#071A24] uppercase tracking-wide">
                Catatan Operasional Baru
              </div>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Contoh: Kirim 20L susu sapi ke Bu Ani, Jadwal vaksin LMS-003..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00D29E]"
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Komoditas / Tag</label>
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="Umum">Umum</option>
                    <option value="Susu">Susu</option>
                    <option value="Sapi">Sapi</option>
                    <option value="Domba">Domba</option>
                    <option value="Telur">Telur</option>
                    <option value="Minyak">Minyak</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Prioritas</label>
                  <select
                    value={notePriority}
                    onChange={(e) => setNotePriority(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="low">Rendah</option>
                    <option value="medium">Sedang</option>
                    <option value="high">Tinggi (Mendesak)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Target Tanggal</label>
                  <input
                    type="date"
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShowNoteModal(false)}>
                  Batal
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Simpan Agenda
                </Button>
              </div>
            </form>
          )}

          {/* TAB 1: BELUM SELESAI */}
          {notesTab === 'active' && (
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto">
              {activeNotes.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Semua catatan operasional selesai! Tidak ada tugas pending.
                </div>
              ) : (
                activeNotes.map((note) => (
                  <div key={note.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleNote(note)}
                        className="text-slate-400 hover:text-[#00D29E] transition cursor-pointer shrink-0"
                        title="Tandai selesai"
                      >
                        <Square className="w-5 h-5" />
                      </button>
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs sm:text-sm text-[#071A24] truncate">
                          {note.title}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-medium">{note.category || 'Umum'}</span>
                          {note.date && <span>• {new Date(note.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${note.priority === 'high'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : note.priority === 'medium'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                      >
                        {note.priority === 'high' ? 'Tinggi' : note.priority === 'medium' ? 'Sedang' : 'Rendah'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 transition cursor-pointer"
                        title="Hapus catatan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: CATATAN OPERASIONAL SELESAI */}
          {notesTab === 'completed' && (
            <div className="space-y-3">
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto">
                {completedNotes.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Belum ada catatan operasional yang selesai.
                  </div>
                ) : (
                  paginatedCompletedNotes.map((note) => (
                    <div key={note.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition bg-slate-50/40">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleNote(note)}
                          className="text-[#00D29E] hover:text-slate-400 transition cursor-pointer shrink-0"
                          title="Kembalikan ke belum selesai"
                        >
                          <CheckSquare className="w-5 h-5 stroke-[2.5]" />
                        </button>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs sm:text-sm text-slate-500 line-through truncate">
                            {note.title}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span className="font-medium">{note.category || 'Umum'}</span>
                            <span className="text-emerald-600 font-bold">• Selesai</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Selesai
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition cursor-pointer"
                          title="Hapus catatan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Anti-Lag Load More Button: Max 20 items per click */}
              <LoadMoreButton
                remainingCount={remainingCompletedNotes}
                onClick={loadMoreCompletedNotes}
              />
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setActiveSection('overview')}
            >
              Tutup
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
