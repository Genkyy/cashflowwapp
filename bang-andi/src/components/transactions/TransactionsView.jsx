import { useState, useRef, useEffect, useMemo } from 'react';
import { useLiveQuery } from '../../hooks/useLiveQuery.js';
import { db } from '../../lib/db.js';
import { useAppStore } from '../../lib/store.js';
import { formatCurrency, formatDate, formatDatetime } from '../../lib/formatters.js';
import { uploadReceiptImage } from '../../lib/storage.js';
import { createSupabaseTransaction } from '../../lib/supabaseService.js';
import useTransactions from '../../hooks/useTransactions.js';
import { usePagination } from '../../hooks/usePagination.js';
import {
  Plus,
  Search,
  Camera,
  Image as ImageIcon,
  X,
  Trash2,
  Receipt,
  Ban,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  AlertTriangle,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Layers,
  ChevronRight,
  Copy,
  Wallet,
  Zap,
  Package
} from 'lucide-react';
import BottomSheet from '../ui/BottomSheet.jsx';
import { SkeletonCard } from '../ui/Skeleton.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import { LoadMoreButton } from '../ui/LoadMoreButton.jsx';
import CapitalRotationsView from './CapitalRotationsView.jsx';
import { translateErrorMessage } from '../../lib/errorHandler.js';

/**
 * FlowMint-style Modern Transactions & Cash Flow View
 * Consistent with DashboardView:
 * - FlowMint Midnight Navy & Mint Green palette (#071A24, #00D29E)
 * - Hero stats row (Uang Masuk, Uang Keluar, Kas Bersih)
 * - Modern Pill Segmented Filters with counters
 * - FlowMint Inset Cards with high visual clarity, micro-badges, and receipt previews
 * - Streamlined BottomSheet modal for quick transaction entry
 */
