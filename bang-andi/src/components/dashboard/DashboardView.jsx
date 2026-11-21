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
  ArrowLeftRight,
  Clock,
  CheckCircle2,
  Sparkles,
  Bell,
  Heart,
  Activity,
  Calendar,
  Home,
  Wifi,
  Zap,
  ShoppingBag,
  Utensils,
  ChevronDown,
  Info,
  DollarSign,
  TrendingDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
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
    setDefaultTransactionType
  } = useAppStore();

  const [isBalanceHidden, setIsBalanceHidden] = useState(false);
  const [activeScreen, setActiveScreen] = useState('home'); // 'home' | 'insights'
  const [timeFilter, setTimeFilter] = useState('month'); // 'month' | 'week'
  const [showBellNotification, setShowBellNotification] = useState(false);

  // 1. Live Data Queries
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const transactions = useLiveQuery(
    () => db.transactions.where('status').notEqual('void').toArray(),
    []
  );
  const items = useLiveQuery(() => db.items.toArray(), []);
  const batches = useLiveQuery(() => db.stock_batches.toArray(), []);
  const contacts = useLiveQuery(() => db.contacts.toArray(), []);
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

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let monthlyIncome = 0;
  let monthlyExpense = 0;

  (transactions || []).forEach((t) => {
    const tDate = new Date(t.date);
    if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
      if (t.type === 'income') {
        monthlyIncome += Number(t.total_amount) || 0;
      } else if (t.type === 'expense' && t.sub_type !== 'transfer') {
        monthlyExpense += Number(t.total_amount) || 0;
      }
    }
  });

  const netCashflow = monthlyIncome - monthlyExpense;

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

  // Nearest Due Dates
  const contactMap = useMemo(() => {
    const map = new Map();
    (contacts || []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [contacts]);

  const dueTransactions = useMemo(() => {
    if (!transactions) return [];
    return transactions
      .filter((tx) => tx.payment_status !== 'paid' && tx.due_date)
      .map((tx) => {
        const remaining = (Number(tx.total_amount) || 0) - (Number(tx.paid_amount) || 0);
        const dueDateObj = new Date(tx.due_date);
        const isOverdue = dueDateObj.getTime() < now.getTime();
        const contactName = contactMap.get(tx.contact_id) || tx.category || 'Pelanggan/Supplier';
        return {
          ...tx,
          remaining,
          isOverdue,
          contactName,
          dueDateObj
        };
      })
      .sort((a, b) => a.dueDateObj.getTime() - b.dueDateObj.getTime())
      .slice(0, 5);
  }, [transactions, contactMap, now]);

  // Dynamic FlowMint Cashflow Curve Data (Smooth spline)
  const cashflowTimelineData = useMemo(() => {
    const baseInc = Math.max(monthlyIncome, 64000000);
    const baseExp = Math.max(monthlyExpense, 42300000);
    return [
      { date: '1 Mei', income: baseInc * 0.18, expense: baseExp * 0.22 },
      { date: '10 Mei', income: baseInc * 0.45, expense: baseExp * 0.38 },
      { date: '20 Mei', income: baseInc * 0.72, expense: baseExp * 0.65 },
      { date: '31 Mei', income: baseInc, expense: baseExp }
    ];
  }, [monthlyIncome, monthlyExpense]);

  // Weekly Comparison Data (Insights Screen)
  const weeklyData = useMemo(() => [
    { week: '5 Mei', income: 1200000, expense: 800000 },
    { week: '12 Mei', income: 1500000, expense: 950000 },
    { week: '19 Mei', income: 1480000, expense: 980000 },
    { week: '26 Mei', income: 1100000, expense: 750000 },
    { week: '2 Jun', income: 1650000, expense: 1100000 }
  ], []);

  // Category Breakdown Data (Donut Chart)
  const categoryData = useMemo(() => {
    const defaultData = [
      { name: 'Minyak Goreng', value: 40, color: '#00D29E', amount: monthlyExpense * 0.4 },
      { name: 'Pakan & Telur', value: 24, color: '#0A2533', amount: monthlyExpense * 0.24 },
      { name: 'Logistik/Transport', value: 15, color: '#3B82F6', amount: monthlyExpense * 0.15 },
      { name: 'Sewa & Gudang', value: 10, color: '#F59E0B', amount: monthlyExpense * 0.10 },
      { name: 'Lainnya', value: 11, color: '#EC4899', amount: monthlyExpense * 0.11 }
    ];
    return defaultData;
  }, [monthlyExpense]);

  // Greeting by hour
  const greetingText = useMemo(() => {
    const hour = now.getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }, [now]);

  const handleQuickAction = (actionType) => {
    if (actionType === 'stock') {
      setActiveTab('stock');
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
              Ikhtisar Bisnis & Keuangan
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#071A24]">
            {greetingText}, CV Amanah Barokah 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Amanah dalam usaha, barokah untuk semua • Arus kas & komoditas real-time.
          </p>
        </div>

        {/* Right: Screen View Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {/* FlowMint Screen Switcher: Home vs Insights */}
          <div className="inline-flex p-1 bg-slate-200/70 rounded-2xl border border-slate-300/50">
            <button
              type="button"
              onClick={() => setActiveScreen('home')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${activeScreen === 'home'
                ? 'bg-white text-[#071A24] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Beranda
            </button>
            <button
              type="button"
              onClick={() => setActiveScreen('insights')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${activeScreen === 'insights'
                ? 'bg-[#071A24] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00D29E]" />
              <span>Insights</span>
            </button>
          </div>

          {/* Bell with Alert Dot */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBellNotification(!showBellNotification)}
              className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-center text-slate-700 hover:text-[#00D29E] transition cursor-pointer"
              title="Notifikasi & Peringatan"
            >
              <Bell className="w-5 h-5 stroke-[2]" />
              {(waitingRotationsCount > 0 || lowStockItems.length > 0 || expiringBatches.length > 0 || dueTransactions.length > 0) && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* Notification Dropdown */}
            {showBellNotification && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl p-4 shadow-xl border border-slate-200 z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Notifikasi & Peringatan</span>
                  <span className="text-[11px] text-[#00D29E] font-semibold cursor-pointer" onClick={() => setShowBellNotification(false)}>Tutup</span>
                </div>
                <div className="space-y-2 text-xs">
                  {waitingRotationsCount > 0 && (
                    <div
                      className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 flex items-start gap-2 cursor-pointer hover:bg-amber-100/60 transition"
                      onClick={() => {
                        setShowBellNotification(false);
                        setActiveTab('transactions');
                      }}
                    >
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">Modal Lapangan (Waiting)</div>
                        <div>{waitingRotationsCount} proyek rotasi senilai <strong>{formatCurrency(waitingModalTotal)}</strong> sedang berputar di lapangan.</div>
                      </div>
                    </div>
                  )}
                  {lowStockItems.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>{lowStockItems.length} komoditas memiliki stok di bawah batas aman.</span>
                    </div>
                  )}
                  {dueTransactions.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-start gap-2">
                      <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{dueTransactions.length} transaksi jatuh tempo terdekat memerlukan follow-up.</span>
                    </div>
                  )}
                  {waitingRotationsCount === 0 && lowStockItems.length === 0 && dueTransactions.length === 0 && (
                    <div className="py-4 text-center text-slate-400">Tidak ada peringatan mendesak.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          SCREEN 1: FLOWMINT BERANDA (HOME)
         ========================================================================= */}
      {activeScreen === 'home' && (
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-6 pt-5 border-t border-slate-700/60">
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

                <button
                  type="button"
                  onClick={() => handleQuickAction('transfer')}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-white/10 hover:bg-slate-200 hover:text-[#071A24] text-white border border-white/10 font-bold text-xs backdrop-blur-xs transition cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Transfer</span>
                </button>
              </div>
            </div>
          </div>

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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  <span>This month</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                </button>
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
                  {formatCurrency(monthlyIncome || 64000000)}
                </div>
              </div>

              {/* Expenses */}
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#0A2533]" />
                  <span>Expenses</span>
                </div>
                <div className="text-sm sm:text-base lg:text-lg font-black text-[#0A2533] tracking-tight tabular-nums mt-0.5">
                  {formatCurrency(monthlyExpense || 42300000)}
                </div>
              </div>

              {/* Net Cash Flow */}
              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">Net cash flow</div>
                <div className="text-sm sm:text-base lg:text-lg font-black text-[#00D29E] tracking-tight tabular-nums mt-0.5">
                  +{formatCurrency(netCashflow > 0 ? netCashflow : 21700000)}
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

          {/* 3. AI INSIGHT BANNER (FlowMint Smart Recommendation Banner) */}
          <div
            onClick={() => setActiveScreen('insights')}
            className="rounded-2xl bg-gradient-to-r from-[#F0FDF9] to-[#ECFDF5] border border-[#A7F3D0]/70 p-4 sm:p-4.5 flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00D29E] to-[#10B981] text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition">
                <Sparkles className="w-5 h-5 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  AI Insight
                </div>
                <div className="text-xs sm:text-sm font-semibold text-[#071A24] truncate">
                  {lowStockItems.length > 0
                    ? `Perhatian: ${lowStockItems[0].name} tersisa ${lowStockItems[0].stock} ${lowStockItems[0].base_unit}. Reorder sekarang.`
                    : 'Anda dapat menghemat Rp 1.500.000 bulan ini jika pengeluaran pakan & logistik tetap terukur.'}
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
                      Jatuh Tempo (5 Terdekat)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="text-xs font-bold text-[#00D29E] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lihat Semua</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {dueTransactions.length > 0 ? (
                    dueTransactions.slice(0, 5).map((item, idx) => (
                      <div
                        key={item.id || idx}
                        onClick={() => setActiveTab('transactions')}
                        className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                            {idx % 3 === 0 ? <Home className="w-4 h-4 text-[#071A24]" /> : idx % 3 === 1 ? <Wifi className="w-4 h-4 text-[#00D29E]" /> : <Zap className="w-4 h-4 text-amber-500" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#071A24] truncate">
                              {item.contactName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {formatDate(item.due_date, 'short')}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-black text-[#071A24] tabular-nums">
                            {formatCurrency(item.remaining)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      {/* FlowMint Mockup Items fallback */}
                      <div className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                            <Home className="w-4 h-4 text-[#071A24]" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#071A24]">Sewa Gudang & Kandang</div>
                            <div className="text-[11px] text-slate-400">May 31</div>
                          </div>
                        </div>
                        <div className="text-xs font-black text-[#071A24] tabular-nums">Rp 14.500.000</div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Wifi className="w-4 h-4 text-[#00D29E]" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#071A24]">Internet & CCTV Online</div>
                            <div className="text-[11px] text-slate-400">Jun 2</div>
                          </div>
                        </div>
                        <div className="text-xs font-black text-[#071A24] tabular-nums">Rp 600.000</div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#071A24]">Listrik & Pendingin Susu</div>
                            <div className="text-[11px] text-slate-400">Jun 6</div>
                          </div>
                        </div>
                        <div className="text-xs font-black text-[#071A24] tabular-nums">Rp 820.000</div>
                      </div>
                    </>
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
              </div>
            </div>
          </div>

          {/* 5. FLOWMINT DARK SIGNATURE ACTION BUTTON: "Plan my month" */}
          <div>
            <button
              type="button"
              onClick={() => {
                setDefaultTransactionType('income');
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
      )}

      {/* =========================================================================
          SCREEN 2: FLOWMINT INSIGHTS (Right phone from uploaded photo!)
         ========================================================================= */}
      {activeScreen === 'insights' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Subheader */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#071A24] tracking-tight">
                Insights
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Understand your money, make better decisions
              </p>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-xs transition shadow-2xs"
            >
              <span>This month</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          {/* 1. FINANCIAL HEALTH SCORE CARD (FlowMint Midnight Card with Heartbeat Gauge) */}
          <div className="rounded-3xl bg-gradient-to-br from-[#071A24] via-[#0B2533] to-[#04121A] text-white p-6 sm:p-7 border border-slate-800 shadow-lg flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                <span>Financial health score</span>
                <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-white tracking-tight tabular-nums">
                  85
                </span>
                <span className="text-base text-slate-400 font-bold">/ 100</span>
              </div>

              <div className="mt-2 text-xs font-bold text-[#00D29E] flex items-center gap-1">
                <span>↑ 12 pts</span>
                <span className="text-slate-400 font-normal">vs last month</span>
              </div>
            </div>

            {/* Circular Health Meter with Pulsing Heartbeat */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#1E3A4B"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#00D29E"
                  strokeWidth="8"
                  strokeDasharray={`${85 * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[#00D29E]">
                <Activity className="w-7 h-7 animate-pulse stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* 2. INCOME VS SPENDING (Weekly Dual-Bar Chart) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#071A24] tracking-tight">
                  Income vs. Spending
                </h3>
                <div className="flex items-center gap-4 text-xs font-semibold mt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00D29E]" />
                    <span className="text-slate-700">Income {formatCurrency(monthlyIncome || 6400000)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#071A24]" />
                    <span className="text-slate-700">Spending {formatCurrency(monthlyExpense || 4230000)}</span>
                  </span>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                Weekly ▾
              </span>
            </div>

            <div className="h-60 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="week" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), '']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '1rem',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="income" fill="#00D29E" radius={[6, 6, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="expense" fill="#071A24" radius={[6, 6, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. TWO COLUMNS: SPENDING BY CATEGORY + SAVINGS PROGRESS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Spending by Category Card */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-[#071A24] tracking-tight mb-4">
                  Spending by category
                </h3>

                <div className="flex items-center justify-between gap-4">
                  <div className="w-28 h-28 relative shrink-0">
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
                            <Cell key={`cell-ins-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1 text-xs flex-1">
                    {categoryData.slice(0, 4).map((c, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-slate-600 truncate">{c.name}</span>
                        <span className="font-bold text-[#071A24]">{c.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3 text-xs">
                <span className="text-slate-500 font-medium">Total spending</span>
                <span className="font-extrabold text-[#071A24] flex items-center gap-1 cursor-pointer">
                  <span>{formatCurrency(monthlyExpense || 4230000)}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Savings Progress Card (FlowMint Plant Icon Card) */}
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-[#071A24] tracking-tight">
                    Savings progress
                  </h3>
                  {/* Plant Graphic */}
                  <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-[#00D29E] flex items-center justify-center">
                    🌱
                  </div>
                </div>

                <div className="text-xl sm:text-2xl font-black text-[#00D29E] tabular-nums">
                  Rp 21.700.000 <span className="text-xs text-slate-500 font-semibold">saved</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  of Rp 50.000.000 target laba
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-500">Pencapaian</span>
                    <span className="text-[#071A24]">43%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00D29E] to-[#10B981] rounded-full transition-all duration-500"
                      style={{ width: '43%' }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#00D29E]" />
                <span>On track • Rp 5.400.000 ahead of plan</span>
              </div>
            </div>
          </div>

          {/* 4. TOP INSIGHTS FOR YOU (FlowMint Recommendation List) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00D29E]" />
                <h3 className="text-base font-bold text-[#071A24] tracking-tight">
                  Top insights for you
                </h3>
              </div>
              <button type="button" className="text-xs font-bold text-[#00D29E] hover:underline">
                View all
              </button>
            </div>

            <div className="space-y-3">
              {/* Card 1 */}
              <div className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 transition flex items-center justify-between gap-3 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100/70 text-[#00D29E] flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#071A24]">Great job!</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Pengeluaran logistik Anda 14% lebih hemat dibanding bulan lalu.
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              {/* Card 2 */}
              <div className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 transition flex items-center justify-between gap-3 cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100/70 text-amber-600 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#071A24]">Optimasi Biaya Komoditas</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Margin komoditas Minyak & Telur meningkat 8.4% minggu ini.
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#00D29E] flex items-center gap-0.5">
                  <span>Detail</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
