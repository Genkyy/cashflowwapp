import { useState, useMemo } from 'react';
import { useLiveQuery } from '../../hooks/useLiveQuery.js';
import { db } from '../../lib/db.js';
import { formatCurrency, formatDate } from '../../lib/formatters.js';
import { useAppStore } from '../../lib/store.js';
import {
  Wallet,
  TrendingUp,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Clock,
  CheckCircle2,
  Sparkles,
  Calendar,
  ChevronDown,
  Check
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { SkeletonCard } from '../ui/Skeleton.jsx';

/**
 * FlowMint-style Modern Dashboard & Insights View
 * Accurately matching the uploaded UI design:
 * - Left Screen: FlowMint Dashboard (Dark Navy Wave Hero, Cash Flow Area Chart, AI Insight, Bills & Spending)
 * - Right Screen: FlowMint Insights (Financial Health Score, Weekly Bar Comparison, Savings Progress, Top Insights)
 */
export default function DashboardView() {
  const {
    setShowTransactionForm,
    setActiveTab,
    setDefaultTransactionType,
    setShowStockForm,
  } = useAppStore();

  const [isBalanceHidden, setIsBalanceHidden] = useState(false);

  // Dynamic Period Filter for Cash Flow
  const [periodFilter, setPeriodFilter] = useState('this_month'); // 'this_month' | 'last_month' | 'last_30_days' | 'all'
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const periodLabelMap = {
    this_month: 'Bulan Ini',
    last_month: 'Bulan Lalu',
    last_30_days: '30 Hari',
    all: 'Semua Waktu',
  };

  // 1. Live Data Queries
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const transactions = useLiveQuery(
    () => db.transactions.where('status').notEqual('void').toArray(),
    []
  );
  const items = useLiveQuery(() => db.items.toArray(), []);
  const batches = useLiveQuery(() => db.stock_batches.toArray(), []);
  const operationalNotes = useLiveQuery(() => db.operational_notes.toArray(), [], []);
  const capitalRotations = useLiveQuery(
    () => (db.capital_rotations ? db.capital_rotations.toArray() : []),
    []
  );

  const isLoading = accounts === undefined || transactions === undefined || items === undefined;

  // Capital rotation calculations (CV Amanah Barokah Waiting Capital in Field)
  const waitingRotations = (capitalRotations || []).filter((r) => r.status === 'waiting');
  const waitingRotationsCount = waitingRotations.length;
  const waitingModalTotal = waitingRotations.reduce(
    (sum, r) => sum + (Number(r.capital_amount) || 0),
    0
  );

  // 2. Calculations
  const totalBalance = (accounts || []).reduce(
    (sum, a) => sum + (Number(a.balance) || 0),
    0
  );

  const totalStockValuation = (items || []).reduce(
    (sum, it) => sum + (Number(it.stock) || 0) * (Number(it.hpp) || 0),
    0
  );

  const [now] = useState(() => new Date());
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Dynamic Cash Flow Calculation reacting to periodFilter (Accurate Real Cash In/Out)
  const cashflowMetrics = useMemo(() => {
    let income = 0;
    let expense = 0;

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const checkPeriodMatch = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (periodFilter === 'this_month') {
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      if (periodFilter === 'last_month') {
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      }
      if (periodFilter === 'last_30_days') {
        return d.getTime() >= thirtyDaysAgo.getTime();
      }
      return true; // 'all'
    };

    (transactions || []).forEach((t) => {
      if (t.status === 'void' || t.type === 'transfer') return;

      if (checkPeriodMatch(t.date)) {
        const amt = Number(t.paid_amount || t.total_amount) || 0;
        if (t.type === 'income') {
          income += amt;
        } else if (t.type === 'expense') {
          expense += amt;
        }
      }
    });

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [transactions, periodFilter, currentMonth, currentYear]);

  // Backward compatible variables
  const monthlyIncome = cashflowMetrics.income;
  const monthlyExpense = cashflowMetrics.expense;
  const netCashflow = cashflowMetrics.net;

  // Operational Reminders & Notes for Today
  const todayNotes = useMemo(() => {
    return (operationalNotes || []).filter((n) => {
      if (n.is_completed) return false;
      if (!n.date) return true;
      return n.date.slice(0, 10) <= todayStr;
    });
  }, [operationalNotes, todayStr]);

  // Operational alerts
  const lowStockItems = (items || []).filter(
    (it) => Number(it.stock) <= (Number(it.min_stock) || 0)
  );

  const expiringBatches = (batches || []).filter((b) => {
    if (!b.expiry_date || b.status !== 'active') return false;
    const diffDays = Math.ceil(
      (new Date(b.expiry_date).getTime() - now.getTime()) / (1000 * 3600 * 24)
    );
    return diffDays <= 7;
  });

  // Recent 5 Cash Transactions (Pure Cashflow - No Debt/Tempo)
  const recentTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((tx) => ({
        ...tx,
        contactName: tx.category || tx.invoice_number || 'Transaksi Kas',
      }));
  }, [transactions]);

  // Dynamic Cashflow Curve Data based on real transactions in the chosen period
  const cashflowTimelineData = useMemo(() => {
    const suffix = periodFilter === 'last_month' ? 'Lalu' : '';
    const weeks = [
      { date: `Mg 1 ${suffix}`.trim(), income: 0, expense: 0 },
      { date: `Mg 2 ${suffix}`.trim(), income: 0, expense: 0 },
      { date: `Mg 3 ${suffix}`.trim(), income: 0, expense: 0 },
      { date: `Mg 4 ${suffix}`.trim(), income: 0, expense: 0 },
    ];

    if (!transactions || transactions.length === 0) {
      return weeks;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const checkPeriodMatch = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (periodFilter === 'this_month') {
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      if (periodFilter === 'last_month') {
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      }
      if (periodFilter === 'last_30_days') {
        return d.getTime() >= thirtyDaysAgo.getTime();
      }
      return true;
    };

    transactions.forEach((tx) => {
      if (tx.status === 'void' || !checkPeriodMatch(tx.date)) return;
      const day = new Date(tx.date).getDate();
      const weekIdx = Math.min(Math.floor((day - 1) / 7), 3);
      const amt = Number(tx.paid_amount || tx.total_amount) || 0;
      if (tx.type === 'income') {
        weeks[weekIdx].income += amt;
      } else if (tx.type === 'expense') {
        weeks[weekIdx].expense += amt;
      }
    });

    return weeks;
  }, [transactions, periodFilter, currentMonth, currentYear]);

  // Real Category Breakdown Data (Donut Chart)
  const categoryData = useMemo(() => {
    if (!transactions || transactions.length === 0 || monthlyExpense === 0) return [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    const checkPeriodMatch = (dateStr) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (periodFilter === 'this_month') {
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }
      if (periodFilter === 'last_month') {
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      }
      if (periodFilter === 'last_30_days') {
        return d.getTime() >= thirtyDaysAgo.getTime();
      }
      return true;
    };

    const catMap = new Map();
    transactions.forEach((tx) => {
      if (tx.status === 'void' || tx.type !== 'expense' || !checkPeriodMatch(tx.date)) return;
      const cat = tx.category || tx.sub_type || 'Operasional';
      const amt = Number(tx.paid_amount || tx.total_amount) || 0;
      catMap.set(cat, (catMap.get(cat) || 0) + amt);
    });

    if (catMap.size === 0) return [];

    const colors = ['#00D29E', '#0A2533', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6'];
    let colorIdx = 0;
    const result = [];
    catMap.forEach((amt, name) => {
      const val = monthlyExpense > 0 ? Math.round((amt / monthlyExpense) * 100) : 0;
      result.push({
        name,
        amount: amt,
        value: val,
        color: colors[colorIdx % colors.length],
      });
      colorIdx++;
    });

    return result;
  }, [transactions, monthlyExpense, periodFilter, currentMonth, currentYear]);

  // Greeting by hour
  const greetingText = useMemo(() => {
    const hour = now.getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  }, [now]);

  const handleQuickAction = (actionType) => {
    if (actionType === 'stock') {
      setActiveTab('stock');
      setShowStockForm(true);
    } else {
      setDefaultTransactionType(actionType);
      setActiveTab('transactions');
      setShowTransactionForm(true);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <SkeletonCard height="h-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard height="h-64" />
          <SkeletonCard height="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-6">
      {/* =========================================================================
          TOP BAR: GREETING + SCREEN SWITCHER
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Greeting & Date */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#00D29E] font-bold text-xs tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D29E] animate-pulse" />
              Dashboard
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#071A24]">
            {greetingText}, CV Amanah Barokah 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Arus kas & komoditas real-time.
          </p>
        </div>

        {/* Right: Screen View Switcher */}
        {/* Right: Quick Action to Laporan Keuangan */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition ios-spring-tap cursor-pointer"
            title="Buka Laporan Keuangan Lengkap"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#00D29E]" />
            <span>Laporan Keuangan</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          BERANDA UTAMA (DASHBOARD)
         ========================================================================= */}
      <div className="space-y-5 animate-in fade-in duration-200">
        {/* 1. HERO TOTAL BALANCE CARD (FlowMint Midnight Signature Card) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#071A24] via-[#0B2533] to-[#04121A] text-white p-6 sm:p-7 border border-slate-800/80 shadow-lg shadow-slate-950/15">
          {/* Luminous Glowing Curved Waves Background (FlowMint Signature SVG) */}
          <div className="absolute inset-0 pointer-events-none opacity-45 overflow-hidden">
            <svg
              className="w-full h-full"
              viewBox="0 0 500 200"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M0 160 C 150 160, 200 40, 350 70 C 420 85, 460 20, 500 30 L 500 200 L 0 200 Z"
                fill="url(#flowMintGradient)"
                opacity="0.25"
              />
              <path
                d="M0 160 C 150 160, 200 40, 350 70 C 420 85, 460 20, 500 30"
                stroke="#00D29E"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="flowMintGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00D29E" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0B2533" stopOpacity="0.0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Floating Mint Coin Badge on the Right */}
          <div className="absolute right-6 top-6 sm:right-8 sm:top-8 w-11 h-11 rounded-full bg-[#00D29E]/15 border border-[#00D29E]/40 backdrop-blur-md flex items-center justify-center text-[#00D29E] shadow-sm">
            <span className="font-extrabold text-sm tracking-tight">Rp</span>
          </div>

          <div className="relative z-10">
            {/* Card Label & Eye Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300/90 tracking-wide">
                Total balance
              </span>
              <button
                type="button"
                onClick={() => setIsBalanceHidden(!isBalanceHidden)}
                className="p-1 text-slate-400 hover:text-[#00D29E] transition cursor-pointer"
                title={isBalanceHidden ? 'Tampilkan Saldo' : 'Sembunyikan Saldo'}
              >
                {isBalanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Amount Display */}
            <div className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight tabular-nums text-white">
              {isBalanceHidden ? 'Rp ••••••••' : formatCurrency(totalBalance)}
            </div>

            {/* Subtitle / Trend Badge & Modal Berjalan Pill */}
            <div className="mt-2.5 flex items-center gap-2.5 flex-wrap text-xs font-bold">
              <div className="flex items-center gap-1.5 text-[#00D29E]">
                <span>↑ 6.4%</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </div>
              {waitingModalTotal > 0 && (
                <div
                  onClick={() => setActiveTab('transactions')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold cursor-pointer hover:bg-amber-400/30 transition"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Modal Berjalan: {formatCurrency(waitingModalTotal)} ({waitingRotationsCount} Proyek)</span>
                </div>
              )}
            </div>

            {/* Fast Action Buttons row inside card */}
            <div className="grid grid-cols-3 gap-2.5 mt-6 pt-5 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => handleQuickAction('income')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-white/10 hover:bg-[#00D29E] hover:text-[#071A24] text-white border border-white/10 font-bold text-xs backdrop-blur-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Pemasukan</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('expense')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-white/10 hover:bg-rose-500 hover:text-white text-white border border-white/10 font-bold text-xs backdrop-blur-xs transition cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Pengeluaran</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickAction('stock')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-white/10 hover:bg-amber-400 hover:text-slate-900 text-white border border-white/10 font-bold text-xs backdrop-blur-xs transition cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Stok</span>
              </button>
            </div>
          </div>
        </div>

        {/* PENGINGAT & AGENDA HARI INI BANNER */}
        {todayNotes.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-50 border border-emerald-300/80 rounded-3xl p-4 sm:p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#00D29E] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
                  <Calendar className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-[#071A24] uppercase tracking-wide">
                    Pengingat & Agenda Hari Ini
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {todayNotes.length} tugas operasional perlu diselesaikan
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 transition cursor-pointer shrink-0"
              >
                Kelola di Pengaturan
              </button>
            </div>

            <div className="divide-y divide-emerald-200/50 bg-white/90 rounded-2xl border border-emerald-200/70 overflow-hidden">
              {todayNotes.slice(0, 3).map((note) => (
                <div key={note.id} className="p-3 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-extrabold text-[#071A24] truncate">{note.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {note.category || 'Umum'} • Prioritas: <strong className={note.priority === 'high' ? 'text-rose-600' : 'text-slate-600'}>{note.priority === 'high' ? 'Tinggi' : note.priority === 'medium' ? 'Sedang' : 'Rendah'}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await db.operational_notes.update(note.id, {
                        is_completed: 1,
                        completed_at: new Date().toISOString(),
                      });
                    }}
                    className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-[#00D29E] text-emerald-800 hover:text-[#071A24] font-bold text-[11px] transition cursor-pointer shrink-0 border border-emerald-200/60"
                    title="Tandai selesai"
                  >
                    Selesai
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* CV AMANAH BAROKAH: MODAL BERJALAN (WAITING) NOTIFICATION BANNER */}
        {waitingRotationsCount > 0 && (
          <div
            onClick={() => setActiveTab('transactions')}
            className="bg-gradient-to-r from-amber-500/10 via-amber-400/15 to-emerald-500/10 border border-amber-300/80 rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:border-amber-400 transition-all shadow-xs"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Siklus Modal Lapangan ({waitingRotationsCount} Proyek)
                  </span>
                  <span className="text-xs text-amber-900/70 font-semibold hidden sm:inline">
                    Status: Waiting
                  </span>
                </div>
                <div className="text-lg sm:text-xl font-black text-[#071A24] tracking-tight tabular-nums mt-0.5">
                  {formatCurrency(waitingModalTotal)}
                </div>
                <p className="text-xs text-slate-600 truncate">
                  Total modal yang sedang berputar di lapangan (Susu MBG, Telur, Minyak, dll.)
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-white/90 px-3.5 py-2 rounded-2xl border border-amber-200 hover:bg-white transition shadow-2xs">
              <span>Lihat Proyek</span>
              <ArrowUpRight className="w-4 h-4 text-amber-700" />
            </div>
          </div>
        )}

        {/* 2. CASH FLOW INSIGHT CARD (FlowMint Smooth Spline Card) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          {/* Header: Title + Dropdown filter */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold text-[#071A24] tracking-tight">
              Cash flow insight
            </h2>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/90 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                <span>{periodLabelMap[periodFilter] || 'Bulan Ini'}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${showPeriodDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showPeriodDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowPeriodDropdown(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-40 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                    {[
                      { id: 'this_month', label: 'Bulan Ini' },
                      { id: 'last_month', label: 'Bulan Lalu' },
                      { id: 'last_30_days', label: '30 Hari' },
                      { id: 'all', label: 'Semua Waktu' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setPeriodFilter(opt.id);
                          setShowPeriodDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition cursor-pointer ${periodFilter === opt.id
                          ? 'bg-[#071A24] text-white'
                          : 'text-slate-700 hover:bg-slate-100'
                          }`}
                      >
                        <span>{opt.label}</span>
                        {periodFilter === opt.id && <Check className="w-3.5 h-3.5 text-[#00D29E]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Metrics Breakdown (Income, Expenses, Net Cash Flow) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 pb-3 border-b border-slate-100">
            {/* Income */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#00D29E]" />
                <span>Income</span>
              </div>
              <div className="text-sm sm:text-base lg:text-lg font-black text-[#00D29E] tracking-tight tabular-nums mt-0.5">
                {formatCurrency(monthlyIncome)}
              </div>
            </div>

            {/* Expenses */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-[#0A2533]" />
                <span>Expenses</span>
              </div>
              <div className="text-sm sm:text-base lg:text-lg font-black text-[#0A2533] tracking-tight tabular-nums mt-0.5">
                {formatCurrency(monthlyExpense)}
              </div>
            </div>

            {/* Net Cash Flow */}
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium">Net cash flow</div>
              <div className="text-sm sm:text-base lg:text-lg font-black text-[#00D29E] tracking-tight tabular-nums mt-0.5">
                {netCashflow >= 0 ? '+' : '-'}{formatCurrency(Math.abs(netCashflow))}
              </div>
            </div>
          </div>

          {/* Recharts Area Chart with FlowMint Smooth Spline & Gradients */}
          <div className="h-44 sm:h-52 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowTimelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="mintArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D29E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00D29E" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="navyArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A2533" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0A2533" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  stroke="#94A3B8"
                  fontSize={11}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  stroke="#94A3B8"
                  fontSize={10}
                  tickFormatter={(val) => `${(val / 1000000).toFixed(0)}jt`}
                />
                <Tooltip
                  formatter={(val) => [formatCurrency(val), '']}
                  contentStyle={{
                    backgroundColor: '#071A24',
                    color: '#FFFFFF',
                    borderRadius: '1rem',
                    border: 'none',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#00D29E"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#mintArea)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#0A2533"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#navyArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. AI INSIGHT BANNER (Tautkan langsung ke Laporan Keuangan) */}
        <div
          onClick={() => setActiveTab('reports')}
          className="rounded-2xl bg-gradient-to-r from-[#F0FDF9] to-[#ECFDF5] border border-[#A7F3D0]/70 p-4 sm:p-4.5 flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition cursor-pointer group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00D29E] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition">
              <Sparkles className="w-5 h-5 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                AI Insight • Analisa Keuangan
              </div>
              <div className="text-xs sm:text-sm font-semibold text-[#071A24] truncate">
                {lowStockItems.length > 0
                  ? `Perhatian: ${lowStockItems[0].name} tersisa ${lowStockItems[0].stock} ${lowStockItems[0].base_unit}. Klik untuk laporan & restok.`
                  : 'Klik untuk meninjau analisa laba rugi, valuasi stok, dan arus kas riil komoditas.'}
              </div>
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#00D29E] group-hover:translate-x-0.5 transition shrink-0" />
        </div>

        {/* 4. TWO-COLUMN SECTION: UPCOMING BILLS & SPENDING BY CATEGORY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Card: Upcoming Bills */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h3 className="text-base font-bold text-[#071A24] tracking-tight">
                    Transaksi Kas Terkini
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs font-bold text-[#00D29E] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Lihat Buku Kas</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((item, idx) => {
                    const isIncome = item.type === 'income';
                    const amt = Number(item.paid_amount || item.total_amount) || 0;

                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => setActiveTab('transactions')}
                        className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isIncome
                              ? 'bg-emerald-50 text-[#00D29E]'
                              : 'bg-rose-50 text-rose-600'
                            }`}>
                            {isIncome ? (
                              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#071A24] truncate">
                              {item.contactName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {formatDate(item.date, 'short')} • {isIncome ? 'Uang Masuk' : 'Uang Keluar'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className={`text-xs font-black tabular-nums ${isIncome ? 'text-[#00D29E]' : 'text-slate-900'
                            }`}>
                            {isIncome ? `+${formatCurrency(amt)}` : `-${formatCurrency(amt)}`}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-slate-400">
                    <CheckCircle2 className="w-7 h-7 text-[#00D29E] mx-auto mb-1.5 opacity-90" />
                    <p className="text-xs font-bold text-slate-700">Belum Ada Transaksi Kas</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Catat uang masuk atau keluar untuk melihat riwayat.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Card: Spending by category (Donut Chart & Legend) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-[#071A24] tracking-tight mb-4">
                Spending by category
              </h3>

              {categoryData.length > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  {/* Recharts Pie Donut */}
                  <div className="w-32 h-32 sm:w-36 sm:h-36 shrink-0 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          innerRadius="65%"
                          outerRadius="95%"
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* FlowMint Legend with percentages */}
                  <div className="space-y-1.5 flex-1 min-w-0 text-xs">
                    {categoryData.map((cat, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="text-slate-600 font-medium truncate">{cat.name}</span>
                        </div>
                        <span className="font-bold text-[#071A24] tabular-nums shrink-0">
                          {cat.value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <CheckCircle2 className="w-7 h-7 text-[#00D29E] mx-auto mb-1.5 opacity-90" />
                  <p className="text-xs font-bold text-slate-700">Belum Ada Pengeluaran</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Pengeluaran riil akan terkelompokkan otomatis di sini.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 5. FLOWMINT DARK SIGNATURE ACTION BUTTON: "Plan my month" */}
        <div>
          <button
            type="button"
            onClick={() => {
              setDefaultTransactionType('income');
              setActiveTab('transactions');
              setShowTransactionForm(true);
            }}
            className="w-full py-4 rounded-2xl bg-[#071A24] hover:bg-[#0B2533] active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-slate-950/15 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#00D29E]" />
            <span>Plan my month</span>
          </button>
        </div>

        {/* 6. RECENT TRANSACTIONS (Maksimal 5 Transaksi Terkini) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00D29E]" />
              <h3 className="text-base font-bold text-[#071A24] tracking-tight">
                5 Transaksi Terkini
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className="text-xs font-bold text-[#00D29E] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Lihat Semua ({transactions?.length || 0})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {(transactions || []).slice(0, 5).map((tx) => {
              const isIncome = tx.type === 'income';
              return (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${isIncome
                        ? 'bg-emerald-50 text-[#00D29E]'
                        : 'bg-rose-50 text-rose-500'
                        }`}
                    >
                      {isIncome ? <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" /> : <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-[#071A24] truncate">
                        {tx.category || tx.invoice_number || 'Transaksi'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatDate(tx.date, 'short')}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xs sm:text-sm font-black tabular-nums ${isIncome ? 'text-[#00D29E]' : 'text-slate-800'
                        }`}
                    >
                      {isIncome ? '+' : '-'}{formatCurrency(tx.total_amount)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">
                      {tx.payment_status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
