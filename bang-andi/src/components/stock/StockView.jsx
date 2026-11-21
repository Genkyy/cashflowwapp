import { useState, useMemo } from 'react';
import { useLiveQuery } from '../../hooks/useLiveQuery.js';
import { db } from '../../lib/db.js';
import { useStock } from '../../hooks/useStock.js';
import { formatCurrency, formatDate, formatNumber } from '../../lib/formatters.js';
import {
  Package,
  Layers,
  Activity,
  Plus,
  Minus,
  Edit3,
  AlertTriangle,
  History,
  Tag,
  Scale,
  Sparkles,
  Droplets,
  Egg,
  Beef,
  Milk,
  ArrowRight,
  Search,
  X,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  SlidersHorizontal,
  Check,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { SkeletonCard, SkeletonTable } from '../ui/Skeleton.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import BottomSheet from '../ui/BottomSheet.jsx';
import Button from '../ui/Button.jsx';

/**
 * FlowMint-style Stock & Commodities View
 * Aligned with CV Amanah Barokah Design Language:
 * - FlowMint Midnight Navy & Mint Green palette (#071A24, #00D29E)
 * - Hero stats row (Total Valuasi Aset, Stok Menipis/Kritis, Jumlah Barang, Mutasi Terakhir)
 * - Deduplicated, clean commodity category filter chips (No duplicate pills!)
 * - Instant Search Bar by commodity or item name
 * - Sleek card design with clear multi-unit conversion and capacity progress bars
 * - Quick Stock Opname / Adjustment modal
 */
export default function StockView() {
  const { adjustStock } = useStock();

  // 1. Live Queries
  const items = useLiveQuery(() => db.items.toArray(), [], []);
  const commodities = useLiveQuery(() => db.commodities.toArray(), [], []);
  const conversions = useLiveQuery(() => db.unit_conversions.toArray(), [], []);
  const mutations = useLiveQuery(() => db.stock_mutations.toArray(), [], []);

  const isLoading = items === undefined || commodities === undefined;

  // 2. Navigation & Filter State
  const [activeTab, setActiveTab] = useState('inventory'); // inventory | mutations | livestock
  const [selectedCommodity, setSelectedCommodity] = useState('all');
  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState('all'); // all | warning | safe
  const [showAllMutations, setShowAllMutations] = useState(false);

  // 3. Adjustment Modal State
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('Selisih Opname');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lucide Icons category mapping
  const getCommodityIcon = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('minyak')) return Droplets;
    if (n.includes('telur')) return Egg;
    if (n.includes('sapi')) return Beef;
    if (n.includes('domba')) return Beef;
    if (n.includes('susu')) return Milk;
    return Package;
  };

  // Deduplicate commodities by clean name (Eliminates the duplicate pills bug!)
  const uniqueCommodities = useMemo(() => {
    const seen = new Set();
    const result = [];
    (commodities || []).forEach((c) => {
      const normalized = (c.name || '').trim().toLowerCase();
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(c);
      }
    });
    return result;
  }, [commodities]);

  const commodityMap = useMemo(() => {
    const map = new Map();
    (commodities || []).forEach((c) => map.set(String(c.id), c.name));
    return map;
  }, [commodities]);

  // Primary conversion string generator (e.g. "160 Liter (8 Jerigen)")
  const formatStockWithAlt = (item) => {
    const stockVal = Number(item.stock) || 0;
    const baseText = `${formatNumber(stockVal)} ${item.base_unit}`;

    if (!conversions) return baseText;

    const itemConv = conversions.find((c) => String(c.item_id) === String(item.id));
    if (!itemConv || !itemConv.factor || Number(itemConv.factor) === 0) {
      return baseText;
    }

    const altVal = stockVal / Number(itemConv.factor);
    const roundedAlt = Number.isInteger(altVal) ? altVal : Number(altVal.toFixed(1));
    return `${baseText} • ${formatNumber(roundedAlt)} ${itemConv.unit_name}`;
  };

  // Calculations for Hero Stats
  const totalInventoryValuation = useMemo(() => {
    return (items || []).reduce(
      (sum, it) => sum + (Number(it.stock) || 0) * (Number(it.hpp) || 0),
      0
    );
  }, [items]);

  const lowStockItems = useMemo(() => {
    return (items || []).filter(
      (it) => Number(it.stock) <= (Number(it.min_stock) || 0)
    );
  }, [items]);

  const warningStockItems = useMemo(() => {
    return (items || []).filter(
      (it) => {
        const s = Number(it.stock) || 0;
        const m = Number(it.min_stock) || 0;
        return s > m && s <= m * 1.5;
      }
    );
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return (items || []).filter((it) => {
      // Category filter
      if (selectedCommodity !== 'all') {
        const selectedObj = uniqueCommodities.find((c) => String(c.id) === String(selectedCommodity));
        const itemCategoryName = (commodityMap.get(String(it.commodity_id)) || '').toLowerCase();
        if (selectedObj) {
          const targetName = selectedObj.name.toLowerCase();
          if (itemCategoryName !== targetName && String(it.commodity_id) !== String(selectedCommodity)) {
            return false;
          }
        }
      }

      // Condition filter
      const stockVal = Number(it.stock) || 0;
      const minStockVal = Number(it.min_stock) || 0;
      if (conditionFilter === 'warning') {
        if (stockVal > minStockVal * 1.5) return false;
      } else if (conditionFilter === 'safe') {
        if (stockVal <= minStockVal * 1.5) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (it.name || '').toLowerCase().includes(q);
        const matchCat = (commodityMap.get(String(it.commodity_id)) || '').toLowerCase().includes(q);
        return matchName || matchCat;
      }

      return true;
    });
  }, [items, selectedCommodity, conditionFilter, search, uniqueCommodities, commodityMap]);

  // Save Adjustment
  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    const delta = Number(adjustDelta);
    if (!isNaN(delta) && delta !== 0 && adjustingItem) {
      setIsSubmitting(true);
      try {
        await adjustStock(adjustingItem.id, delta, adjustReason, adjustNotes);
        setAdjustingItem(null);
        setAdjustDelta('');
        setAdjustNotes('');
      } catch (err) {
        alert('Gagal menyesuaikan stok: ' + err.message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      {/* =========================================================================
          1. TOP BAR: TITLE + HERO METRICS
         ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00D29E] to-[#10B981] flex items-center justify-center shadow-sm shadow-emerald-500/20 text-white">
              <Package className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-[#071A24]">
              Stok & Komoditas <span className="text-[#00D29E] font-medium text-xs tracking-normal px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">FlowMint Inventory</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#071A24]">
            Katalog & Manajemen Gudang
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Monitoring stok multi-satuan, HPP Moving Average, dan aset komoditas riil.
          </p>
        </div>
      </div>

      {/* =========================================================================
          2. FLOWMINT HERO METRIC CARDS
         ========================================================================= */}
      <div className="space-y-3 sm:space-y-4">
        {/* Card 1: Total Valuasi Gudang (Full Width Hero Banner) */}
        <div className="bg-gradient-to-br from-[#071A24] to-[#0B2533] text-white rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-xs font-semibold text-slate-300">Total Valuasi Stok Gudang</span>
            <div className="w-7 h-7 rounded-xl bg-white/10 text-[#00D29E] flex items-center justify-center">
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#00D29E] tracking-tight tabular-nums">
            {formatCurrency(totalInventoryValuation)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">
            Moving Average HPP • Total nilai persediaan komoditas aktif
          </div>
        </div>

        {/* 1 Baris Rata Berisi 3 Kartu (Stok Kritis, Jenis Barang, Total Mutasi) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
          {/* Card 2: Stok Kritis / Menipis */}
          <div
            onClick={() => setConditionFilter(conditionFilter === 'warning' ? 'all' : 'warning')}
            className={`bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-xs transition cursor-pointer flex flex-col justify-between ${conditionFilter === 'warning' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100'
              }`}
            title="Klik untuk filter stok kritis/menipis"
          >
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Stok Kritis</span>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>
            <div className="text-sm sm:text-lg lg:text-xl font-black text-amber-600 tracking-tight tabular-nums">
              {lowStockItems.length + warningStockItems.length} Barang
            </div>
            <div className="mt-1 text-[9px] sm:text-[11px] text-amber-700/80 font-bold truncate">
              {lowStockItems.length > 0 ? `${lowStockItems.length} perlu restok` : 'Semua aman'}
            </div>
          </div>

          {/* Card 3: Total Komoditas Terdaftar */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Jenis Barang</span>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-slate-100 text-[#071A24] flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>
            <div className="text-sm sm:text-lg lg:text-xl font-black text-[#071A24] tracking-tight tabular-nums">
              {items?.length || 0} Barang
            </div>
            <div className="mt-1 text-[9px] sm:text-[11px] text-slate-400 font-medium truncate">
              {uniqueCommodities.length} komoditas
            </div>
          </div>

          {/* Card 4: Riwayat Mutasi */}
          <div
            onClick={() => setActiveTab('mutations')}
            className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-4 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-xs transition cursor-pointer flex flex-col justify-between"
            title="Buka tab riwayat mutasi stok"
          >
            <div className="flex items-center justify-between mb-1 sm:mb-2">
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate">Total Mutasi</span>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center shrink-0">
                <Activity className="w-3.5 h-3.5 stroke-[2.5]" />
              </div>
            </div>
            <div className="text-sm sm:text-lg lg:text-xl font-black text-[#00D29E] tracking-tight tabular-nums">
              {mutations?.length || 0} Catatan
            </div>
            <div className="mt-1 text-[9px] sm:text-[11px] text-slate-400 font-medium truncate">
              Log riwayat
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. FLOWMINT SEGMENTED TABS (Katalog | Mutasi | Ternak)
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-1.5 sm:p-2 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
        <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
          {[
            { id: 'inventory', label: 'Katalog', fullLabel: 'Katalog Stok', icon: Package },
            { id: 'mutations', label: 'Mutasi', fullLabel: 'Riwayat Mutasi', icon: History },
            { id: 'livestock', label: 'Ternak', fullLabel: 'Aset Ternak', icon: Beef },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`h-10 sm:h-11 px-2 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer select-none whitespace-nowrap ${isActive
                  ? 'bg-[#071A24] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-[#00D29E]' : 'text-slate-400'} stroke-[2.5] shrink-0`} />
                <span className="truncate">
                  <span className="sm:hidden">{tab.label}</span>
                  <span className="hidden sm:inline">{tab.fullLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: INVENTARIS KOMODITAS
         ========================================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Controls: Deduplicated Category Chips + Search Bar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3">
            {/* Category Filter Chips (Clean & Deduplicated!) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCommodity('all')}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition shrink-0 cursor-pointer ${selectedCommodity === 'all'
                  ? 'bg-[#071A24] text-white shadow-xs'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                  }`}
              >
                Semua Komoditas ({items?.length || 0})
              </button>

              {uniqueCommodities.map((c) => {
                const isSelected = String(selectedCommodity) === String(c.id);
                const Icon = getCommodityIcon(c.name);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCommodity(c.id)}
                    className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${isSelected
                      ? 'bg-[#071A24] text-white shadow-xs'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                      }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#00D29E]' : 'text-slate-400'}`} />
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input & Status Quick Filter */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama komoditas atau varian..."
                  className="w-full pl-10 pr-9 py-2 min-h-[42px] text-xs sm:text-sm bg-slate-50 border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00D29E] focus:border-[#00D29E] transition font-medium text-slate-800"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
                    title="Hapus pencarian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Condition Quick Filter Chips (Fintech Style) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar shrink-0">
                {[
                  { id: 'all', label: 'Semua Stok' },
                  { id: 'safe', label: 'Stok Aman' },
                  { id: 'warning', label: 'Kritis / Menipis', count: lowStockItems.length + warningStockItems.length },
                ].map((st) => {
                  const isSel = conditionFilter === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setConditionFilter(st.id)}
                      className={`px-3 py-2 min-h-[42px] rounded-2xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${isSel
                        ? 'bg-[#071A24] text-white shadow-xs'
                        : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                        }`}
                    >
                      <span>{st.label}</span>
                      {st.count !== undefined && st.count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSel ? 'bg-amber-400 text-[#071A24]' : 'bg-amber-100 text-amber-700'
                          }`}>
                          {st.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <SkeletonCard height="h-44" />
              <SkeletonCard height="h-44" />
              <SkeletonCard height="h-44" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Komoditas Tidak Ditemukan"
              description={
                search || selectedCommodity !== 'all' || conditionFilter !== 'all'
                  ? 'Tidak ada komoditas yang cocok dengan filter atau kata kunci pencarian Anda.'
                  : 'Belum ada barang komoditas yang terdaftar di database.'
              }
              actionLabel="Tampilkan Semua Komoditas"
              onAction={() => {
                setSelectedCommodity('all');
                setSearch('');
                setConditionFilter('all');
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredItems.map((item) => {
                const Icon = getCommodityIcon(item.name);
                const stockVal = Number(item.stock) || 0;
                const minStockVal = Number(item.min_stock) || 0;
                const hppVal = Number(item.hpp) || 0;
                const valuation = stockVal * hppVal;
                const categoryName = commodityMap.get(String(item.commodity_id)) || 'Komoditas';

                // Status & Progress calculation
                let statusLabel = 'Aman';
                let statusBadgeClass = 'bg-emerald-50 text-[#00D29E] border-emerald-200';
                let barColorClass = 'bg-[#00D29E]';

                const maxCapacityRef = Math.max(minStockVal * 3, stockVal, 10);
                const progressPercent = Math.min(100, Math.max(5, Math.round((stockVal / maxCapacityRef) * 100)));

                if (stockVal <= minStockVal) {
                  statusLabel = 'Kritis';
                  statusBadgeClass = 'bg-rose-50 text-rose-600 border-rose-200';
                  barColorClass = 'bg-rose-500';
                } else if (stockVal <= minStockVal * 1.5) {
                  statusLabel = 'Menipis';
                  statusBadgeClass = 'bg-amber-50 text-amber-600 border-amber-200';
                  barColorClass = 'bg-amber-500';
                }

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:border-slate-200/80 transition flex flex-col justify-between space-y-3.5"
                  >
                    {/* Header: Icon, Name & Valuation */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#00D29E] flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
                          <Icon className="w-5 h-5 stroke-[2.25]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-[#071A24] text-sm sm:text-base leading-snug truncate tracking-tight">
                            {item.name}
                          </h3>
                          <div className="text-xs text-slate-500 mt-0.5 font-medium truncate">
                            {categoryName} • <strong className="text-[#071A24] font-bold tabular-nums">{formatStockWithAlt(item)}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Valuation */}
                      <div className="text-right shrink-0">
                        <div className="text-sm sm:text-base font-black text-[#071A24] tabular-nums">
                          {formatCurrency(valuation)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium tabular-nums mt-0.5">
                          HPP: {formatCurrency(hppVal)}/{item.base_unit}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar & Status */}
                    <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium text-[11px]">Kondisi:</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-500 tabular-nums text-[11px]">
                          Min: {item.min_stock} {item.base_unit}
                        </span>
                      </div>

                      {/* Track */}
                      <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer: Price & Adjust Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                      <span className="text-xs text-slate-500 truncate">
                        Harga Jual: <strong className="text-[#071A24] font-black tabular-nums">{formatCurrency(item.selling_price)}</strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setAdjustingItem(item);
                          setAdjustDelta('');
                          setAdjustNotes('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#071A24] hover:text-white text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                        title="Sesuaikan stok (Opname)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sesuaikan</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: MUTATIONS HISTORY
         ========================================================================= */}
      {activeTab === 'mutations' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {mutations === undefined ? (
            <div className="space-y-3">
              <SkeletonCard height="h-20" />
              <SkeletonCard height="h-20" />
            </div>
          ) : (mutations || []).length === 0 ? (
            <EmptyState
              icon={History}
              title="Belum Ada Mutasi Stok"
              description="Riwayat perubahan stok dari transaksi atau opname fisik akan otomatis tercatat di sini."
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00D29E]" />
                  <span className="text-xs font-bold text-[#071A24]">
                    {showAllMutations ? 'Semua Catatan Mutasi' : '5 Mutasi Stok Terkini'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    Total {mutations?.length || 0}
                  </span>
                </div>
                {(mutations || []).length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllMutations(!showAllMutations)}
                    className="text-xs font-bold text-[#00D29E] hover:underline cursor-pointer"
                  >
                    {showAllMutations ? 'Tampilkan 5 Terbaru' : `Lihat Semua (${mutations?.length || 0}) →`}
                  </button>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] divide-y divide-slate-100 overflow-hidden">
                {(showAllMutations ? (mutations || []).slice().reverse() : (mutations || []).slice().reverse().slice(0, 5))
                  .map((m) => {
                    const item = items?.find((it) => String(it.id) === String(m.item_id));
                    const isIn = m.type === 'in';
                    return (
                      <div
                        key={m.id}
                        className="p-4 sm:px-5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${isIn
                              ? 'bg-emerald-50 text-[#00D29E] border-emerald-200/60'
                              : 'bg-rose-50 text-rose-600 border-rose-200/60'
                              }`}
                          >
                            {isIn ? (
                              <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                            ) : (
                              <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-[#071A24] truncate">
                              {item ? item.name : 'Komoditas'}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 font-medium">
                              Perubahan: <span className="tabular-nums font-bold text-[#071A24]">{m.previous_stock} → {m.new_stock}</span> {m.unit || ''} • <span className="tabular-nums text-slate-400">{formatDate(m.date, 'short')}</span>
                            </div>
                            {m.notes && (
                              <div className="text-[11px] text-slate-400 italic line-clamp-1 mt-0.5">
                                "{m.notes}"
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`font-black text-sm sm:text-base tabular-nums ${isIn ? 'text-[#00D29E]' : 'text-rose-600'
                              }`}
                          >
                            {isIn ? '+' : '-'}{m.qty} {m.unit || ''}
                          </div>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${isIn
                              ? 'bg-emerald-50 text-[#00D29E] border-emerald-200'
                              : 'bg-rose-50 text-rose-600 border-rose-200'
                              }`}
                          >
                            {isIn ? 'Masuk' : 'Keluar'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {(mutations || []).length > 5 && !showAllMutations && (
                <button
                  type="button"
                  onClick={() => setShowAllMutations(true)}
                  className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <span>Buka Semua Riwayat Mutasi ({mutations?.length || 0} Catatan)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: LIVESTOCK ASSETS (SAPI & DOMBA)
         ========================================================================= */}
      {activeTab === 'livestock' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-4 rounded-3xl bg-gradient-to-r from-[#071A24] to-[#0B2533] text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#00D29E] flex items-center justify-center shrink-0">
                <Beef className="w-5 h-5 stroke-[2.25]" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base">Tracking Individu Hewan Ternak</h3>
                <p className="text-xs text-slate-300">
                  Ear Tag, timbangan bobot berkala, dan status kesehatan Sapi Limousin & Domba Garut
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[
              { tag: 'LMS-001', jenis: 'Sapi Limousin', bobot: '520 kg', status: 'Sehat', beli: 'Rp 18.500.000' },
              { tag: 'LMS-002', jenis: 'Sapi Limousin', bobot: '485 kg', status: 'Sehat', beli: 'Rp 17.000.000' },
              { tag: 'LMS-003', jenis: 'Sapi Limousin', bobot: '540 kg', status: 'Sehat', beli: 'Rp 18.000.000' },
              { tag: 'DG-001', jenis: 'Domba Garut', bobot: '45 kg', status: 'Sehat', beli: 'Rp 3.500.000' },
              { tag: 'DG-002', jenis: 'Domba Garut', bobot: '42 kg', status: 'Sehat', beli: 'Rp 3.200.000' },
              { tag: 'DG-003', jenis: 'Domba Garut', bobot: '38 kg', status: 'Sehat', beli: 'Rp 3.000.000' },
            ].map((ternak) => (
              <div
                key={ternak.tag}
                className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#071A24] text-sm flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-[#00D29E]" />
                    <span>Tag: {ternak.tag}</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#00D29E] border border-emerald-200">
                    {ternak.status}
                  </span>
                </div>

                <div className="p-3 bg-slate-50/80 rounded-2xl space-y-1.5 text-xs border border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Jenis:</span>
                    <strong className="text-[#071A24] font-bold">{ternak.jenis}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Bobot Terkini:</span>
                    <strong className="text-[#00D29E] font-black tabular-nums">{ternak.bobot}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Harga Beli Awal:</span>
                    <span className="font-semibold text-slate-700 tabular-nums">{ternak.beli}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          ADJUSTMENT MODAL / BOTTOM SHEET
         ========================================================================= */}
      <BottomSheet
        isOpen={!!adjustingItem}
        onClose={() => setAdjustingItem(null)}
        title={
          <div className="flex items-center gap-2.5 text-[#071A24]">
            <div className="w-7 h-7 rounded-xl bg-[#00D29E]/20 text-[#00D29E] flex items-center justify-center">
              <Edit3 className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-base">Penyesuaian Stok: {adjustingItem?.name}</span>
          </div>
        }
        size="md"
      >
        {adjustingItem && (
          <form onSubmit={handleSaveAdjustment} className="space-y-4">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
              <span>Stok tercatat di sistem:</span>
              <strong className="text-[#071A24] font-black text-sm tabular-nums">
                {adjustingItem.stock} {adjustingItem.base_unit}
              </strong>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#071A24] mb-1.5">
                Selisih Jumlah (Gunakan minus '-' jika stok berkurang fisik)
              </label>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                placeholder="Contoh: -5 (rusak/pecah) atau +10 (kelebihan fisik)"
                className="input-field tabular-nums rounded-2xl border-slate-200/80"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#071A24] mb-1.5">
                Alasan Penyesuaian
              </label>
              <select
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="input-field font-semibold rounded-2xl border-slate-200/80"
              >
                <option value="Selisih Opname">Selisih Opname Fisik</option>
                <option value="Rusak / Pecah">Rusak / Pecah</option>
                <option value="Kadaluwarsa / Basi">Kadaluwarsa / Basi</option>
                <option value="Susut Bobot / Volume">Susut Bobot / Volume</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#071A24] mb-1.5">
                Catatan Penjelasan
              </label>
              <input
                type="text"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Keterangan saksi atau penyebab selisih..."
                className="input-field rounded-2xl border-slate-200/80"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-[#071A24] hover:bg-[#0B2533] text-white font-bold text-xs shadow-xs transition ios-spring-tap cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4 text-[#00D29E] stroke-[3]" />
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}</span>
              </button>
            </div>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
