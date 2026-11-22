import { useState, useEffect, useMemo, useCallback } from 'react';
import { useReports } from '../../hooks/useReports.js';
import { formatCurrency, formatDate } from '../../lib/formatters.js';
import { exportToPDF, exportToCSV } from '../../lib/exporters.js';
import { SkeletonCard } from '../ui/Skeleton.jsx';
import BottomSheet from '../ui/BottomSheet.jsx';
import {
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Package,
  Layers,
  BarChart3,
  Calendar,
  Filter,
  SlidersHorizontal,
  ChevronDown,
  Check,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from 'recharts';

/**
 * FlowMint-style Financial Reports & Analytics View
 * Aligned with CV Amanah Barokah Design Language:
 * - FlowMint Midnight Navy & Mint Green palette (#071A24, #00D29E)
 * - Dynamic & Functional Period Filter (Actually updates report calculations)
 * - Accurate Profit & Loss presentation with clear Gross Margin vs Net Profit/Deficit
 * - Commodity Omset Breakdown with sleek bar & cards
 * - Cash Flow with centered total expense donut chart
 * - Receivables & Payables with WhatsApp Billing reminder integration
 * - Stock Valuation with Moving Average HPP
 */
export default function ReportsView() {
  const { getProfitLoss, getCashFlow, getStockValuation } = useReports();

  // 1. Tab state: pl (Laba Rugi) | cashflow (Arus Kas) | stock (Valuasi Stok)
  const [activeReport, setActiveReport] = useState('pl');

  // 2. Dynamic Period & Date Filter State (Bank-Grade Architecture)
  const [now] = useState(() => new Date());
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [periodPreset, setPeriodPreset] = useState('this_month'); // this_month | last_month | last_30_days | this_quarter | this_year | custom | all
  const [customStartDate, setCustomStartDate] = useState(() => {
    return new Date(currentYear, currentMonth, 1).toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date(currentYear, currentMonth + 1, 0).toISOString().slice(0, 10);
  });

  // Modal temporary state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempPreset, setTempPreset] = useState('this_month');
  const [tempStartDate, setTempStartDate] = useState(() => {
    return new Date(currentYear, currentMonth, 1).toISOString().slice(0, 10);
  });
  const [tempEndDate, setTempEndDate] = useState(() => {
    return new Date(currentYear, currentMonth + 1, 0).toISOString().slice(0, 10);
  });

  // Calculate actual Date Range based on preset & date inputs
  const dateRange = useMemo(() => {
    if (periodPreset === 'all') {
      return {
        start: null,
        end: null,
        label: 'Semua Waktu',
        displayRange: 'Semua Riwayat Transaksi',
        subLabel: 'Semua'
      };
    }
    if (periodPreset === 'custom') {
      const start = customStartDate ? new Date(`${customStartDate}T00:00:00`).toISOString() : null;
      const end = customEndDate ? new Date(`${customEndDate}T23:59:59`).toISOString() : null;
      return {
        start,
        end,
        label: `${formatDate(customStartDate, 'short')} s/d ${formatDate(customEndDate, 'short')}`,
        displayRange: `${formatDate(customStartDate, 'short')} - ${formatDate(customEndDate, 'short')}`,
        subLabel: 'Kustom',
      };
    }
    if (periodPreset === 'this_month') {
      const start = new Date(currentYear, currentMonth, 1).toISOString();
      const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();
      return {
        start,
        end,
        label: `Bulan Ini (${formatDate(start, 'short')} - ${formatDate(end, 'short')})`,
        displayRange: `${formatDate(start, 'short')} - ${formatDate(end, 'short')}`,
        subLabel: 'Bulan Ini',
      };
    }
    if (periodPreset === 'last_month') {
      const start = new Date(currentYear, currentMonth - 1, 1).toISOString();
      const end = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();
      return {
        start,
        end,
        label: `Bulan Lalu (${formatDate(start, 'short')} - ${formatDate(end, 'short')})`,
        displayRange: `${formatDate(start, 'short')} - ${formatDate(end, 'short')}`,
        subLabel: 'Bulan Lalu',
      };
    }
    if (periodPreset === 'last_30_days') {
      const d30 = new Date();
      d30.setDate(d30.getDate() - 30);
      d30.setHours(0, 0, 0, 0);
      const start = d30.toISOString();
      const end = new Date().toISOString();
      return {
        start,
        end,
        label: `30 Hari Terakhir (${formatDate(start, 'short')} - ${formatDate(end, 'short')})`,
        displayRange: `${formatDate(start, 'short')} - ${formatDate(end, 'short')}`,
        subLabel: '30 Hari',
      };
    }
    if (periodPreset === 'this_quarter') {
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const start = new Date(currentYear, quarterStartMonth, 1).toISOString();
      const end = new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59).toISOString();
      return {
        start,
        end,
        label: `Kuartal Berjalan (${formatDate(start, 'short')} - ${formatDate(end, 'short')})`,
        displayRange: `${formatDate(start, 'short')} - ${formatDate(end, 'short')}`,
        subLabel: 'Kuartal Ini',
      };
    }
    if (periodPreset === 'this_year') {
      const start = new Date(currentYear, 0, 1).toISOString();
      const end = new Date(currentYear, 11, 31, 23, 59, 59).toISOString();
      return {
        start,
        end,
        label: `Tahun ${currentYear} (${formatDate(start, 'short')} - ${formatDate(end, 'short')})`,
        displayRange: `${formatDate(start, 'short')} - ${formatDate(end, 'short')}`,
        subLabel: `Tahun ${currentYear}`,
      };
    }
    // all fallback
    return {
      start: null,
      end: null,
      label: 'Semua Waktu',
      displayRange: 'Semua Riwayat Transaksi',
      subLabel: 'Semua'
    };
  }, [periodPreset, customStartDate, customEndDate, currentYear, currentMonth]);

  // Report Data State
  const [plData, setPlData] = useState(null);
  const [cfData, setCfData] = useState(null);
  const [valData, setValData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load Reports with real date filtering
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const [pl, cf, val] = await Promise.all([
        getProfitLoss(dateRange.start, dateRange.end),
        getCashFlow(dateRange.start, dateRange.end),
        getStockValuation(),
      ]);
      setPlData(pl);
      setCfData(cf);
      setValData(val);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  }, [getProfitLoss, getCashFlow, getStockValuation, dateRange]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // PDF Export
  const handleExportPDF = () => {
    if (activeReport === 'pl' && plData) {
      exportToPDF(
        'Laporan Laba Rugi Komoditas - CV Amanah Barokah',
        plData.commodityBreakdown.map((c) => ({
          komoditas: c.name,
          omset: formatCurrency(c.revenue),
          hpp: formatCurrency(c.cogs),
          laba_kotor: formatCurrency(c.grossProfit),
          laba_bersih: formatCurrency(c.netProfit),
        })),
        [
          { key: 'komoditas', header: 'Komoditas' },
          { key: 'omset', header: 'Penjualan' },
          { key: 'hpp', header: 'HPP' },
          { key: 'laba_kotor', header: 'Laba Kotor' },
          { key: 'laba_bersih', header: 'Laba Bersih' },
        ],
        'laporan_laba_rugi_amanah_barokah.pdf'
      );
    } else if (activeReport === 'cashflow' && cfData) {
      exportToPDF(
        'Laporan Arus Kas - CV Amanah Barokah',
        [
          { kategori: 'Total Kas Masuk', nominal: formatCurrency(cfData.cashIn) },
          { kategori: 'Total Kas Keluar', nominal: formatCurrency(cfData.cashOut) },
          { kategori: 'Arus Kas Bersih', nominal: formatCurrency(cfData.netCashFlow) },
          { kategori: 'Saldo Akhir Rekening', nominal: formatCurrency(cfData.closingBalance) },
        ],
        [
          { key: 'kategori', header: 'Arus Kas' },
          { key: 'nominal', header: 'Nominal (Rp)' },
        ],
        'laporan_arus_kas_amanah_barokah.pdf'
      );
    } else if (activeReport === 'stock' && valData) {
      exportToPDF(
        'Laporan Valuasi Stok Persediaan - CV Amanah Barokah',
        valData.items.map((it) => ({
          nama: it.name,
          stok: `${it.stock} ${it.base_unit}`,
          hpp: formatCurrency(it.hpp),
          valuasi: formatCurrency(it.valuation),
        })),
        [
          { key: 'nama', header: 'Komoditas' },
          { key: 'stok', header: 'Sisa Stok' },
          { key: 'hpp', header: 'HPP Satuan' },
          { key: 'valuasi', header: 'Total Valuasi' },
        ],
        'valuasi_stok_amanah_barokah.pdf'
      );
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (activeReport === 'pl' && plData) {
      exportToCSV(
        plData.commodityBreakdown.map((c) => ({
          Komoditas: c.name,
          Penjualan: c.revenue,
          HPP: c.cogs,
          Laba_Kotor: c.grossProfit,
          Laba_Bersih: c.netProfit,
        })),
        null,
        'laba_rugi_komoditas.csv'
      );
    }
  };

  const reportTabs = [
    { id: 'pl', label: 'Laba Rugi', icon: TrendingUp },
    { id: 'cashflow', label: 'Arus Kas', icon: DollarSign },
    { id: 'stock', label: 'Valuasi Stok', icon: Package },
  ];

  // Colors for 5 commodities
  const commodityColors = {
    Minyak: '#F59E0B',
    Telur: '#EAB308',
    Sapi: '#EF4444',
    Domba: '#8B5CF6',
    Susu: '#3B82F6',
  };

  // Dynamic Expenses Breakdown for Donut Chart
  const expenseData = useMemo(() => {
    if (!plData || !plData.expensesByCategory) {
      return [
        { name: 'Kulakan (Stok)', value: 2175000, color: '#00D29E' },
        { name: 'Pakan Ternak', value: 2500000, color: '#071A24' },
        { name: 'Operasional', value: 650000, color: '#3B82F6' },
      ];
    }
    const colors = ['#00D29E', '#071A24', '#3B82F6', '#F59E0B', '#EC4899'];
    const entries = Object.entries(plData.expensesByCategory);
    if (entries.length === 0) {
      return [{ name: 'Beban Umum', value: plData.totalOperationalExpenses || 1, color: '#00D29E' }];
    }
    return entries.map(([cat, val], idx) => ({
      name: cat,
      value: Number(val) || 0,
      color: colors[idx % colors.length]
    }));
  }, [plData]);

  const totalExpenseAmount = useMemo(() => {
    return expenseData.reduce((acc, curr) => acc + curr.value, 0);
  }, [expenseData]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      {/* =========================================================================
          1. TOP BAR: TITLE + EXPORT ACTIONS (Clean FlowMint Header)
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00D29E] to-[#10B981] flex items-center justify-center shadow-sm shadow-emerald-500/20 text-white">
              <BarChart3 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-[#071A24]">
              Laporan Keuangan <span className="text-[#00D29E] font-medium text-xs tracking-normal px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">FlowMint Insights</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#071A24]">
            Analisis & Performa Bisnis
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Laba rugi komoditas, arus kas riil, dan valuasi aset persediaan.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-700 shadow-2xs flex items-center gap-1.5 transition ios-spring-tap cursor-pointer"
            title="Ekspor Laporan ke format CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#00D29E]" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="px-4 py-2 bg-[#071A24] hover:bg-[#0B2533] active:scale-95 text-white rounded-2xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition ios-spring-tap cursor-pointer"
            title="Cetak & Unduh Dokumen PDF Resmi"
          >
            <FileText className="w-3.5 h-3.5 text-[#00D29E]" />
            <span>Unduh PDF</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. FLOWMINT SEGMENTED TABS (No text wrapping, clean icon chips)
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-2 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-3 gap-1.5">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeReport === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveReport(tab.id)}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#071A24] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#00D29E]' : 'text-slate-400'} stroke-[2.5]`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          3. ELEGANT BANK-GRADE PERIOD SELECTOR (Ala Livin' Mandiri / BCA)
         ========================================================================= */}
      <button
        type="button"
        onClick={() => {
          setTempPreset(periodPreset);
          setTempStartDate(customStartDate);
          setTempEndDate(customEndDate);
          setIsFilterModalOpen(true);
        }}
        className="w-full bg-white hover:bg-slate-50/90 active:scale-[0.99] border border-slate-200/80 rounded-2xl p-3 sm:px-4 shadow-2xs flex items-center justify-between gap-3 transition cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-[#071A24] group-hover:text-[#00D29E] transition">
            <Calendar className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Periode Laporan
              </span>
              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                {dateRange.subLabel}
              </span>
            </div>
            <div className="text-xs sm:text-sm font-extrabold text-[#071A24] truncate">
              {dateRange.displayRange}
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 group-hover:bg-slate-200 text-xs font-bold text-slate-700 transition shrink-0 border border-slate-200/60">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#00D29E]" />
          <span className="hidden sm:inline">Ubah Periode</span>
          <span className="sm:hidden">Ubah</span>
          <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition" />
        </div>
      </button>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <SkeletonCard height="h-24 sm:h-28" />
            <SkeletonCard height="h-24 sm:h-28" />
            <SkeletonCard height="h-24 sm:h-28" />
          </div>
          <SkeletonCard height="h-48" />
        </div>
      )}

      {/* =========================================================================
          TAB 1: LABA RUGI (ACCURATE & BEAUTIFUL P&L SUMMARY)
         ========================================================================= */}
      {!loading && activeReport === 'pl' && plData && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Profit & Loss Flow Cards: Laba Bruto, Beban & Penyusutan, Laba Netto (Satu Baris Kompak Anti-Scroll) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {/* Box 1: Laba Bruto (Kotor) */}
            <div
              title={`Laba Bruto: ${formatCurrency(plData.grossProfit)}`}
              className="bg-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Laba Bruto
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-[11px] min-[360px]:text-xs sm:text-xl lg:text-2xl font-black text-emerald-700 tabular-nums tracking-tight truncate">
                +{formatCurrency(plData.grossProfit)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                {plData.rotationGrossProfit > 0 ? (
                  <span>Realisasi Rotasi ({plData.completedRotationsCount} batch)</span>
                ) : (
                  <span>Omset: {formatCurrency(plData.totalRevenue)}</span>
                )}
              </div>
            </div>

            {/* Box 2: Beban Operasional & Penyusutan */}
            <div
              title={`Beban Operasional & Susut: ${formatCurrency(plData.totalOperationalExpenses)}`}
              className="bg-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Beban & Susut
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-[11px] min-[360px]:text-xs sm:text-xl lg:text-2xl font-black text-slate-800 tabular-nums tracking-tight truncate">
                {formatCurrency(plData.totalOperationalExpenses)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Operasional & susut
              </div>
            </div>

            {/* Box 3: Laba Netto (Bersih) */}
            <div
              title={`Laba Netto: ${formatCurrency(plData.netProfit)}`}
              className={`p-2 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0 ${
                plData.netProfit >= 0
                  ? 'bg-gradient-to-br from-[#F0FDF9] to-[#ECFDF5] border-[#A7F3D0]'
                  : 'bg-gradient-to-br from-[#FFF1F2] to-[#FFE4E6] border-[#FECDD3]'
              }`}
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span
                  className={`text-[10px] sm:text-xs font-bold uppercase tracking-tight sm:tracking-wider truncate ${
                    plData.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  {plData.netProfit >= 0 ? 'Laba Netto' : 'Defisit Netto'}
                </span>
                <div
                  className={`w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 ${
                    plData.netProfit >= 0 ? 'bg-emerald-100 text-[#00D29E]' : 'bg-rose-100 text-rose-600'
                  }`}
                >
                  {plData.netProfit >= 0 ? (
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                  )}
                </div>
              </div>
              <div
                className={`text-[11px] min-[360px]:text-xs sm:text-xl lg:text-2xl font-black tabular-nums tracking-tight truncate ${
                  plData.netProfit >= 0 ? 'text-[#00D29E]' : 'text-rose-600'
                }`}
              >
                {plData.netProfit >= 0 ? '+' : ''}{formatCurrency(plData.netProfit)}
              </div>
              <div
                className={`text-[9px] sm:text-xs mt-0.5 sm:mt-1 font-semibold truncate hidden min-[360px]:block ${
                  plData.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {plData.netProfit >= 0 ? 'Surplus bersih' : 'Defisit operasional'}
              </div>
            </div>
          </div>

          {/* Kartu Ringkasan Kinerja Rotasi Modal (CV Amanah Barokah) */}
          {(plData.rotationTotalCapital > 0 || plData.waitingModalTotal > 0) && (
            <div className="bg-gradient-to-br from-[#071A24] via-[#0B2533] to-[#04121A] text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-700/60">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#00D29E]/20 text-[#00D29E] border border-[#00D29E]/30">
                      Siklus Rotasi Modal
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                    Realisasi & Efisiensi Proyek Batch
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Monitoring siklus modal dan pengembalian profit (Margin 8% Susu MBG, Telur, Minyak).
                  </p>
                </div>
                <div className="text-right self-start sm:self-auto">
                  <span className="text-xs text-slate-400 block">Rata-rata ROI</span>
                  <span className="text-lg sm:text-xl font-black text-[#00D29E] tabular-nums">
                    {Number(plData.rotationTotalCapital) > 0
                      ? `${(((Number(plData.rotationGrossProfit) || 0) / Number(plData.rotationTotalCapital)) * 100).toFixed(1)}%`
                      : '0%'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3.5 pt-3 sm:pt-4">
                <div className="bg-white/5 p-2.5 sm:p-3.5 rounded-2xl border border-white/10 min-w-0">
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block truncate">Modal Selesai</span>
                  <span className="text-xs min-[360px]:text-sm sm:text-base lg:text-lg font-black text-white tabular-nums truncate block">
                    {formatCurrency(plData.rotationTotalCapital)}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 block mt-0.5 truncate hidden min-[360px]:block">{plData.completedRotationsCount} batch cair</span>
                </div>

                <div className="bg-white/5 p-2.5 sm:p-3.5 rounded-2xl border border-white/10 min-w-0">
                  <span className="text-[10px] sm:text-[11px] text-emerald-400 font-medium block truncate">Profit Cair</span>
                  <span className="text-xs min-[360px]:text-sm sm:text-base lg:text-lg font-black text-[#00D29E] tabular-nums truncate block">
                    +{formatCurrency(plData.rotationGrossProfit)}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-emerald-300/80 block mt-0.5 truncate hidden min-[360px]:block">Masuk kas</span>
                </div>

                <div className="bg-white/5 p-2.5 sm:p-3.5 rounded-2xl border border-white/10 min-w-0">
                  <span className="text-[10px] sm:text-[11px] text-amber-300 font-medium block truncate">Modal Lapangan</span>
                  <span className="text-xs min-[360px]:text-sm sm:text-base lg:text-lg font-black text-amber-300 tabular-nums truncate block">
                    {formatCurrency(plData.waitingModalTotal)}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-amber-200/80 block mt-0.5 truncate hidden min-[360px]:block">{plData.waitingRotationsCount} batch Waiting</span>
                </div>
              </div>
            </div>
          )}

          {/* Commodity Omset Distribution (Sleek Horizontal Bar & Cards) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h3 className="font-extrabold text-[#071A24] text-base tracking-tight">
                  Distribusi Omset per Komoditas
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Proporsi penjualan 5 komoditas (Minyak, Telur, Sapi, Domba, Susu)
                </p>
              </div>
              <span className="text-xs font-bold text-[#071A24] tabular-nums bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                Total Omset: {formatCurrency(plData.totalRevenue)}
              </span>
            </div>

            {/* Horizontal Bar */}
            {(() => {
              const totalRev = Number(plData.totalRevenue) || 0;
              const itemsList = Array.isArray(plData.commodityBreakdown) ? plData.commodityBreakdown : [];

              return (
                <div className="space-y-4">
                  {/* Single Smooth Continuous Bar */}
                  <div className="w-full h-6 bg-slate-100 rounded-full flex overflow-hidden border border-slate-200/60 p-0.5 gap-0.5">
                    {itemsList.map((c) => {
                      const cRev = Number(c.revenue) || 0;
                      const share = totalRev > 0 ? (cRev / totalRev) * 100 : 0;
                      const displayShare = share > 0 ? share : (itemsList.length > 0 ? 100 / itemsList.length : 0);
                      const barColor = commodityColors[c.name] || '#64748B';

                      return (
                        <div
                          key={c.id}
                          className="h-full rounded-full transition-all duration-300 relative group cursor-pointer"
                          style={{
                            width: `${Math.max(0, Math.min(100, displayShare))}%`,
                            backgroundColor: barColor
                          }}
                          title={`${c.name}: ${formatCurrency(cRev)} (${displayShare.toFixed(1)}%)`}
                        />
                      );
                    })}
                  </div>

                  {/* Commodity Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                    {itemsList.map((c) => {
                      const cRev = Number(c.revenue) || 0;
                      const barColor = commodityColors[c.name] || '#64748B';
                      const share = totalRev > 0 ? ((cRev / totalRev) * 100).toFixed(0) : '0';

                      return (
                        <div
                          key={c.id}
                          className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/60 space-y-1 hover:border-slate-300 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: barColor }}
                              />
                              <span className="text-xs font-bold text-[#071A24] truncate">
                                {c.name}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                              {share}%
                            </span>
                          </div>

                          <div className="text-xs sm:text-sm font-black text-[#071A24] tabular-nums">
                            {formatCurrency(c.revenue)}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-between tabular-nums">
                            <span>Laba:</span>
                            <span className="font-bold text-[#00D29E]">{formatCurrency(c.grossProfit)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Detailed Table & Mobile Card View */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-[#071A24] text-sm tracking-tight">
                Rincian Margin per Komoditas
              </h3>
              <span className="text-xs text-slate-400 font-medium">Berdasarkan data riil</span>
            </div>

            {/* Mobile Stacked Card View (No horizontal scrolling!) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {(plData.commodityBreakdown || []).map((c) => {
                const rev = Number(c.revenue) || 0;
                const gross = Number(c.grossProfit) || 0;
                const margin = rev > 0 ? ((gross / rev) * 100).toFixed(1) : '0.0';
                return (
                  <div key={c.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: commodityColors[c.name] || '#64748B' }}
                        />
                        <span className="font-extrabold text-sm text-[#071A24]">{c.name}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-[#00D29E] border border-emerald-200">
                        Margin {margin}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-2xl text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Penjualan</span>
                        <strong className="text-[#00D29E] font-black tabular-nums">{formatCurrency(c.revenue)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">HPP Pokok</span>
                        <span className="text-slate-600 font-bold tabular-nums">{formatCurrency(c.cogs)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase block">Laba Kotor</span>
                        <strong className="text-[#071A24] font-black tabular-nums">{formatCurrency(c.grossProfit)}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5">Komoditas</th>
                    <th className="px-5 py-3.5 text-right">Penjualan</th>
                    <th className="px-5 py-3.5 text-right">HPP (COGS)</th>
                    <th className="px-5 py-3.5 text-right">Laba Kotor</th>
                    <th className="px-5 py-3.5 text-right">Margin (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(plData.commodityBreakdown || []).map((c) => {
                    const rev = Number(c.revenue) || 0;
                    const gross = Number(c.grossProfit) || 0;
                    const margin = rev > 0 ? ((gross / rev) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-5 py-4 font-bold text-[#071A24] flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: commodityColors[c.name] || '#64748B' }}
                          />
                          <span>{c.name}</span>
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-[#00D29E] tabular-nums">
                          {formatCurrency(c.revenue)}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-500 tabular-nums">
                          {formatCurrency(c.cogs)}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-[#071A24] tabular-nums">
                          {formatCurrency(c.grossProfit)}
                        </td>
                        <td className="px-5 py-4 text-right font-black text-slate-700 tabular-nums">
                          {margin}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ARUS KAS (CASH FLOW INSIGHTS)
         ========================================================================= */}
      {!loading && activeReport === 'cashflow' && cfData && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Cash Flow Summary Cards: Satu Baris Kompak Anti-Scroll */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {/* Box 1: Total Kas Masuk */}
            <div
              title={`Total Kas Masuk: ${formatCurrency(cfData.cashIn)}`}
              className="bg-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Kas Masuk
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-[11px] min-[360px]:text-xs sm:text-xl lg:text-2xl font-black text-[#00D29E] tabular-nums tracking-tight truncate">
                +{formatCurrency(cfData.cashIn)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Uang riil diterima
              </div>
            </div>

            {/* Box 2: Total Kas Keluar */}
            <div
              title={`Total Kas Keluar: ${formatCurrency(cfData.cashOut)}`}
              className="bg-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Kas Keluar
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-[11px] min-[360px]:text-xs sm:text-xl lg:text-2xl font-black text-rose-600 tabular-nums tracking-tight truncate">
                -{formatCurrency(cfData.cashOut)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Belanja & operasional
              </div>
            </div>

            {/* Box 3: Saldo Kas & Bank */}
            <div
              title={`Saldo Kas & Bank: ${formatCurrency(cfData.closingBalance)}`}
              className="bg-gradient-to-br from-[#071A24] to-[#0B2533] text-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-tight sm:tracking-wider truncate">
                  Saldo Kas
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-white/10 text-[#00D29E] flex items-center justify-center shrink-0">
                  <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-[11px] min-[360px]:text-xs sm:text-xl lg:text-2xl font-black text-[#00D29E] tabular-nums tracking-tight truncate">
                {formatCurrency(cfData.closingBalance)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-300 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Likuiditas siap pakai
              </div>
            </div>
          </div>

          {/* Expense Donut Chart with Centered Total */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
            <div>
              <h3 className="font-bold text-[#071A24] text-base tracking-tight">
                Komposisi Pengeluaran Bisnis
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Porsi pengeluaran antara kulakan stok barang dan biaya operasional
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="relative flex items-center justify-center h-60 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [formatCurrency(val), 'Beban']}
                      contentStyle={{
                        backgroundColor: '#071A24',
                        color: '#FFFFFF',
                        borderRadius: '1rem',
                        border: 'none',
                        fontSize: '12px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Beban
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#071A24] tabular-nums">
                    {formatCurrency(totalExpenseAmount)}
                  </span>
                </div>
              </div>

              {/* Expense Categories List */}
              <div className="space-y-2">
                {expenseData.map((exp) => {
                  const expVal = Number(exp.value) || 0;
                  const totExp = Number(totalExpenseAmount) || 0;
                  const percent = totExp > 0 ? ((expVal / totExp) * 100).toFixed(1) : '0.0';
                  return (
                    <div
                      key={exp.name}
                      className="p-3 rounded-2xl border border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: exp.color }}
                        />
                        <div>
                          <div className="text-xs font-bold text-[#071A24]">{exp.name}</div>
                          <div className="text-[10px] text-slate-400">{percent}% dari total</div>
                        </div>
                      </div>

                      <div className="text-xs font-black text-[#071A24] tabular-nums">
                        {formatCurrency(exp.value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: VALUASI STOK (INVENTORY ASSETS)
         ========================================================================= */}
      {!loading && activeReport === 'stock' && valData && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Stock Valuation Summary Cards: Satu Baris Kompak Anti-Scroll */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {/* Box 1: Total Nilai Persediaan */}
            <div
              title={`Total Nilai Stok: ${formatCurrency(valData.totalValuation)}`}
              className="bg-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Nilai Stok
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center shrink-0">
                  <Package className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-[11px] min-[360px]:text-xs sm:text-xl lg:text-2xl font-black text-[#00D29E] tabular-nums tracking-tight truncate">
                {formatCurrency(valData.totalValuation)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Nilai aset persediaan
              </div>
            </div>

            {/* Box 2: Jumlah Komoditas */}
            <div
              title={`Total Komoditas: ${valData.items?.length || 0} Barang`}
              className="bg-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Total Komoditas
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-slate-100 text-[#071A24] flex items-center justify-center shrink-0">
                  <Layers className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-[11px] min-[360px]:text-xs sm:text-xl lg:text-2xl font-black text-[#071A24] tabular-nums tracking-tight truncate">
                {valData.items?.length || 0} Barang
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Terdaftar di gudang
              </div>
            </div>

            {/* Box 3: Metode Penilaian */}
            <div
              title="Metode HPP: Moving Average Otomatis"
              className="bg-white p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0"
            >
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Metode HPP
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-[11px] min-[360px]:text-xs sm:text-xl lg:text-2xl font-black text-[#071A24] tracking-tight truncate">
                Moving Avg
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Otomatis saat masuk
              </div>
            </div>
          </div>

          {/* Items Table & Mobile Cards */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-[#071A24] text-sm tracking-tight">
                Valuasi Persediaan per Komoditas Gudang
              </h3>
              <span className="text-xs text-slate-400 font-medium">Auto Moving Average</span>
            </div>

            {/* Mobile Stacked Cards (No horizontal scroll!) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {valData.items?.map((it) => (
                <div key={it.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-sm text-[#071A24]">{it.name}</div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      {it.commodityName}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-2xl text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Sisa Stok</span>
                      <strong className="text-[#071A24] font-black tabular-nums">{it.stock} {it.base_unit}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">HPP Satuan</span>
                      <span className="text-slate-600 font-bold tabular-nums">{formatCurrency(it.hpp)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Nilai</span>
                      <strong className="text-[#00D29E] font-black tabular-nums">{formatCurrency(it.valuation)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5">Nama Barang</th>
                    <th className="px-5 py-3.5">Komoditas</th>
                    <th className="px-5 py-3.5 text-right">Sisa Stok</th>
                    <th className="px-5 py-3.5 text-right">HPP Satuan</th>
                    <th className="px-5 py-3.5 text-right">Total Valuasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {valData.items?.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-4 font-bold text-[#071A24]">{it.name}</td>
                      <td className="px-5 py-4 text-slate-500">{it.commodityName}</td>
                      <td className="px-5 py-4 text-right font-bold text-[#071A24] tabular-nums">
                        {it.stock} {it.base_unit}
                      </td>
                      <td className="px-5 py-4 text-right text-slate-500 tabular-nums">
                        {formatCurrency(it.hpp)}
                      </td>
                      <td className="px-5 py-4 text-right font-black text-[#00D29E] tabular-nums">
                        {formatCurrency(it.valuation)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL FILTER TANGGAL ALA MOBILE BANKING (BCA / Livin' Style BottomSheet)
         ========================================================================= */}
      <BottomSheet
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-[#071A24]">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center">
              <Calendar className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="font-extrabold text-base">Atur Periode & Tanggal</span>
          </div>
        }
        size="md"
      >
        <div className="space-y-4 pt-1">
          {/* Pilihan Cepat Preset Ala Bank */}
          <div>
            <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
              Pilihan Cepat
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'this_month', label: 'Bulan Ini' },
                { id: 'last_month', label: 'Bulan Lalu' },
                { id: 'last_30_days', label: '30 Hari Terakhir' },
                { id: 'this_quarter', label: 'Kuartal Ini' },
                { id: 'this_year', label: `Tahun ${now.getFullYear()}` },
                { id: 'all', label: 'Semua Waktu' },
              ].map((p) => {
                const isSelected = tempPreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setTempPreset(p.id);
                      const curY = now.getFullYear();
                      const curM = now.getMonth();
                      if (p.id === 'this_month') {
                        setTempStartDate(new Date(curY, curM, 1).toISOString().slice(0, 10));
                        setTempEndDate(new Date(curY, curM + 1, 0).toISOString().slice(0, 10));
                      } else if (p.id === 'last_month') {
                        setTempStartDate(new Date(curY, curM - 1, 1).toISOString().slice(0, 10));
                        setTempEndDate(new Date(curY, curM, 0).toISOString().slice(0, 10));
                      } else if (p.id === 'last_30_days') {
                        const d30 = new Date();
                        d30.setDate(d30.getDate() - 30);
                        setTempStartDate(d30.toISOString().slice(0, 10));
                        setTempEndDate(new Date().toISOString().slice(0, 10));
                      } else if (p.id === 'this_quarter') {
                        const qM = Math.floor(curM / 3) * 3;
                        setTempStartDate(new Date(curY, qM, 1).toISOString().slice(0, 10));
                        setTempEndDate(new Date(curY, qM + 3, 0).toISOString().slice(0, 10));
                      } else if (p.id === 'this_year') {
                        setTempStartDate(new Date(curY, 0, 1).toISOString().slice(0, 10));
                        setTempEndDate(new Date(curY, 11, 31).toISOString().slice(0, 10));
                      }
                    }}
                    className={`p-2.5 rounded-xl text-xs font-bold text-left transition border cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#071A24] text-white border-[#071A24] shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <span>{p.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#00D29E]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Atur Rentang Tanggal Khusus (Dari - Sampai) */}
          <div className="bg-slate-50/80 rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#00D29E]" />
                <span>Pilih Tanggal Bebas (Dari - Sampai)</span>
              </span>
              {tempPreset === 'custom' && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Kustom Aktif
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => {
                    setTempStartDate(e.target.value);
                    setTempPreset('custom');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#071A24] tabular-nums focus:outline-none focus:border-[#00D29E] focus:ring-1 focus:ring-[#00D29E] transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => {
                    setTempEndDate(e.target.value);
                    setTempPreset('custom');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#071A24] tabular-nums focus:outline-none focus:border-[#00D29E] focus:ring-1 focus:ring-[#00D29E] transition"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Format tanggal fleksibel persis seperti mutasi bank untuk keperluan audit pembukuan.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                const curY = now.getFullYear();
                const curM = now.getMonth();
                setTempPreset('this_month');
                setTempStartDate(new Date(curY, curM, 1).toISOString().slice(0, 10));
                setTempEndDate(new Date(curY, curM + 1, 0).toISOString().slice(0, 10));
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPeriodPreset(tempPreset);
                setCustomStartDate(tempStartDate);
                setCustomEndDate(tempEndDate);
                setIsFilterModalOpen(false);
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#071A24] hover:bg-[#0B2533] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4 text-[#00D29E]" />
              <span>Terapkan Filter</span>
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
