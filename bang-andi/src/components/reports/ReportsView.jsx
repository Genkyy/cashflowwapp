import { useState, useEffect, useMemo, useCallback } from 'react';
import { useReports } from '../../hooks/useReports.js';
import { formatCurrency, formatDate, formatWaLink } from '../../lib/formatters.js';
import { exportToPDF, exportToCSV, generateWAMessage } from '../../lib/exporters.js';
import { SkeletonCard, SkeletonTable } from '../ui/Skeleton.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import LoadMoreButton from '../ui/LoadMoreButton.jsx';
import usePagination from '../../hooks/usePagination.js';
import {
  TrendingUp,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Send,
  Clock,
  Package,
  Layers,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  ChevronDown
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
  const { getProfitLoss, getCashFlow, getReceivables, getPayables, getStockValuation } = useReports();

  // 1. Tab state: pl (Laba Rugi) | cashflow (Arus Kas) | debts (Piutang & Utang) | stock (Valuasi Stok)
  const [activeReport, setActiveReport] = useState('pl');
  const [debtSubTab, setDebtSubTab] = useState('receivables'); // receivables | payables
  const [debtStatus, setDebtStatus] = useState('unpaid'); // unpaid ('Belum Lunas' - default) | paid ('Riwayat Lunas')

  // 2. Dynamic Period Filter State
  const now = new Date();
  const [periodPreset, setPeriodPreset] = useState('this_month'); // this_month | last_month | this_quarter | this_year | all

  // Calculate actual Date Range based on preset
  const dateRange = useMemo(() => {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (periodPreset === 'this_month') {
      const start = new Date(currentYear, currentMonth, 1).toISOString();
      const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();
      return { start, end, label: 'Bulan Ini' };
    }
    if (periodPreset === 'last_month') {
      const start = new Date(currentYear, currentMonth - 1, 1).toISOString();
      const end = new Date(currentYear, currentMonth, 0, 23, 59, 59).toISOString();
      return { start, end, label: 'Bulan Lalu' };
    }
    if (periodPreset === 'this_quarter') {
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const start = new Date(currentYear, quarterStartMonth, 1).toISOString();
      const end = new Date(currentYear, quarterStartMonth + 3, 0, 23, 59, 59).toISOString();
      return { start, end, label: 'Kuartal Berjalan (3 Bulan)' };
    }
    if (periodPreset === 'this_year') {
      const start = new Date(currentYear, 0, 1).toISOString();
      const end = new Date(currentYear, 11, 31, 23, 59, 59).toISOString();
      return { start, end, label: `Tahun ${currentYear}` };
    }
    // all
    return { start: null, end: null, label: 'Semua Waktu' };
  }, [periodPreset]);

  // Report Data State
  const [plData, setPlData] = useState(null);
  const [cfData, setCfData] = useState(null);
  const [recData, setRecData] = useState(null);
  const [payData, setPayData] = useState(null);
  const [valData, setValData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load Reports with real date filtering
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const [pl, cf, rec, pay, val] = await Promise.all([
        getProfitLoss(dateRange.start, dateRange.end),
        getCashFlow(dateRange.start, dateRange.end),
        getReceivables(),
        getPayables(),
        getStockValuation(),
      ]);
      setPlData(pl);
      setCfData(cf);
      setRecData(rec);
      setPayData(pay);
      setValData(val);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  }, [getProfitLoss, getCashFlow, getReceivables, getPayables, getStockValuation, dateRange]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Current active debt lists (Unpaid & Paid)
  const currentUnpaidList = useMemo(() => {
    if (debtSubTab === 'receivables') return recData?.list || [];
    return payData?.list || [];
  }, [debtSubTab, recData, payData]);

  const currentPaidList = useMemo(() => {
    if (debtSubTab === 'receivables') return recData?.paidList || [];
    return payData?.paidList || [];
  }, [debtSubTab, recData, payData]);

  // Anti-Lag Pagination: 20 items initial view, reset on tab/period changes
  const {
    displayedItems: paginatedUnpaidList,
    remainingCount: remainingUnpaid,
    loadMore: loadMoreUnpaid,
  } = usePagination(currentUnpaidList, {
    initialLimit: 20,
    step: 20,
    resetDependencies: [debtSubTab, debtStatus, periodPreset],
  });

  const {
    displayedItems: paginatedPaidList,
    remainingCount: remainingPaid,
    loadMore: loadMorePaid,
  } = usePagination(currentPaidList, {
    initialLimit: 20,
    step: 20,
    resetDependencies: [debtSubTab, debtStatus, periodPreset],
  });

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
    } else if (activeReport === 'debts' && recData) {
      exportToPDF(
        'Rekap Piutang Usaha Pelanggan - CV Amanah Barokah',
        recData.list.map((r) => ({
          faktur: r.invoice_number,
          pelanggan: r.contactName,
          tanggal: formatDate(r.date),
          total: formatCurrency(r.total_amount),
          sisa: formatCurrency(r.remaining),
          umur: `${r.daysOutstanding} hari`,
        })),
        [
          { key: 'faktur', header: 'No. Faktur' },
          { key: 'pelanggan', header: 'Pelanggan' },
          { key: 'tanggal', header: 'Tanggal' },
          { key: 'total', header: 'Total Faktur' },
          { key: 'sisa', header: 'Sisa Piutang' },
          { key: 'umur', header: 'Umur Piutang' },
        ],
        'rekap_piutang_amanah_barokah.pdf'
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
    } else if (activeReport === 'debts' && recData) {
      exportToCSV(
        recData.list.map((r) => ({
          Faktur: r.invoice_number,
          Pelanggan: r.contactName,
          Telepon: r.contactPhone,
          Tanggal: formatDate(r.date, 'iso'),
          Total: r.total_amount,
          Sisa_Piutang: r.remaining,
          Umur_Hari: r.daysOutstanding,
        })),
        null,
        'rekap_piutang.csv'
      );
    }
  };

  const reportTabs = [
    { id: 'pl', label: 'Laba Rugi', icon: TrendingUp },
    { id: 'cashflow', label: 'Arus Kas', icon: DollarSign },
    { id: 'debts', label: 'Piutang & Utang', icon: Clock },
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
            Laba rugi komoditas, arus kas riil, pelunasan tempo, dan valuasi aset persediaan.
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
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
          3. FUNCTIONAL PERIOD SELECTOR (Truly updates data when clicked)
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Calendar className="w-3.5 h-3.5 text-[#00D29E]" />
            <span>Periode Laporan</span>
          </div>
          <span className="text-xs font-bold text-[#00D29E]">
            Aktif: {dateRange.label}
          </span>
        </div>

        {/* Real Dynamic Period Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'this_month', label: 'Bulan Ini' },
            { id: 'last_month', label: 'Bulan Lalu' },
            { id: 'this_quarter', label: 'Kuartal Ini (3 Bln)' },
            { id: 'this_year', label: 'Tahun Ini' },
            { id: 'all', label: 'Semua Periode' },
          ].map((preset) => {
            const isSelected = periodPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPeriodPreset(preset.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#071A24] text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

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
            <div className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Laba Bruto
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-xs min-[360px]:text-sm sm:text-2xl lg:text-3xl font-black text-emerald-700 tabular-nums tracking-tight truncate">
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
            <div className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Beban & Susut
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-xs min-[360px]:text-sm sm:text-2xl lg:text-3xl font-black text-slate-800 tabular-nums tracking-tight truncate">
                {formatCurrency(plData.totalOperationalExpenses)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Operasional & susut
              </div>
            </div>

            {/* Box 3: Laba Netto (Bersih) */}
            <div
              className={`p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0 ${
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
                className={`text-xs min-[360px]:text-sm sm:text-2xl lg:text-3xl font-black tabular-nums tracking-tight truncate ${
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
                    {plData.rotationTotalCapital > 0
                      ? `${((plData.rotationGrossProfit / plData.rotationTotalCapital) * 100).toFixed(1)}%`
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
              const totalRev = Math.max(plData.totalRevenue, 1);
              const itemsList = plData.commodityBreakdown;

              return (
                <div className="space-y-4">
                  {/* Single Smooth Continuous Bar */}
                  <div className="w-full h-6 bg-slate-100 rounded-full flex overflow-hidden border border-slate-200/60 p-0.5 gap-0.5">
                    {itemsList.map((c) => {
                      const share = (c.revenue / totalRev) * 100;
                      const displayShare = share > 0 ? share : (100 / itemsList.length);
                      const barColor = commodityColors[c.name] || '#64748B';

                      return (
                        <div
                          key={c.id}
                          className="h-full rounded-full transition-all duration-300 relative group cursor-pointer"
                          style={{
                            width: `${displayShare}%`,
                            backgroundColor: barColor
                          }}
                          title={`${c.name}: ${formatCurrency(c.revenue)} (${displayShare.toFixed(1)}%)`}
                        />
                      );
                    })}
                  </div>

                  {/* Commodity Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                    {itemsList.map((c) => {
                      const barColor = commodityColors[c.name] || '#64748B';
                      const share = plData.totalRevenue > 0 ? ((c.revenue / plData.totalRevenue) * 100).toFixed(0) : 0;

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
              {plData.commodityBreakdown.map((c) => {
                const margin = c.revenue > 0 ? ((c.grossProfit / c.revenue) * 100).toFixed(1) : '0';
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
                  {plData.commodityBreakdown.map((c) => {
                    const margin = c.revenue > 0 ? ((c.grossProfit / c.revenue) * 100).toFixed(1) : '0';
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
            <div className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Kas Masuk
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-xs min-[360px]:text-sm sm:text-2xl lg:text-3xl font-black text-[#00D29E] tabular-nums tracking-tight truncate">
                +{formatCurrency(cfData.cashIn)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Uang riil diterima
              </div>
            </div>

            {/* Box 2: Total Kas Keluar */}
            <div className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Kas Keluar
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-xs min-[360px]:text-sm sm:text-2xl lg:text-3xl font-black text-rose-600 tabular-nums tracking-tight truncate">
                -{formatCurrency(cfData.cashOut)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Belanja & operasional
              </div>
            </div>

            {/* Box 3: Saldo Kas & Bank */}
            <div className="bg-gradient-to-br from-[#071A24] to-[#0B2533] text-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase tracking-tight sm:tracking-wider truncate">
                  Saldo Kas
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-white/10 text-[#00D29E] flex items-center justify-center shrink-0">
                  <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-xs min-[360px]:text-sm sm:text-2xl lg:text-3xl font-black text-[#00D29E] tabular-nums tracking-tight truncate">
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
                  const percent = totalExpenseAmount > 0 ? ((exp.value / totalExpenseAmount) * 100).toFixed(1) : 0;
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
          TAB 3: PIUTANG & UTANG (BILLING & AGING ANALYSIS)
         ========================================================================= */}
      {!loading && activeReport === 'debts' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Dual Segmented Controls: Sub-Type & Status (Belum Lunas vs Riwayat Lunas) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Sub Switch: Piutang vs Utang */}
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/60 self-start">
              <button
                type="button"
                onClick={() => setDebtSubTab('receivables')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  debtSubTab === 'receivables' ? 'bg-[#071A24] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Piutang Pelanggan ({debtStatus === 'unpaid' ? recData?.list?.length || 0 : recData?.paidList?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setDebtSubTab('payables')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  debtSubTab === 'payables' ? 'bg-[#071A24] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Utang Supplier ({debtStatus === 'unpaid' ? payData?.list?.length || 0 : payData?.paidList?.length || 0})
              </button>
            </div>

            {/* Smart Segmented Control Status: Belum Lunas (default aktif) vs Riwayat Lunas */}
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/60 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setDebtStatus('unpaid')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  debtStatus === 'unpaid'
                    ? 'bg-[#071A24] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Belum Lunas</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  debtStatus === 'unpaid' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {debtSubTab === 'receivables' ? recData?.list?.length || 0 : payData?.list?.length || 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDebtStatus('paid')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  debtStatus === 'paid'
                    ? 'bg-[#00D29E] text-[#071A24] font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>Riwayat Lunas</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  debtStatus === 'paid' ? 'bg-[#071A24]/15 text-[#071A24]' : 'bg-slate-200 text-slate-700'
                }`}>
                  {debtSubTab === 'receivables' ? recData?.paidList?.length || 0 : payData?.paidList?.length || 0}
                </span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              VIEW 1: BELUM LUNAS (ACTIVE BILLING & AGING)
             ========================================================================= */}
          {debtStatus === 'unpaid' && (
            <>
              {/* Sub Tab: Piutang */}
              {debtSubTab === 'receivables' && recData && (
                <div className="space-y-4">
                  {/* Aging Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { label: '0-30 Hari', val: recData.aging.current, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                      { label: '31-60 Hari', val: recData.aging.days30, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                      { label: '61-90 Hari', val: recData.aging.days60, color: 'text-orange-700 bg-orange-50 border-orange-200' },
                      { label: '> 90 Hari (Macet)', val: recData.aging.days90Plus, color: 'text-rose-700 bg-rose-50 border-rose-200' },
                    ].map((ag, i) => (
                      <div key={i} className={`p-3.5 rounded-2xl border ${ag.color}`}>
                        <span className="text-[10px] font-bold block mb-1 uppercase tracking-wide">{ag.label}</span>
                        <span className="text-sm sm:text-base font-black tabular-nums">{formatCurrency(ag.val)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Invoices List */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-[#071A24] text-sm tracking-tight">
                        Daftar Piutang Pelanggan ({recData.list.length} Tagihan Belum Lunas)
                      </h3>
                      <span className="text-xs font-black text-amber-600 tabular-nums">
                        Total: {formatCurrency(recData.totalReceivable)}
                      </span>
                    </div>

                    {recData.list.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs font-medium">
                        Semua piutang pelanggan telah lunas.
                      </div>
                    ) : (
                      <>
                        {/* Mobile Stacked Invoice Cards (No horizontal scroll!) */}
                        <div className="sm:hidden divide-y divide-slate-100">
                          {paginatedUnpaidList.map((r) => {
                            const waMsg = generateWAMessage('tagihan', {
                              contactName: r.contactName,
                              invoiceNumber: r.invoice_number,
                              date: r.date,
                              dueDate: r.due_date,
                              totalAmount: r.total_amount,
                              paidAmount: r.paid_amount,
                              remainingAmount: r.remaining,
                            });
                            const waLink = formatWaLink(r.contactPhone || '08123456789', waMsg);

                            return (
                              <div key={r.id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-extrabold text-sm text-[#071A24]">{r.contactName}</div>
                                    <div className="text-xs text-slate-400 font-mono mt-0.5">
                                      {r.invoice_number} • {formatDate(r.date, 'short')}
                                    </div>
                                  </div>
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 tabular-nums">
                                    {r.daysOutstanding} hari
                                  </span>
                                </div>

                                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-50/40 border border-amber-100">
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Faktur</span>
                                    <span className="text-xs font-bold text-slate-600 tabular-nums">{formatCurrency(r.total_amount)}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] text-amber-800 font-bold uppercase block">Sisa Tagihan</span>
                                    <span className="text-sm font-black text-amber-600 tabular-nums">{formatCurrency(r.remaining)}</span>
                                  </div>
                                </div>

                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full min-h-[38px] flex items-center justify-center gap-1.5 py-2 px-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-xs font-bold transition ios-spring-tap shadow-2xs"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Kirim Pengingat Tagihan via WhatsApp</span>
                                </a>
                              </div>
                            );
                          })}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-left text-xs sm:text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                              <tr>
                                <th className="px-5 py-3.5">Faktur & Tanggal</th>
                                <th className="px-5 py-3.5">Pelanggan</th>
                                <th className="px-5 py-3.5 text-right">Total Transaksi</th>
                                <th className="px-5 py-3.5 text-right">Sisa Piutang</th>
                                <th className="px-5 py-3.5 text-center">Umur</th>
                                <th className="px-5 py-3.5 text-center">Kirim Pengingat</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {paginatedUnpaidList.map((r) => {
                                const waMsg = generateWAMessage('tagihan', {
                                  contactName: r.contactName,
                                  invoiceNumber: r.invoice_number,
                                  date: r.date,
                                  dueDate: r.due_date,
                                  totalAmount: r.total_amount,
                                  paidAmount: r.paid_amount,
                                  remainingAmount: r.remaining,
                                });
                                const waLink = formatWaLink(r.contactPhone || '08123456789', waMsg);

                                return (
                                  <tr key={r.id} className="hover:bg-slate-50/70 transition">
                                    <td className="px-5 py-4">
                                      <div className="font-bold text-[#071A24]">{r.invoice_number}</div>
                                      <div className="text-xs text-slate-400 tabular-nums">{formatDate(r.date, 'short')}</div>
                                    </td>
                                    <td className="px-5 py-4 font-semibold text-[#071A24]">
                                      {r.contactName}
                                      {r.contactPhone && (
                                        <div className="text-[11px] text-slate-400 tabular-nums">{r.contactPhone}</div>
                                      )}
                                    </td>
                                    <td className="px-5 py-4 text-right text-slate-600 tabular-nums">
                                      {formatCurrency(r.total_amount)}
                                    </td>
                                    <td className="px-5 py-4 text-right font-black text-amber-600 tabular-nums">
                                      {formatCurrency(r.remaining)}
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 tabular-nums">
                                        {r.daysOutstanding} hari
                                      </span>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                      <a
                                        href={waLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl text-xs font-bold transition ios-spring-tap"
                                      >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>Kirim WA</span>
                                      </a>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Anti-Lag Load More Button for Unpaid Receivables */}
                        <LoadMoreButton
                          remainingCount={remainingUnpaid}
                          onClick={loadMoreUnpaid}
                        />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Sub Tab: Utang */}
              {debtSubTab === 'payables' && payData && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-[#071A24] text-sm tracking-tight">
                      Rekap Utang Usaha ke Supplier ({payData.list.length} Faktur Belum Lunas)
                    </h3>
                    <span className="text-xs font-black text-rose-600 tabular-nums">
                      Total: {formatCurrency(payData.totalPayable)}
                    </span>
                  </div>

                  {payData.list.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                      Semua utang supplier telah dilunasi.
                    </div>
                  ) : (
                    <>
                      {/* Mobile Stacked Payables Cards */}
                      <div className="sm:hidden divide-y divide-slate-100">
                        {paginatedUnpaidList.map((p) => (
                          <div key={p.id} className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="font-extrabold text-sm text-[#071A24]">{p.contactName}</div>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 tabular-nums">
                                {p.daysOutstanding} hari
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono">{p.invoice_number}</div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <span className="text-xs text-slate-500 font-medium">Total: {formatCurrency(p.total_amount)}</span>
                              <div className="text-right">
                                <span className="text-[10px] text-rose-500 font-bold block">Sisa Utang:</span>
                                <span className="text-sm font-black text-rose-600 tabular-nums">{formatCurrency(p.remaining)}</span>
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
                              <th className="px-5 py-3.5">Faktur & Tanggal</th>
                              <th className="px-5 py-3.5">Supplier</th>
                              <th className="px-5 py-3.5 text-right">Total Transaksi</th>
                              <th className="px-5 py-3.5 text-right">Sisa Utang</th>
                              <th className="px-5 py-3.5 text-center">Umur Utang</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {paginatedUnpaidList.map((p) => (
                              <tr key={p.id} className="hover:bg-slate-50/70 transition">
                                <td className="px-5 py-4 font-bold text-[#071A24]">{p.invoice_number}</td>
                                <td className="px-5 py-4 font-semibold text-[#071A24]">{p.contactName}</td>
                                <td className="px-5 py-4 text-right text-slate-600 tabular-nums">
                                  {formatCurrency(p.total_amount)}
                                </td>
                                <td className="px-5 py-4 text-right font-black text-rose-600 tabular-nums">
                                  {formatCurrency(p.remaining)}
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 tabular-nums">
                                    {p.daysOutstanding} hari
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Anti-Lag Load More Button for Unpaid Payables */}
                      <LoadMoreButton
                        remainingCount={remainingUnpaid}
                        onClick={loadMoreUnpaid}
                      />
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* =========================================================================
              VIEW 2: RIWAYAT LUNAS (ANTI-LAG PAGINATION MAX 20 ITEMS)
             ========================================================================= */}
          {debtStatus === 'paid' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <h3 className="font-bold text-[#071A24] text-sm tracking-tight">
                    {debtSubTab === 'receivables' ? 'Riwayat Piutang Lunas' : 'Riwayat Utang Lunas'} ({currentPaidList.length} Transaksi Selesai)
                  </h3>
                </div>
                <span className="text-xs font-black text-emerald-600 tabular-nums">
                  Status: Lunas 100%
                </span>
              </div>

              {currentPaidList.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Belum Ada Riwayat Pelunasan"
                  description="Faktur yang statusnya telah lunas akan otomatis diarsipkan di riwayat ini agar layar utama tetap bersih."
                />
              ) : (
                <>
                  {/* Mobile Stacked Paid Cards */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {paginatedPaidList.map((item) => (
                      <div key={item.id} className="p-4 space-y-2 hover:bg-slate-50/70 transition">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-extrabold text-sm text-[#071A24]">{item.contactName}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {item.invoice_number} • {formatDate(item.date, 'short')}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Lunas</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-xs text-slate-500 font-medium">Nominal Faktur:</span>
                          <span className="text-sm font-black text-[#071A24] tabular-nums">
                            {formatCurrency(item.total_amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table for Paid History */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="px-5 py-3.5">Faktur & Tanggal</th>
                          <th className="px-5 py-3.5">{debtSubTab === 'receivables' ? 'Pelanggan' : 'Supplier'}</th>
                          <th className="px-5 py-3.5 text-right">Total Transaksi</th>
                          <th className="px-5 py-3.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {paginatedPaidList.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-5 py-4">
                              <div className="font-bold text-[#071A24]">{item.invoice_number}</div>
                              <div className="text-xs text-slate-400 tabular-nums">{formatDate(item.date, 'short')}</div>
                            </td>
                            <td className="px-5 py-4 font-semibold text-[#071A24]">{item.contactName}</td>
                            <td className="px-5 py-4 text-right font-black text-[#071A24] tabular-nums">
                              {formatCurrency(item.total_amount)}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Lunas</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Anti-Lag Load More Button: Max 20 items per click */}
                  <LoadMoreButton
                    remainingCount={remainingPaid}
                    onClick={loadMorePaid}
                  />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: VALUASI STOK (INVENTORY ASSETS)
         ========================================================================= */}
      {!loading && activeReport === 'stock' && valData && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Stock Valuation Summary Cards: Satu Baris Kompak Anti-Scroll */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {/* Box 1: Total Nilai Persediaan */}
            <div className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Nilai Stok
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center shrink-0">
                  <Package className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-xs min-[360px]:text-sm sm:text-2xl lg:text-3xl font-black text-[#00D29E] tabular-nums tracking-tight truncate">
                {formatCurrency(valData.totalValuation)}
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Nilai aset persediaan
              </div>
            </div>

            {/* Box 2: Jumlah Komoditas */}
            <div className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Total Komoditas
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-slate-100 text-[#071A24] flex items-center justify-center shrink-0">
                  <Layers className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-xs min-[360px]:text-sm sm:text-2xl lg:text-3xl font-black text-[#071A24] tabular-nums tracking-tight truncate">
                {valData.items?.length || 0} Barang
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 font-medium truncate hidden min-[360px]:block">
                Terdaftar di gudang
              </div>
            </div>

            {/* Box 3: Metode Penilaian */}
            <div className="bg-white p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between min-w-0">
              <div className="flex items-center justify-between mb-1 gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-tight sm:tracking-wider truncate">
                  Metode HPP
                </span>
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
              </div>
              <div className="text-xs min-[360px]:text-sm sm:text-xl lg:text-2xl font-black text-[#071A24] tracking-tight truncate">
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
    </div>
  );
}
