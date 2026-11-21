import { useState } from 'react';
import { useLiveQuery } from '../../hooks/useLiveQuery.js';
import { db } from '../../lib/db.js';
import { useAuthStore } from '../../lib/authStore.js';
import { syncFromSupabase } from '../../lib/supabaseService.js';
import { formatCurrency } from '../../lib/formatters.js';
import { exportToJSON } from '../../lib/exporters.js';
import BottomSheet from '../ui/BottomSheet.jsx';
import Button from '../ui/Button.jsx';
import {
  Cloud,
  Users,
  Wallet,
  Download,
  RefreshCw,
  Plus,
  FileCode,
  Building,
  UserCheck,
  ChevronRight
} from 'lucide-react';

/**
 * Apple HIG Settings View (iPhone Settings Inset Grouped Style)
 * 
 * Features:
 * - Apple Large Title "Pengaturan"
 * - Inset Grouped List sections:
 *   - Soft tinted squircle icons on the left
 *   - Bold title & secondary subtitle
 *   - Right accessory value & Chevron `>`
 * - Sub-view management modals (Kas & Bank, Kontak, Cloud, Backup)
 */
export default function SettingsView() {
  const { user, isConfigured } = useAuthStore();
  const accounts = useLiveQuery(() => db.accounts.toArray(), [], []);
  const contacts = useLiveQuery(() => db.contacts.toArray(), [], []);

  const [activeSection, setActiveSection] = useState('overview'); // overview | cloud | accounts | contacts | backup
  const [isSyncing, setIsSyncing] = useState(false);

  // New Account Modal State
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('cash');
  const [accNumber, setAccNumber] = useState('');
  const [accBalance, setAccBalance] = useState('');

  // New Contact Modal State
  const [showContactModal, setShowContactModal] = useState(false);
  const [conName, setConName] = useState('');
  const [conType, setConType] = useState('customer');
  const [conPhone, setConPhone] = useState('');
  const [conAddress, setConAddress] = useState('');

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncFromSupabase();
    setTimeout(() => setIsSyncing(false), 800);
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!accName) return;
    await db.accounts.add({
      name: accName,
      type: accType,
      account_number: accNumber,
      balance: Number(accBalance) || 0,
      is_active: 1,
      created_at: new Date().toISOString(),
    });
    setShowAccountModal(false);
    setAccName('');
    setAccNumber('');
    setAccBalance('');
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!conName) return;
    await db.contacts.add({
      name: conName,
      type: conType,
      phone: conPhone,
      address: conAddress,
      is_active: 1,
      created_at: new Date().toISOString(),
    });
    setShowContactModal(false);
    setConName('');
    setConPhone('');
    setConAddress('');
  };

  const handleExportBackup = async () => {
    const backupData = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      accounts: await db.accounts.toArray(),
      contacts: await db.contacts.toArray(),
      commodities: await db.commodities.toArray(),
      items: await db.items.toArray(),
      unit_conversions: await db.unit_conversions.toArray(),
      transactions: await db.transactions.toArray(),
      transaction_items: await db.transaction_items.toArray(),
      stock_mutations: await db.stock_mutations.toArray(),
    };
    exportToJSON(backupData, `backup_bang_andi_${new Date().toISOString().slice(0, 10)}.json`);
  };

  return (
    <div className="space-y-6">
      {/* 1. APPLE LARGE TITLE */}
      <div className="pt-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
          Pengaturan
        </h1>
        <p className="text-xs text-[#64748B] mt-0.5 font-medium">
          Konfigurasi Supabase Cloud, rekening kas/bank, kontak rekanan, dan keamanan data
        </p>
      </div>

      {/* 2. SECTION 1: CLOUD & SINKRONISASI */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Koneksi & Sinkronisasi Cloud
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
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

      {/* 3. SECTION 2: KEUANGAN & REKENING */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Keuangan & Rekening
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Row: Akun Kas & Bank */}
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
                  Rekening Kas & Bank
                </div>
                <div className="text-xs text-[#64748B]">
                  Kelola kas tunai fisik, rekening bank, dan saldo awal
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-700 tabular-nums">
                {accounts?.length || 0} Akun
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECTION 3: REKANAN BISNIS */}
      <div className="space-y-1.5">
        <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Rekanan Bisnis
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {/* Row: Kontak Rekanan */}
          <div
            onClick={() => setActiveSection('contacts')}
            className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#0F172A] tracking-tight">
                  Kontak Pelanggan & Supplier
                </div>
                <div className="text-xs text-[#64748B]">
                  Data nomor WhatsApp rekanan untuk nota dan penagihan
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-700 tabular-nums">
                {contacts?.length || 0} Rekanan
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. SECTION 4: DATA & CADANGAN */}
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
          SUB-VIEW MODAL: REKENING KAS & BANK
         ========================================================================= */}
      <BottomSheet
        isOpen={activeSection === 'accounts'}
        onClose={() => setActiveSection('overview')}
        title={
          <div className="flex items-center gap-2 text-[#064E3B]">
            <Wallet className="w-5 h-5 text-[#D97706]" />
            <span>Kelola Rekening Kas & Bank</span>
          </div>
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#64748B]">
              Daftar rekening operasional tunai dan perbankan
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowAccountModal(true)}
            >
              Tambah Akun
            </Button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
            {accounts?.map((acc) => (
              <div key={acc.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#064E3B] flex items-center justify-center shrink-0 border border-emerald-100">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#0F172A]">{acc.name}</div>
                    <div className="text-xs text-[#64748B]">
                      {acc.type === 'cash' ? 'Kas Tunai' : 'Bank'} • Rek: {acc.account_number || '-'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-[#064E3B] tabular-nums">
                    {formatCurrency(acc.balance)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setActiveSection('overview')}
            >
              Selesai
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* =========================================================================
          SUB-VIEW MODAL: KONTAK PELANGGAN & SUPPLIER
         ========================================================================= */}
      <BottomSheet
        isOpen={activeSection === 'contacts'}
        onClose={() => setActiveSection('overview')}
        title={
          <div className="flex items-center gap-2 text-[#064E3B]">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Kontak Pelanggan & Supplier</span>
          </div>
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#64748B]">
              Daftar rekanan komoditas dan pelanggan setia
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowContactModal(true)}
            >
              Tambah Kontak
            </Button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white max-h-[50vh] overflow-y-auto">
            {contacts?.map((con) => (
              <div key={con.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/60">
                    {con.type === 'customer' ? <UserCheck className="w-4 h-4" /> : <Building className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[#0F172A]">{con.name}</div>
                    <div className="text-xs text-[#64748B] tabular-nums">
                      {con.phone || 'Tanpa HP'} • {con.address || 'Tanpa Alamat'}
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${con.type === 'customer'
                    ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                    : 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]'
                    }`}
                >
                  {con.type === 'customer' ? 'Pelanggan' : 'Supplier'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setActiveSection('overview')}
            >
              Selesai
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* =========================================================================
          MODAL TAMBAH AKUN KAS / BANK
         ========================================================================= */}
      <BottomSheet
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        title={
          <div className="flex items-center gap-2 text-[#064E3B]">
            <Wallet className="w-5 h-5 text-[#D97706]" />
            <span>Tambah Akun Kas / Bank</span>
          </div>
        }
        size="md"
      >
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Nama Akun
            </label>
            <input
              type="text"
              value={accName}
              onChange={(e) => setAccName(e.target.value)}
              placeholder="Contoh: Kas Utama Andi / BCA Bisnis"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Tipe Akun
            </label>
            <select
              value={accType}
              onChange={(e) => setAccType(e.target.value)}
              className="input-field font-medium"
            >
              <option value="cash">Kas Tunai (Fisik)</option>
              <option value="bank">Rekening Bank</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Nomor Rekening (Opsional)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={accNumber}
              onChange={(e) => setAccNumber(e.target.value)}
              placeholder="Contoh: 1234567890"
              className="input-field tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Saldo Awal (Rp)
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={accBalance}
              onChange={(e) => setAccBalance(e.target.value)}
              placeholder="0"
              className="input-field tabular-nums"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowAccountModal(false)}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full sm:w-auto shadow-xs"
            >
              Simpan Akun
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* =========================================================================
          MODAL TAMBAH KONTAK
         ========================================================================= */}
      <BottomSheet
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        title={
          <div className="flex items-center gap-2 text-[#064E3B]">
            <Users className="w-5 h-5 text-[#D97706]" />
            <span>Tambah Kontak Rekanan</span>
          </div>
        }
        size="md"
      >
        <form onSubmit={handleCreateContact} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Nama Rekanan
            </label>
            <input
              type="text"
              value={conName}
              onChange={(e) => setConName(e.target.value)}
              placeholder="Nama toko, warung, atau supplier..."
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Tipe Rekanan
            </label>
            <select
              value={conType}
              onChange={(e) => setConType(e.target.value)}
              className="input-field font-medium"
            >
              <option value="customer">Pelanggan (Customer)</option>
              <option value="supplier">Supplier / Pemasok</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Nomor WhatsApp / HP
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={conPhone}
              onChange={(e) => setConPhone(e.target.value)}
              placeholder="0812-xxxx-xxxx"
              className="input-field tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
              Alamat Lengkap
            </label>
            <input
              type="text"
              value={conAddress}
              onChange={(e) => setConAddress(e.target.value)}
              placeholder="Alamat toko, kandang, atau gudang..."
              className="input-field"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowContactModal(false)}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full sm:w-auto shadow-xs"
            >
              Simpan Kontak
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}