export default function TransactionsView() {
  const {
    showTransactionForm,
    setShowTransactionForm,
    defaultTransactionType,
    setDefaultTransactionType,
    addNotification,
  } = useAppStore();
  const { voidTransaction, deleteTransaction } = useTransactions();

  // 1. Live Queries
  const transactions = useLiveQuery(() => db.transactions.toArray(), [], []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), [], []);
  const items = useLiveQuery(() => db.items.toArray(), [], []);

  // 2. Main View Mode: 'transactions' (Kasir/Dagang Ritel) | 'rotations' (Proyek Rotasi Modal)
  const [mainTab, setMainTab] = useState('transactions');

  // 3. Banking Timeline Filter & Search State
  const [selectedPeriod, setSelectedPeriod] = useState('this_month'); // this_month (Anti-Lag default) | all | last_30_days
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all | income | expense
  const [sortBy, setSortBy] = useState('newest'); // newest | oldest | highest | lowest
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedTxDetail, setSelectedTxDetail] = useState(null); // Digital Receipt Slip modal
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  const primaryAccount = accounts?.[0] || null;

  // Dynamic count of secondary active filters
  const activeFilterCount =
    (sortBy !== 'newest' ? 1 : 0) +
    (selectedPeriod !== 'this_month' ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedPeriod('this_month');
    setFilterType('all');
    setSortBy('newest');
    setSearch('');
  };

  // 3. Modals State
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState(null);
  const [voidingTx, setVoidingTx] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  // 4. Form State (Streamlined, Fast & Stock-Safe)
  const [txType, setTxType] = useState('income'); // income | expense
  const [entryMode, setEntryMode] = useState('quick'); // 'quick' (Kas Cepat) | 'stock' (Komoditas Berstok)
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState('Operasional');
  const [quickNotes, setQuickNotes] = useState('');
  const [customCategory, setCustomCategory] = useState('');

  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const categoryName = '';

  // Line items
  const [lineItems, setLineItems] = useState([
    { product_id: '', name: '', qty: 1, unit: '', unit_price: 0, subtotal: 0 }
  ]);

  // Receipt image upload
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Sync default type and ensure mainTab switches to transactions when form is triggered
  useEffect(() => {
    if (defaultTransactionType) {
      setTxType(defaultTransactionType);
      if (defaultTransactionType === 'expense') {
        setEntryMode('quick');
        setQuickCategory('BBM / Bensin');
      } else {
        setEntryMode('quick');
        setQuickCategory('Penjualan Tunai');
      }
    }
    if (showTransactionForm) {
      setMainTab('transactions');
    }
  }, [defaultTransactionType, showTransactionForm]);

  // Quick stats calculation dynamically reacting to selectedPeriod
  const [now] = useState(() => new Date());
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const metrics = useMemo(() => {
    let income = 0;
    let expense = 0;
    let totalCount = 0;

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const checkPeriodMatch = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (selectedPeriod === 'this_month') {
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      if (selectedPeriod === 'last_month') {
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      }
      if (selectedPeriod === 'last_30_days') {
        return d.getTime() >= thirtyDaysAgo.getTime();
      }
      return true; // 'all'
    };

    (transactions || []).forEach((t) => {
      if (t.status === 'void') return;
      totalCount++;

      if (t.type !== 'transfer') {
        if (checkPeriodMatch(t.date)) {
          const amt = Number(t.total_amount) || Number(t.paid_amount) || 0;
          if (t.type === 'income') {
            income += amt;
          } else if (t.type === 'expense' && t.sub_type !== 'transfer') {
            expense += amt;
          }
        }
      }
    });

    return {
      income,
      expense,
      net: income - expense,
      totalCount
    };
  }, [transactions, selectedPeriod, currentMonth, currentYear, now]);



  // Line item handlers
  const handleItemChange = (idx, field, value) => {
    const updated = [...lineItems];
    const item = { ...updated[idx], [field]: value };

    if (field === 'product_id') {
      const prod = items?.find((it) => String(it.id) === String(value));
      if (prod) {
        item.name = prod.name;
        item.unit = prod.base_unit;
        item.unit_price = txType === 'income' ? prod.selling_price || 0 : prod.hpp || 0;
      }
    }

    if (field === 'qty' || field === 'unit_price' || field === 'product_id') {
      const q = Math.max(0, Number(item.qty) || 0);
      const p = Math.max(0, Math.round(Number(item.unit_price) || 0));
      item.subtotal = Math.round(q * p);
    }

    updated[idx] = item;
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { product_id: '', name: '', qty: 1, unit: '', unit_price: 0, subtotal: 0 }
    ]);
  };

  const removeLineItem = (idx) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== idx));
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  // Form total calculation
  const totalAmount = useMemo(() => {
    if (entryMode === 'quick') {
      return Math.max(0, Math.round(Number(quickAmount) || 0));
    }
    return Math.max(0, Math.round(lineItems.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0)));
  }, [entryMode, quickAmount, lineItems]);

  // Real-time stock validation check for commodity selling
  const stockValidationErrors = useMemo(() => {
    if (entryMode !== 'stock' || txType !== 'income') return [];
    const errors = [];
    lineItems.forEach((it, idx) => {
      if (!it.product_id) return;
      const prod = items?.find((p) => String(p.id) === String(it.product_id));
      if (!prod) return;
      const curStock = Number(prod.stock) || 0;
      const reqQty = Number(it.qty) || 0;
      if (curStock <= 0) {
        errors.push({
          idx,
          productId: prod.id,
          productName: prod.name,
          unit: prod.base_unit || 'unit',
          curStock: 0,
          type: 'empty',
          message: `Stok "${prod.name}" KOSONG (0 ${prod.base_unit || ''}). Tidak bisa dijual sebelum ada stok masuk / pembelian.`,
        });
      } else if (reqQty > curStock) {
        errors.push({
          idx,
          productId: prod.id,
          productName: prod.name,
          unit: prod.base_unit || 'unit',
          curStock,
          reqQty,
          type: 'insufficient',
          message: `Kuantitas (${reqQty} ${prod.base_unit || ''}) melebihi stok yang ada (Tersedia: ${curStock} ${prod.base_unit || ''}).`,
        });
      }
    });
    return errors;
  }, [entryMode, txType, lineItems, items]);

  const hasStockError = stockValidationErrors.length > 0;

  // Save Transaction
  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    if (isUploading) return;
    if (totalAmount <= 0) {
      addNotification({ message: 'Nominal transaksi harus lebih dari 0.', type: 'error' });
      return;
    }
    if (entryMode === 'stock' && hasStockError) {
      addNotification({ message: stockValidationErrors[0].message, type: 'error' });
      return;
    }
    if (entryMode === 'stock' && lineItems.some((it) => !it.product_id || Number(it.qty) <= 0)) {
      addNotification({ message: 'Silakan pilih komoditas dan isi kuantitas dengan benar.', type: 'error' });
      return;
    }

    setIsUploading(true);

    try {
      let uploadedReceiptUrl = '';
      if (receiptFile) {
        const uploadResult = await uploadReceiptImage(receiptFile, 'nota_transaksi');
        uploadedReceiptUrl = uploadResult.url;
      }

      const isQuick = entryMode === 'quick';
      const actualSubType = isQuick
        ? (txType === 'income' ? 'sale' : 'operational')
        : (txType === 'income' ? 'sale' : 'purchase');

      const resolvedCategory = isQuick
        ? (quickCategory === 'Lainnya' && customCategory.trim() ? customCategory.trim() : quickCategory)
        : (categoryName.trim() || (txType === 'income' ? 'Penjualan Komoditas' : 'Kulakan Stok'));

      const actualNotes = isQuick
        ? quickNotes.trim()
        : notes.trim();

      await createSupabaseTransaction({
        type: txType,
        sub_type: actualSubType,
        contact_id: null,
        account_id: primaryAccount?.id || accounts?.[0]?.id || null,
        to_account_id: null,
        total_amount: totalAmount,
        paid_amount: totalAmount,
        payment_status: 'paid',
        date: txDate,
        due_date: null,
        category: resolvedCategory,
        category_name: resolvedCategory,
        notes: actualNotes,
        receipt_url: uploadedReceiptUrl,
        items: isQuick ? [] : lineItems.filter((it) => it.product_id && it.qty > 0),
      });

      // Reset form
      setShowTransactionForm(false);
      setReceiptFile(null);
      setReceiptPreview('');
      setQuickAmount('');
      setQuickNotes('');
      setCustomCategory('');
      setLineItems([{ product_id: '', name: '', qty: 1, unit: '', unit_price: 0, subtotal: 0 }]);
      setNotes('');
      addNotification({
        message: `Transaksi sebesar Rp ${totalAmount.toLocaleString('id-ID')} berhasil disimpan.`,
        type: 'success',
      });
    } catch (err) {
      const friendly = translateErrorMessage(err, 'Gagal menyimpan transaksi. Pastikan data terisi dengan benar.');
      addNotification({ message: friendly, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  // Filtered & Sorted Transactions (Bank Timeline Style)
  const filteredTransactions = useMemo(() => {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    return (transactions || [])
      .filter((tx) => {
        // Period filter
        if (selectedPeriod === 'this_month') {
          const tDate = new Date(tx.date);
          if (tDate.getMonth() !== currentMonth || tDate.getFullYear() !== currentYear) return false;
        } else if (selectedPeriod === 'last_month') {
          const tDate = new Date(tx.date);
          if (tDate.getMonth() !== lastMonth || tDate.getFullYear() !== lastMonthYear) return false;
        } else if (selectedPeriod === 'last_30_days') {
          const tDate = new Date(tx.date);
          if (tDate.getTime() < thirtyDaysAgo.getTime()) return false;
        }

        // Type filter
        if (filterType !== 'all') {
          if (tx.type !== filterType) return false;
        }

        // Search text
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchInv = (tx.invoice_number || '').toLowerCase().includes(q);
          const matchNotes = (tx.notes || '').toLowerCase().includes(q);
          const matchCategory = (tx.category || tx.sub_type || '').toLowerCase().includes(q);
          const matchAmount = String(tx.total_amount || '').includes(q);
          return matchInv || matchNotes || matchCategory || matchAmount;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        if (sortBy === 'highest') {
          return (Number(b.total_amount) || 0) - (Number(a.total_amount) || 0);
        }
        if (sortBy === 'lowest') {
          return (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
        }
        return 0;
      });
  }, [transactions, selectedPeriod, filterType, search, sortBy, currentMonth, currentYear, now]);

  // Anti-Lag Pagination: 20 items initial, reset on any filter/search change
  const {
    displayedItems: paginatedTransactions,
    remainingCount: remainingTransactions,
    loadMore: loadMoreTransactions,
  } = usePagination(filteredTransactions, {
    initialLimit: 20,
    step: 20,
    resetDependencies: [selectedPeriod, filterType, sortBy, search],
  });

  const isLoading = transactions === undefined;

  // Group transactions by date for authentic banking timeline (Paginated for high performance)
  const groupedTransactions = useMemo(() => {
    const groups = [];
    const dateMap = new Map();

    paginatedTransactions.forEach((tx) => {
      const dateKey = tx.date ? tx.date.slice(0, 10) : 'Tanpa Tanggal';
      if (!dateMap.has(dateKey)) {
        const arr = [];
        dateMap.set(dateKey, arr);
        groups.push({ dateKey, items: arr });
      }
      dateMap.get(dateKey).push(tx);
    });

    return groups;
  }, [paginatedTransactions]);

  // Date label formatting helper
  const getDateLabel = (dateStr) => {
    if (!dateStr || dateStr === 'Tanpa Tanggal') return 'Lainnya';
    try {
      const txDate = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const isToday =
        txDate.getDate() === today.getDate() &&
        txDate.getMonth() === today.getMonth() &&
        txDate.getFullYear() === today.getFullYear();

      const isYesterday =
        txDate.getDate() === yesterday.getDate() &&
        txDate.getMonth() === yesterday.getMonth() &&
        txDate.getFullYear() === yesterday.getFullYear();

      if (isToday) return `Hari Ini • ${formatDate(dateStr, 'full')}`;
      if (isYesterday) return `Kemarin • ${formatDate(dateStr, 'full')}`;
      return formatDate(dateStr, 'full');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-6">
      {/* =========================================================================
          1. TOP BAR: TITLE + ACTION BUTTON
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#00D29E] to-[#10B981] flex items-center justify-center shadow-xs text-white">
              <Receipt className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-[#071A24]">
              CV AMANAH BAROKAH
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#071A24]">
            Mutasi & Transaksi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Histori arus kas harian, bukti nota, dan rekonsiliasi pembayaran.
          </p>
        </div>

        {/* Primary CTA */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {mainTab === 'transactions' && (
            <button
              type="button"
              onClick={() => {
                setDefaultTransactionType('income');
                setShowTransactionForm(true);
              }}
              className="inline-flex items-center gap-2 bg-[#071A24] hover:bg-[#0B2533] active:scale-95 text-white px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm shadow-sm transition ios-spring-tap cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#00D29E] stroke-[3]" />
              <span>Catat Transaksi</span>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          VIEW MODE SWITCHER: Transaksi Kasir (Kiri) vs Proyek Rotasi Modal (Kanan)
         ========================================================================= */}
      <div className="flex p-1 bg-slate-200/80 rounded-2xl border border-slate-300/60 max-w-md w-full">
        <button
          type="button"
          onClick={() => setMainTab('transactions')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            mainTab === 'transactions'
              ? 'bg-[#071A24] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-[#00D29E]" />
          <span>Transaksi Kasir / Dagang</span>
        </button>
        <button
          type="button"
          onClick={() => setMainTab('rotations')}
          className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            mainTab === 'rotations'
              ? 'bg-[#071A24] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-[#00D29E]" />
          <span>Proyek Rotasi Modal</span>
        </button>
      </div>

      {mainTab === 'transactions' ? (
        <>
      {/* =========================================================================
          2. BANKING CASH FLOW SUMMARY BAR (Ringkas & Langsung Paham)
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3">
        {/* Period Selector & Title */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
            Ringkasan Arus Kas
          </span>

          {/* Quick Period Selector */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl overflow-x-auto max-w-full no-scrollbar">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'this_month', label: 'Bulan Ini' },
              { id: 'last_month', label: 'Bulan Lalu' },
              { id: 'last_30_days', label: '30 Hari' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPeriod(p.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedPeriod === p.id
                    ? 'bg-[#071A24] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* In/Out Metrics Grid (Optimized for Mobile 393px to prevent truncation) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 pt-1">
          {/* Uang Masuk */}
          <div className="p-2 sm:p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100/80 flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-white text-[#00D29E] flex items-center justify-center shrink-0 shadow-xs border border-emerald-100">
              <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800/80 block leading-tight">Uang Masuk</span>
              <div className="text-xs min-[375px]:text-[13px] sm:text-base lg:text-lg font-black text-emerald-700 tracking-tight tabular-nums leading-snug whitespace-nowrap">
                +{formatCurrency(metrics.income)}
              </div>
            </div>
          </div>

          {/* Uang Keluar */}
          <div className="p-2 sm:p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100/80 flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-white text-rose-500 flex items-center justify-center shrink-0 shadow-xs border border-rose-100">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-800/80 block leading-tight">Uang Keluar</span>
              <div className="text-xs min-[375px]:text-[13px] sm:text-base lg:text-lg font-black text-rose-600 tracking-tight tabular-nums leading-snug whitespace-nowrap">
                -{formatCurrency(metrics.expense)}
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* =========================================================================
          3. UNIFIED SEARCH & FILTER BAR
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3">
        {/* Row 1: Search Box + Filter Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari rekanan, faktur, nominal, catatan..."
              className="w-full pl-10 pr-9 py-2.5 min-h-[44px] text-xs sm:text-sm bg-slate-50 border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00D29E] focus:border-[#00D29E] transition font-medium text-slate-800 placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                title="Hapus pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>



          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className={`min-h-[44px] px-3.5 sm:px-4 rounded-2xl flex items-center gap-2 font-bold text-xs transition border cursor-pointer shrink-0 ${
              activeFilterCount > 0
                ? 'bg-[#071A24] text-white border-[#071A24] shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100/80 text-slate-700 border-slate-200/80'
            }`}
            title="Buka opsi filter & urutan"
          >
            <SlidersHorizontal className={`w-4 h-4 ${activeFilterCount > 0 ? 'text-[#00D29E]' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#00D29E] text-[#071A24] text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: Category Chips & Removable Active Filter Tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'Semua', count: transactions?.length || 0 },
            { id: 'income', label: 'Uang Masuk', dot: 'bg-[#00D29E]' },
            { id: 'expense', label: 'Uang Keluar', dot: 'bg-rose-500' },
          ].map((tab) => {
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-3.5 py-1.5 min-h-[34px] rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-[#071A24] text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {tab.dot && <span className={`w-2 h-2 rounded-full ${tab.dot}`} />}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Active Filter Removable Tags */}
          {selectedPeriod !== 'this_month' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[34px] rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold shrink-0">
              <span>
                {selectedPeriod === 'all' && 'Periode: Semua'}
                {selectedPeriod === 'last_month' && 'Periode: Bulan Lalu'}
                {selectedPeriod === 'last_30_days' && 'Periode: 30 Hari'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPeriod('this_month')}
                className="hover:bg-amber-200/60 p-0.5 rounded-full cursor-pointer ml-0.5"
                title="Kembalikan ke bulan ini"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}



          {sortBy !== 'newest' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[34px] rounded-2xl bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold shrink-0">
              <span>
                {sortBy === 'oldest' && 'Urutan: Terlama'}
                {sortBy === 'highest' && 'Urutan: Terbesar'}
                {sortBy === 'lowest' && 'Urutan: Terkecil'}
              </span>
              <button
                type="button"
                onClick={() => setSortBy('newest')}
                className="hover:bg-blue-200/60 p-0.5 rounded-full cursor-pointer ml-0.5"
                title="Kembalikan urutan terbaru"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          )}

          {(activeFilterCount > 0 || search || filterType !== 'all' || selectedPeriod !== 'all') && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2.5 py-1 min-h-[34px] rounded-2xl text-[11px] font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0 cursor-pointer"
              title="Reset semua filter pencarian"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          4. BANKING TIMELINE: DIKELOMPOKKAN BERDASARKAN TANGGAL
         ========================================================================= */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonCard height="h-20" />
          <SkeletonCard height="h-20" />
          <SkeletonCard height="h-20" />
        </div>
      ) : filteredTransactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Tidak Ada Transaksi Ditemukan"
          description={
            search || filterType !== 'all' || selectedPeriod !== 'all'
              ? 'Tidak ada transaksi yang cocok dengan kriteria filter Anda.'
              : 'Belum ada transaksi yang tercatat dalam sistem.'
          }
          actionLabel="Reset Filter & Pencarian"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map((group) => {
            return (
              <div key={group.dateKey} className="space-y-1.5">
                {/* Date Header */}
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-2 pt-2">
                  <span>{getDateLabel(group.dateKey)}</span>
                  <span className="text-[11px] text-slate-400 font-semibold tabular-nums">
                    {group.items.length} transaksi
                  </span>
                </div>

                {/* Group Card with Hairline Dividers */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] divide-y divide-slate-100 overflow-hidden">
                  {group.items.map((tx) => {
                    const isVoid = tx.status === 'void';
                    const isIncome = tx.type === 'income';
                    const isTransfer = tx.type === 'transfer';
                    const itemTitle = tx.invoice_number || tx.category || 'Transaksi Kas';

                    // Badge styling
                    let statusBadge = null;
                    if (isVoid) {
                      statusBadge = (
                        <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                          Batal
                        </span>
                      );
                    }

                    return (
                      <div
                        key={tx.id}
                        onClick={() => setSelectedTxDetail(tx)}
                        className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 active:bg-slate-100 transition cursor-pointer ${
                          isVoid ? 'opacity-50 grayscale' : ''
                        }`}
                      >
                        {/* Left: Avatar + Title */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                              isIncome
                                ? 'bg-emerald-50 text-[#00D29E] border-emerald-200/60 shadow-xs'
                                : isTransfer
                                  ? 'bg-blue-50 text-blue-500 border-blue-200/60'
                                  : 'bg-rose-50 text-rose-500 border-rose-200/60'
                            }`}
                          >
                            {isIncome ? (
                              <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                            ) : isTransfer ? (
                              <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-sm text-[#071A24] truncate">
                                {itemTitle}
                              </span>
                              {statusBadge}
                            </div>

                            <div className="text-[11px] text-slate-400 font-medium truncate mt-0.5 flex items-center gap-1.5">
                              <span className="capitalize">{tx.category || tx.sub_type || tx.type}</span>
                              {tx.invoice_number && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-[10px]">{tx.invoice_number}</span>
                                </>
                              )}
                              {tx.notes && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[140px] sm:max-w-[220px]">"{tx.notes}"</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount & Status */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div
                              className={`font-black text-sm sm:text-base tabular-nums tracking-tight ${
                                isIncome
                                  ? 'text-[#00D29E]'
                                  : isTransfer
                                    ? 'text-slate-700'
                                    : 'text-[#071A24]'
                              }`}
                            >
                              {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(tx.total_amount)}
                            </div>


                          </div>

                          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Anti-Lag Reusable Pagination Load More Button */}
          <LoadMoreButton
            remainingCount={remainingTransactions}
            onClick={loadMoreTransactions}
          />
        </div>
      )}
      </>
      ) : (
        <CapitalRotationsView />
      )}

      {/* =========================================================================
          MODAL 1: CATAT TRANSAKSI (FLOWMINT REDESIGNED BOTTOM SHEET)
         ========================================================================= */}
      <BottomSheet
        isOpen={showTransactionForm}
        onClose={() => setShowTransactionForm(false)}
        title={
          <div className="flex items-center gap-2.5 text-[#071A24]">
            <div className="w-7 h-7 rounded-xl bg-[#00D29E]/20 text-[#00D29E] flex items-center justify-center">
              <Receipt className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-base">Catat Transaksi Komoditas</span>
          </div>
        }
        size="xl"
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          {/* Tipe Transaksi (Pemasukan / Pengeluaran) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Jenis Transaksi
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'income', label: 'Pemasukan (+)', icon: ArrowDownLeft, color: 'text-[#00D29E]' },
                { id: 'expense', label: 'Pengeluaran (-)', icon: ArrowUpRight, color: 'text-rose-500' },
              ].map((t) => {
                const Icon = t.icon;
                const isActive = txType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTxType(t.id);
                      if (t.id === 'expense' && entryMode === 'quick') {
                        setQuickCategory('BBM / Bensin');
                      } else if (t.id === 'income' && entryMode === 'quick') {
                        setQuickCategory('Penjualan Tunai');
                      }
                    }}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      isActive
                        ? 'bg-[#071A24] text-white border-[#071A24] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#00D29E]' : t.color} stroke-[2.5]`} />
                    <span className="text-xs font-bold">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Input: Kas Cepat vs Jual/Beli Komoditas Berstok */}
          <div>
            <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setEntryMode('quick')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  entryMode === 'quick'
                    ? 'bg-white text-[#071A24] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 stroke-[2.5]" />
                <span>Kas Cepat (Beban / Tunai)</span>
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('stock')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  entryMode === 'stock'
                    ? 'bg-white text-[#071A24] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Package className="w-3.5 h-3.5 text-[#00D29E] stroke-[2.5]" />
                <span>{txType === 'income' ? 'Penjualan Stok' : 'Kulakan / Beli Stok'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5 px-1">
              {entryMode === 'quick'
                ? '⚡ Cocok untuk bensin, makan, listrik, gaji, atau kas keluar/masuk harian tanpa barang stok.'
                : '📦 Terhubung dengan inventaris gudang & kartu mutasi stok komoditas.'}
            </p>
          </div>

          {/* Inti: Tanggal & Rekening Kas Utama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#071A24] mb-1">
                Tanggal Transaksi
              </label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="input-field tabular-nums rounded-2xl border-slate-200/80"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#071A24] mb-1">
                Akun Kas Usaha
              </label>
              <div className="min-h-[44px] px-3.5 rounded-2xl bg-slate-100/80 border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#00D29E]" />
                  <span className="text-xs sm:text-sm font-bold text-[#071A24]">
                    {primaryAccount?.name || 'Kas Utama'}
                  </span>
                </div>
                <span className="text-xs font-black text-emerald-600 tabular-nums">
                  Saldo: {formatCurrency(primaryAccount?.balance || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              A. MODE 1: KAS CEPAT (NOMINAL LANGSUNG - 3 DETIK SELESAI)
             ========================================================================= */}
          {entryMode === 'quick' && (
            <div className="space-y-3.5 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
              {/* Input Nominal Angka Besar */}
              <div>
                <label className="block text-xs font-bold text-[#071A24] mb-1">
                  Nominal {txType === 'income' ? 'Pemasukan' : 'Pengeluaran'} (Rp)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    autoFocus
                    min="1"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    placeholder="0"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xl sm:text-2xl font-black text-[#071A24] tabular-nums focus:bg-white focus:border-[#00D29E] focus:ring-2 focus:ring-[#00D29E]/20 transition"
                    required
                  />
                </div>
              </div>

              {/* Kategori Cepat (Pill Chips) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Pilih Kategori {txType === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(txType === 'expense'
                    ? [
                        'BBM / Bensin',
                        'Konsumsi / Makan',
                        'Operasional',
                        'Gaji & Upah',
                        'Listrik & Air',
                        'Servis & Servis',
                        'Lainnya',
                      ]
                    : [
                        'Penjualan Tunai',
                        'Pendapatan Jasa',
                        'Suntikan Modal',
                        'Pelunasan Piutang',
                        'Lainnya',
                      ]
                  ).map((cat) => {
                    const isSelected = quickCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setQuickCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#071A24] text-white border-[#071A24] shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {quickCategory === 'Lainnya' && (
                  <div className="mt-2 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Tuliskan nama kategori baru..."
                      className="input-field bg-white rounded-xl text-xs"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Keterangan Singkat */}
              <div>
                <label className="block text-xs font-bold text-[#071A24] mb-1">
                  Keterangan / Keperluan (Opsional)
                </label>
                <input
                  type="text"
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder={
                    txType === 'income'
                      ? 'Contoh: Pembayaran tunai pelanggan Toko Bu Siti'
                      : 'Contoh: Beli bensin motor pickup pengantaran barang'
                  }
                  className="input-field bg-white rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          {/* =========================================================================
              B. MODE 2: JUAL / BELI STOK KOMODITAS (DENGAN VALIDASI STOK KETAT)
             ========================================================================= */}
          {entryMode === 'stock' && (
            <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    {txType === 'income' ? 'Daftar Barang yang Dijual' : 'Daftar Barang yang Dibeli (Kulakan)'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {txType === 'income'
                      ? 'Barang akan memotong stok gudang otomatis.'
                      : 'Barang akan menambah stok & menghitung HPP otomatis.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="text-xs font-bold text-[#00D29E] hover:text-[#10B981] flex items-center gap-1 min-h-[36px] px-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Tambah Baris</span>
                </button>
              </div>

              {/* Alert Peringatan Jika Stok Kosong / Kurang Saat Penjualan */}
              {txType === 'income' && hasStockError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <strong className="font-black text-rose-800 block text-xs sm:text-sm">
                        PERINGATAN: Stok Tidak Cukup / Kosong!
                      </strong>
                      {stockValidationErrors.map((err, i) => (
                        <p key={i} className="text-rose-700 font-medium">
                          • {err.message}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Tombol Solusi Pintas: Langsung alihkan ke Beli Stok Masuk */}
                  <div className="pt-2 border-t border-rose-200 flex flex-wrap gap-2 items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setTxType('expense');
                        setEntryMode('stock');
                      }}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Alihkan ke Pembelian Stok Masuk Sekarang</span>
                    </button>
                  </div>
                </div>
              )}

              {lineItems.map((it, idx) => {
                const prod = items?.find((p) => String(p.id) === String(it.product_id));
                const isOutOfStock = prod && Number(prod.stock) <= 0;
                const isInsufficient = prod && Number(it.qty) > Number(prod.stock);

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl space-y-2.5 border transition ${
                      txType === 'income' && isOutOfStock
                        ? 'bg-rose-50/70 border-rose-300'
                        : txType === 'income' && isInsufficient
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      {/* Pilih Produk */}
                      <div className="sm:col-span-5">
                        <label className="block text-xs font-semibold text-slate-500 mb-1 sm:hidden">
                          Pilih Komoditas
                        </label>
                        <select
                          value={it.product_id}
                          onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                          className={`input-field bg-white rounded-xl text-xs sm:text-sm font-semibold ${
                            txType === 'income' && isOutOfStock ? 'border-rose-400 text-rose-900' : ''
                          }`}
                          required
                        >
                          <option value="">
                            {items && items.length > 0 ? 'Pilih Komoditas / Barang' : 'Belum ada barang (Tambah di menu Stok)'}
                          </option>
                          {items?.map((p) => {
                            const curStk = Number(p.stock) || 0;
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} {curStk <= 0 ? `[STOK KOSONG: 0 ${p.base_unit}]` : `(Stok: ${curStk} ${p.base_unit})`}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Qty & Satuan */}
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-slate-500 mb-1 sm:hidden">
                          Kuantitas ({it.unit || 'unit'})
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0.01"
                            step="any"
                            value={it.qty}
                            onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                            placeholder="Qty"
                            className="input-field bg-white tabular-nums rounded-xl text-xs sm:text-sm"
                            required
                          />
                          <span className="text-xs font-bold text-slate-600 shrink-0 px-1">
                            {it.unit || 'unit'}
                          </span>
                        </div>
                      </div>

                      {/* Harga Satuan */}
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-slate-500 mb-1 sm:hidden">
                          {txType === 'income' ? 'Harga Jual (Rp)' : 'Harga Beli (Rp)'}
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          value={it.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          placeholder="Harga Rp"
                          className="input-field bg-white tabular-nums rounded-xl text-xs sm:text-sm"
                          required
                        />
                      </div>

                      {/* Hapus Baris */}
                      <div className="sm:col-span-1 flex justify-end">
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                            title="Hapus Baris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-1 border-t border-slate-200/50">
                      {prod ? (
                        <span className={`text-[11px] font-semibold ${isOutOfStock ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                          Stok Saat Ini: <strong className="text-[#071A24]">{prod.stock} {prod.base_unit}</strong>
                          {txType === 'income' && !isOutOfStock && (
                            <span className="ml-1 text-slate-400">
                              (Sisa setelah jual: {Math.max(0, Number(prod.stock) - Number(it.qty))} {prod.base_unit})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Pilih barang untuk melihat stok</span>
                      )}
                      <div>
                        Subtotal: <strong className="text-[#071A24] font-black tabular-nums">{formatCurrency(it.subtotal)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Total Ringkasan Banner (FlowMint Midnight Card) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#071A24] to-[#0B2533] text-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-xs font-semibold text-slate-300">Total Nominal Transaksi</span>
              <p className="text-[11px] text-[#00D29E] font-medium">Auto-calculated</p>
            </div>
            <span className="text-2xl sm:text-3xl font-black text-[#00D29E] tabular-nums tracking-tight">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          {/* Lampiran Foto Nota (Sederhana Tanpa Toggle Bertingkat) */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#071A24] flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#00D29E]" />
                <span>Foto Bukti Nota (Opsional)</span>
              </span>
              {!receiptPreview && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-[#00D29E] hover:underline cursor-pointer"
                >
                  + Unggah Foto
                </button>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {receiptPreview ? (
              <div className="space-y-1.5 pt-1">
                <div className="relative w-full max-h-36 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center bg-black/5 p-1">
                  <img
                    src={receiptPreview}
                    alt="Nota Preview"
                    className="max-h-32 object-contain rounded-lg"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      setReceiptPreview('');
                    }}
                    className="text-xs text-rose-600 font-bold hover:underline py-1 px-2 cursor-pointer"
                  >
                    Hapus Foto
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowTransactionForm(false)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUploading || totalAmount <= 0 || (entryMode === 'stock' && hasStockError)}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-[#071A24] hover:bg-[#0B2533] disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-sm transition ios-spring-tap cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 text-[#00D29E] stroke-[3]" />
              <span>{isUploading ? 'Menyimpan...' : 'Simpan Transaksi'}</span>
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* =========================================================================
          MODAL 2: RECEIPT VIEWER
         ========================================================================= */}
      <BottomSheet
        isOpen={Boolean(viewingReceiptUrl)}
        onClose={() => setViewingReceiptUrl(null)}
        title={
          <div className="flex items-center gap-2 text-[#071A24]">
            <ImageIcon className="w-5 h-5 text-[#00D29E]" />
            <span className="font-extrabold">Foto Bukti Nota</span>
          </div>
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="max-h-[60vh] sm:max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-900 rounded-2xl p-2">
            <img
              src={viewingReceiptUrl}
              alt="Bukti Nota Transaksi"
              className="max-h-[55vh] sm:max-h-[65vh] object-contain rounded-xl shadow-xs"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2 text-xs text-slate-500">
            <span>Tersimpan di Cloud Bucket 'receipts'</span>
            <a
              href={viewingReceiptUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#00D29E] font-bold hover:underline inline-flex items-center gap-1 p-1"
            >
              <span>Buka Resolusi Penuh</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </BottomSheet>

      {/* =========================================================================
          MODAL 3: VOID TRANSACTION
         ========================================================================= */}
      <BottomSheet
        isOpen={Boolean(voidingTx)}
        onClose={() => setVoidingTx(null)}
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            <span className="font-extrabold">Batalkan (Void) Transaksi?</span>
          </div>
        }
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Apakah Anda yakin ingin membatalkan transaksi faktur{' '}
            <strong className="font-extrabold text-[#071A24]">{voidingTx?.invoice_number}</strong>?
            Stok barang dan saldo kas akan dibalikkan secara otomatis ke kondisi semula.
          </p>

          <div>
            <label className="block text-xs font-bold text-[#071A24] mb-1">
              Alasan Pembatalan
            </label>
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Contoh: Salah input kuantitas, dibatalkan pelanggan..."
              className="input-field rounded-2xl"
              required
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={isVoiding}
              onClick={() => {
                setVoidingTx(null);
                setVoidReason('');
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isVoiding}
              onClick={async () => {
                if (isVoiding || !voidingTx) return;
                setIsVoiding(true);
                try {
                  await voidTransaction(voidingTx.id, voidReason || 'Dibatalkan oleh pengguna');
                  addNotification({
                    message: `Faktur ${voidingTx.invoice_number || ''} berhasil dibatalkan. Stok dan kas telah disinkronkan kembali.`,
                    type: 'info',
                  });
                  setVoidingTx(null);
                  setVoidReason('');
                } catch (err) {
                  const friendly = translateErrorMessage(err, 'Gagal membatalkan transaksi.');
                  addNotification({ message: friendly, type: 'error' });
                } finally {
                  setIsVoiding(false);
                }
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isVoiding ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Membatalkan...</span>
                </>
              ) : (
                <span>Konfirmasi Batalkan</span>
              )}
            </button>
          </div>
        </div>
      </BottomSheet>


      {/* =========================================================================
          MODAL FILTER & URUTKAN TRANSAKSI (Bank-Grade BottomSheet)
         ========================================================================= */}
      <BottomSheet
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter & Urutkan Transaksi"
        size="sm"
      >
        <div className="space-y-5 p-1">
          {/* 1. Periode Waktu */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-extrabold text-[#071A24] uppercase tracking-wider">
                Periode Waktu
              </label>
              {selectedPeriod !== 'this_month' && (
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('this_month')}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'this_month', label: 'Bulan Ini' },
                { id: 'last_month', label: 'Bulan Lalu' },
                { id: 'last_30_days', label: '30 Hari Terakhir' },
                { id: 'all', label: 'Semua Waktu' },
              ].map((opt) => {
                const isSelected = selectedPeriod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedPeriod(opt.id)}
                    className={`p-3 rounded-2xl text-xs font-bold text-left transition border cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#071A24] text-white border-[#071A24] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#00D29E]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Urutkan Berdasarkan */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-extrabold text-[#071A24] uppercase tracking-wider">
                Urutkan Transaksi
              </label>
              {sortBy !== 'newest' && (
                <button
                  type="button"
                  onClick={() => setSortBy('newest')}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'newest', label: 'Terbaru' },
                { id: 'oldest', label: 'Terlama' },
                { id: 'highest', label: 'Nominal Terbesar' },
                { id: 'lowest', label: 'Nominal Terkecil' },
              ].map((opt) => {
                const isSelected = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id)}
                    className={`p-3 rounded-2xl text-xs font-bold text-left transition border cursor-pointer flex items-center justify-between ${isSelected
                        ? 'bg-[#071A24] text-white border-[#071A24] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                      }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#00D29E]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setSelectedPeriod('this_month');
                setSortBy('newest');
              }}
              className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFilterModal(false)}
              className="flex-1 py-3 rounded-2xl bg-[#071A24] hover:bg-[#0B2533] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4 text-[#00D29E]" />
              <span>Terapkan</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* =========================================================================
          MODAL 4: STRUK TRANSAKSI DIGITAL (Digital Bank Receipt BottomSheet)
         ========================================================================= */}
      <BottomSheet
        isOpen={Boolean(selectedTxDetail)}
        onClose={() => {
          setSelectedTxDetail(null);
          setCopiedInvoice(false);
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center">
              <Receipt className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-base text-[#071A24]">
              Detail Mutasi Transaksi
            </span>
          </div>
        }
        size="md"
      >
        {selectedTxDetail && (() => {
          const tx = selectedTxDetail;
          const isIncome = tx.type === 'income';
          const isTransfer = tx.type === 'transfer';
          const isVoid = tx.status === 'void';
          const accountObj = accounts?.find((a) => a.id === tx.account_id) || primaryAccount;

          return (
            <div className="space-y-4 p-1">
              {/* Slip Hero: Big Amount + Status */}
              <div className="text-center py-3.5 px-4 bg-slate-50/80 rounded-3xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 block mb-1">
                  Nominal Transaksi
                </span>
                <div
                  className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tight ${
                    isIncome
                      ? 'text-[#00D29E]'
                      : isTransfer
                        ? 'text-slate-800'
                        : 'text-[#071A24]'
                  }`}
                >
                  {isIncome ? '+' : isTransfer ? '' : '-'}{formatCurrency(tx.total_amount)}
                </div>

                <div className="flex items-center justify-center gap-2 mt-2">
                  {isVoid ? (
                    <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                      Transaksi Dibatalkan (Void)
                    </span>
                  ) : (
                    <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Lunas / Tunai Langsung
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-400 font-medium mt-1.5">
                  {formatDatetime(tx.date)}
                </div>
              </div>

              {/* Inset Bank Slip Details */}
              <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 text-xs overflow-hidden">
                {/* Faktur / Referensi */}
                <div className="p-3 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">No. Referensi / Faktur</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#071A24]">
                      {tx.invoice_number || '-'}
                    </span>
                    {tx.invoice_number && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(tx.invoice_number);
                          setCopiedInvoice(true);
                          setTimeout(() => setCopiedInvoice(false), 2000);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                        title="Salin nomor faktur"
                      >
                        {copiedInvoice ? (
                          <Check className="w-3.5 h-3.5 text-[#00D29E]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>



                {/* Jenis & Kategori */}
                <div className="p-3 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Jenis & Kategori</span>
                  <span className="font-bold text-[#071A24] capitalize text-right">
                    {tx.type === 'income' ? 'Pemasukan' : tx.type === 'expense' ? 'Pengeluaran' : 'Transfer Kas'} • {tx.category || tx.sub_type || '-'}
                  </span>
                </div>

                {/* Rekening Kas */}
                <div className="p-3 flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold">
                    {isTransfer ? 'Dari Rekening' : 'Rekening Kas'}
                  </span>
                  <span className="font-bold text-[#071A24] text-right">
                    {accountObj?.name || 'Kas Tunai'}
                  </span>
                </div>



                {/* Catatan */}
                {tx.notes && (
                  <div className="p-3 space-y-1">
                    <span className="text-slate-500 font-semibold block">Catatan Transaksi</span>
                    <p className="text-slate-700 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      "{tx.notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* Rincian Komoditas (Line Items) if any */}
              {Array.isArray(tx.items) && tx.items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Rincian Komoditas ({tx.items.length} Item)
                  </span>
                  <div className="bg-slate-50/80 rounded-2xl border border-slate-200/70 divide-y divide-slate-100 overflow-hidden text-xs">
                    {tx.items.map((it, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#071A24]">{it.name || 'Barang'}</div>
                          <div className="text-[11px] text-slate-400">
                            {it.qty} {it.unit || ''} × {formatCurrency(it.unit_price)}
                          </div>
                        </div>
                        <div className="font-black text-[#071A24] tabular-nums">
                          {formatCurrency(it.subtotal)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bukti Nota Foto Thumbnail if any */}
              {tx.receipt_url && (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white border overflow-hidden shrink-0">
                      <img src={tx.receipt_url} alt="Bukti nota" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#071A24]">Foto Bukti Nota</div>
                      <div className="text-[11px] text-slate-400">Tersimpan di arsip digital</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingReceiptUrl(tx.receipt_url)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Buka Foto
                  </button>
                </div>
              )}

              {/* Action Buttons in Receipt */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {isVoid ? (
                    <button
                      type="button"
                      disabled={isDeletingTx}
                      onClick={async () => {
                        if (!window.confirm(`Hapus permanen faktur ${tx.invoice_number}? Data akan dihapus selamanya dari sistem dan Supabase Cloud.`)) return;
                        setIsDeletingTx(true);
                        try {
                          await deleteTransaction(tx.id);
                          addNotification({
                            message: `Faktur ${tx.invoice_number} berhasil dihapus permanen.`,
                            type: 'info',
                          });
                          setSelectedTxDetail(null);
                        } catch (err) {
                          const friendly = translateErrorMessage(err, 'Gagal menghapus transaksi.');
                          addNotification({ message: friendly, type: 'error' });
                        } finally {
                          setIsDeletingTx(false);
                        }
                      }}
                      className="flex-1 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-600 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isDeletingTx ? 'Menghapus...' : 'Hapus Permanen'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setVoidingTx(tx);
                        setSelectedTxDetail(null);
                      }}
                      className="flex-1 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Batalkan Transaksi (Void)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedTxDetail(null)}
                    className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </BottomSheet>


    </div>
  );
}
