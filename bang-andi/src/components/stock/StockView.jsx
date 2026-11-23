import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from '../../hooks/useLiveQuery.js';
import { db } from '../../lib/db.js';
import { useStock } from '../../hooks/useStock.js';
import { useAppStore } from '../../lib/store.js';
import { formatCurrency, formatDate, formatNumber } from '../../lib/formatters.js';
import StockItemModal from './StockItemModal.jsx';
import { syncStandardCatalog } from '../../lib/seed.js';
import { translateErrorMessage } from '../../lib/errorHandler.js';
import {
  Package,
  Layers,
  Activity,
  Plus,
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
  Fish,
  RotateCcw,
  Search,
  X,
  SlidersHorizontal,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown
} from 'lucide-react';
import { SkeletonCard } from '../ui/Skeleton.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import BottomSheet from '../ui/BottomSheet.jsx';
import LoadMoreButton from '../ui/LoadMoreButton.jsx';
import usePagination from '../../hooks/usePagination.js';

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
  const { adjustStock, createItem, updateItem, deleteItem } = useStock();
  const { addNotification, showStockForm, setShowStockForm } = useAppStore();

  // 1. Live Queries
  const items = useLiveQuery(() => db.items.toArray(), [], []);
  const commodities = useLiveQuery(() => db.commodities.toArray(), [], []);
  const conversions = useLiveQuery(() => db.unit_conversions.toArray(), [], []);
  const mutations = useLiveQuery(() => db.stock_mutations.toArray(), [], []);
  const livestock = useLiveQuery(() => db.livestock_records ? db.livestock_records.toArray() : [], [], []);

  const isLoading = items === undefined || commodities === undefined;

  // 2. Navigation & Filter State
  const [activeTab, setActiveTab] = useState('inventory'); // inventory | mutations | livestock
  const [selectedCommodity, setSelectedCommodity] = useState('all');
  const [mutationCommodity, setMutationCommodity] = useState('all');
  const [commoditySheetTarget, setCommoditySheetTarget] = useState('inventory'); // 'inventory' | 'mutations'
  const [isCommoditySheetOpen, setIsCommoditySheetOpen] = useState(false);
  const [commoditySheetSearch, setCommoditySheetSearch] = useState('');
  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState('all'); // all | warning | safe
  const [mutationPeriod, setMutationPeriod] = useState('this_month'); // this_month (Anti-Lag default) | all | last_30_days
  const [now] = useState(() => new Date());

  // 3. Tambah & Ubah Barang Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Sync with global showStockForm trigger
  useEffect(() => {
    if (showStockForm) {
      setEditingItem(null);
      setIsItemModalOpen(true);
      setShowStockForm(false);
    }
  }, [showStockForm, setShowStockForm]);

  // Handlers for Add / Edit / Delete Stock Items
  const handleSaveItem = async (formData) => {
    if (formData.id) {
      await updateItem(formData.id, formData);
      addNotification({
        message: `Barang "${formData.name}" berhasil diperbarui.`,
        type: 'success',
      });
    } else {
      await createItem(formData);
      addNotification({
        message: `Barang "${formData.name}" berhasil ditambahkan ke stok.`,
        type: 'success',
      });
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await deleteItem(itemId);
      addNotification({
        message: 'Barang berhasil dihapus dari inventaris stok.',
        type: 'info',
      });
    } catch (err) {
      const friendly = translateErrorMessage(err, 'Gagal menghapus data barang.');
      addNotification({
        message: friendly,
        type: 'error',
      });
      throw err;
    }
  };

  // 4. Adjustment Modal State
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('Selisih Opname');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 5. Livestock Weight Modal State
  const [weighingLivestock, setWeighingLivestock] = useState(null);
  const [newWeight, setNewWeight] = useState('');
  const [weightNotes, setWeightNotes] = useState('');
  const [isWeighingSubmitting, setIsWeighingSubmitting] = useState(false);

  const handleSaveWeight = async (e) => {
    e.preventDefault();
    if (isWeighingSubmitting) return;
    if (!weighingLivestock || !newWeight) return;
    const wNum = Number(newWeight) || 0;
    if (wNum <= 0) return;

    setIsWeighingSubmitting(true);
    try {
      const now = new Date();
      await db.livestock_weights.add({
        livestock_id: weighingLivestock.id,
        weight: wNum,
        date: now.toISOString(),
        notes: weightNotes.trim() || 'Timbang bobot berkala',
      });
      await db.livestock_records.update(weighingLivestock.id, {
        current_weight: wNum,
        updated_at: now.toISOString(),
      });
      setWeighingLivestock(null);
      setNewWeight('');
      setWeightNotes('');
    } catch (err) {
      console.error('Error saving weight:', err);
    } finally {
      setIsWeighingSubmitting(false);
    }
  };

  // Lucide Icons category mapping
  const getCommodityIcon = (name = '') => {
    const n = name.toLowerCase();
    if (n.includes('minyak')) return Droplets;
    if (n.includes('telur')) return Egg;
    if (n.includes('sapi')) return Beef;
    if (n.includes('domba')) return Beef;
    if (n.includes('susu')) return Milk;
    if (n.includes('nila') || n.includes('ikan')) return Fish;
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

  // Selected commodity object
  const selectedCommodityObj = useMemo(() => {
    if (selectedCommodity === 'all') return null;
    return uniqueCommodities.find((c) => String(c.id) === String(selectedCommodity)) || null;
  }, [selectedCommodity, uniqueCommodities]);

  // Selected mutation commodity object
  const selectedMutationCommodityObj = useMemo(() => {
    if (mutationCommodity === 'all') return null;
    return uniqueCommodities.find((c) => String(c.id) === String(mutationCommodity)) || null;
  }, [mutationCommodity, uniqueCommodities]);

  // Total items count per commodity
  const commodityItemCounts = useMemo(() => {
    const counts = {};
    (items || []).forEach((item) => {
      const cid = String(item.commodity_id);
      counts[cid] = (counts[cid] || 0) + 1;
    });
    return counts;
  }, [items]);

  // Filtered commodities list for BottomSheet search
  const filteredSheetCommodities = useMemo(() => {
    if (!commoditySheetSearch.trim()) return uniqueCommodities;
    const q = commoditySheetSearch.toLowerCase().trim();
    return uniqueCommodities.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [uniqueCommodities, commoditySheetSearch]);

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
      // Category filter with enhanced flexible matching
      if (selectedCommodity !== 'all') {
        const selectedObj = uniqueCommodities.find((c) => String(c.id) === String(selectedCommodity));
        const itemCategoryName = (commodityMap.get(String(it.commodity_id)) || '').toLowerCase();
        if (selectedObj) {
          const targetName = selectedObj.name.toLowerCase();
          const matchCommodityId = String(it.commodity_id) === String(selectedCommodity);
          const matchCategoryName = itemCategoryName.includes(targetName);
          const matchItemName = (it.name || '').toLowerCase().includes(targetName);
          if (!matchCommodityId && !matchCategoryName && !matchItemName) {
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
    if (isSubmitting) return;
    const delta = Number(adjustDelta);
    if (isNaN(delta) || delta === 0) {
      addNotification({
        message: 'Silakan masukkan selisih jumlah penyesuaian stok (tidak boleh 0).',
        type: 'error',
      });
      return;
    }
    if (!adjustingItem) return;

    setIsSubmitting(true);
    try {
      await adjustStock(adjustingItem.id, delta, adjustReason, adjustNotes);
      addNotification({
        message: `Penyesuaian stok "${adjustingItem.name}" (${delta > 0 ? '+' : ''}${delta} ${adjustingItem.base_unit || ''}) berhasil dicatat.`,
        type: 'success',
      });
      setAdjustingItem(null);
      setAdjustDelta('');
      setAdjustNotes('');
    } catch (err) {
      const friendly = translateErrorMessage(err, 'Gagal menyesuaikan stok.');
      addNotification({
        message: friendly,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered Mutations with default 'Bulan Ini' (Anti-Lag)
  const filteredMutations = useMemo(() => {
    const list = (mutations || []).slice().reverse();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const lastMonthDate = new Date(curYear, curMonth - 1, 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();

    return list.filter((m) => {
      const mDate = new Date(m.date);
      if (mutationPeriod === 'this_month') {
        if (mDate.getMonth() !== curMonth || mDate.getFullYear() !== curYear) return false;
      } else if (mutationPeriod === 'last_month') {
        if (mDate.getMonth() !== lastMonth || mDate.getFullYear() !== lastMonthYear) return false;
      } else if (mutationPeriod === 'last_30_days') {
        if (mDate.getTime() < thirtyDaysAgo.getTime()) return false;
      }

      // Commodity filter (Dynamic Data Scalability)
      if (mutationCommodity !== 'all') {
        const item = (items || []).find((it) => String(it.id) === String(m.item_id));
        if (!item) return false;
        const matchCid = String(item.commodity_id) === String(mutationCommodity);
        const selectedObj = uniqueCommodities.find((c) => String(c.id) === String(mutationCommodity));
        const matchName = selectedObj && (item.name || '').toLowerCase().includes(selectedObj.name.toLowerCase());
        if (!matchCid && !matchName) return false;
      }

      return true;
    });
  }, [mutations, mutationPeriod, mutationCommodity, items, uniqueCommodities, now]);

  // Anti-Lag Pagination: 20 items initial view, reset on period change
  const {
    displayedItems: paginatedMutations,
    remainingCount: remainingMutations,
    loadMore: loadMoreMutations,
  } = usePagination(filteredMutations, {
    initialLimit: 20,
    step: 20,
    resetDependencies: [mutationPeriod, mutationCommodity, activeTab],
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      {/* =========================================================================
          1. TOP BAR: TITLE + HERO METRICS + TAMBAH STOK ACTION
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

        {/* Action Buttons: Tambah Barang + Sinkron Standar */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <button
            type="button"
            onClick={async () => {
              await syncStandardCatalog();
              addNotification({
                message: 'Katalog berhasil disinkronkan dengan standar (Sunco, Minyak Kita, Telur, Susu UHT, Nila, Domba, Sapi).',
                type: 'success',
              });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition ios-spring-tap cursor-pointer"
            title="Sinkronkan nama, satuan kerdus/paket, dan harga standar"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#00D29E]" />
            <span className="hidden sm:inline">Sinkron</span> Standar
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsItemModalOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-[#00D29E] hover:bg-[#10B981] active:scale-95 text-[#071A24] px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm shadow-sm transition ios-spring-tap cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Tambah Barang</span>
          </button>
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
          {/* Controls: Search Bar + Commodity Selector Trigger + Status Filter */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3">
            {/* Row 1: Search Bar & Commodity Selector Button */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama barang atau varian stok..."
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

              {/* Trigger Button: Opens Bottom Sheet for Commodity Selection */}
              <button
                type="button"
                onClick={() => {
                  setCommoditySheetSearch('');
                  setIsCommoditySheetOpen(true);
                }}
                className={`px-3.5 py-2 min-h-[42px] rounded-2xl text-xs font-bold transition flex items-center justify-between gap-2.5 cursor-pointer shrink-0 border ${
                  selectedCommodity !== 'all'
                    ? 'bg-[#071A24] text-white border-[#071A24] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100/80 text-slate-700 border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-2 truncate max-w-[190px] sm:max-w-[220px]">
                  {selectedCommodityObj ? (
                    (() => {
                      const Icon = getCommodityIcon(selectedCommodityObj.name);
                      return <Icon className="w-4 h-4 text-[#00D29E] shrink-0" />;
                    })()
                  ) : (
                    <Package className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">
                    {selectedCommodityObj ? selectedCommodityObj.name : 'Semua Komoditas'}
                  </span>
                  {selectedCommodity !== 'all' && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#00D29E]/20 text-[#00D29E] font-bold">
                      {commodityItemCounts[String(selectedCommodity)] || 0}
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 transition shrink-0 ${selectedCommodity !== 'all' ? 'text-slate-300' : 'text-slate-400'}`} />
              </button>
            </div>

            {/* Row 2: Status Quick Filter Chips + Active Filter Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100/60">
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        isSel
                          ? 'bg-[#071A24] text-white shadow-xs'
                          : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      <span>{st.label}</span>
                      {st.count !== undefined && st.count > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSel ? 'bg-amber-400 text-[#071A24]' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {st.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedCommodity !== 'all' && selectedCommodityObj && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                  <span>Komoditas: <strong className="text-slate-800">{selectedCommodityObj.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => setSelectedCommodity('all')}
                    className="p-0.5 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Reset filter komoditas"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
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
              actionLabel={items?.length === 0 ? '+ Tambah Barang Baru' : 'Tampilkan Semua Komoditas'}
              onAction={() => {
                if (items?.length === 0) {
                  setEditingItem(null);
                  setIsItemModalOpen(true);
                } else {
                  setSelectedCommodity('all');
                  setSearch('');
                  setConditionFilter('all');
                }
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
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-400 block font-semibold leading-none">Harga Jual</span>
                        <div className="text-xs sm:text-sm text-[#071A24] font-black tabular-nums mt-0.5 truncate">
                          {formatCurrency(item.selling_price)}
                          <span className="text-[11px] text-slate-400 font-normal"> / {item.base_unit}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setIsItemModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#071A24] hover:text-white text-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Ubah data barang, stok & harga"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#00D29E]" />
                          <span>Ubah</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAdjustingItem(item);
                            setAdjustDelta('');
                            setAdjustNotes('');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Sesuaikan stok fisik (Opname)"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Opname</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: MUTATIONS HISTORY (Anti-Lag Pagination & Default Bulan Ini)
         ========================================================================= */}
      {activeTab === 'mutations' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Period Filter Bar & Stats */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00D29E]" />
                <h3 className="font-extrabold text-sm sm:text-base text-[#071A24]">
                  Riwayat Mutasi Stok
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">
                  {filteredMutations.length} Catatan
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Log pergerakan barang masuk/keluar dari nota dan penyesuaian opname fisik.
              </p>
            </div>

            {/* Controls: Compact Commodity Trigger + Period Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-stretch sm:self-auto">
              {/* Compact Filter Trigger: Komoditas */}
              <button
                type="button"
                onClick={() => {
                  setCommoditySheetTarget('mutations');
                  setCommoditySheetSearch('');
                  setIsCommoditySheetOpen(true);
                }}
                className={`px-3 py-1.5 min-h-[38px] rounded-2xl text-xs font-bold transition flex items-center justify-between gap-2 cursor-pointer border ${
                  mutationCommodity !== 'all'
                    ? 'bg-[#071A24] text-white border-[#071A24] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
                }`}
                title="Saring mutasi berdasarkan komoditas"
              >
                <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                  <Package className={`w-3.5 h-3.5 shrink-0 ${mutationCommodity !== 'all' ? 'text-[#00D29E]' : 'text-slate-400'}`} />
                  <span className="truncate">
                    {selectedMutationCommodityObj ? selectedMutationCommodityObj.name : 'Semua Komoditas'}
                  </span>
                </div>
                <ChevronDown className={`w-3 h-3 shrink-0 ${mutationCommodity !== 'all' ? 'text-slate-300' : 'text-slate-400'}`} />
              </button>

              {/* Smart Default Period Selector (Bulan Ini active by default) */}
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
                    onClick={() => setMutationPeriod(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      mutationPeriod === p.id
                        ? 'bg-[#071A24] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Mutation Filter Pill */}
          {mutationCommodity !== 'all' && selectedMutationCommodityObj && (
            <div className="flex items-center gap-2 px-1">
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200/80 shadow-2xs px-3 py-1 rounded-xl">
                <span>Filter Mutasi: <strong className="text-slate-900">{selectedMutationCommodityObj.name}</strong></span>
                <button
                  type="button"
                  onClick={() => setMutationCommodity('all')}
                  className="p-0.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Hapus filter komoditas"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {mutations === undefined ? (
            <div className="space-y-3">
              <SkeletonCard height="h-20" />
              <SkeletonCard height="h-20" />
            </div>
          ) : filteredMutations.length === 0 ? (
            <EmptyState
              icon={History}
              title="Belum Ada Mutasi Pada Periode Ini"
              description={
                mutationPeriod !== 'all'
                  ? 'Tidak ada mutasi stok yang tercatat pada periode ini. Coba ubah filter ke "Semua".'
                  : 'Riwayat perubahan stok dari transaksi atau opname fisik akan otomatis tercatat di sini.'
              }
              actionLabel={mutationPeriod !== 'all' ? 'Tampilkan Semua Periode' : undefined}
              onAction={mutationPeriod !== 'all' ? () => setMutationPeriod('all') : undefined}
            />
          ) : (
            <div className="space-y-3">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] divide-y divide-slate-100 overflow-hidden">
                {paginatedMutations.map((m) => {
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
                            Perubahan:{' '}
                            <span className="tabular-nums font-bold text-[#071A24]">
                              {m.previous_stock} → {m.new_stock}
                            </span>{' '}
                            {m.unit || ''} •{' '}
                            <span className="tabular-nums text-slate-400">
                              {formatDate(m.date, 'short')}
                            </span>
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

              {/* Anti-Lag Reusable Pagination Load More Button */}
              <LoadMoreButton
                remainingCount={remainingMutations}
                onClick={loadMoreMutations}
              />
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
            {(livestock && livestock.length > 0 ? livestock : [
              { id: '1', tag_number: 'LMS-001', current_weight: 520, status: 'active', notes: 'Sapi Limousin Pejantan' },
              { id: '2', tag_number: 'LMS-002', current_weight: 485, status: 'active', notes: 'Sapi Limousin Indukan' },
              { id: '3', tag_number: 'LMS-003', current_weight: 540, status: 'active', notes: 'Sapi Limousin Pejantan' },
              { id: '4', tag_number: 'DG-001', current_weight: 45, status: 'active', notes: 'Domba Garut Super' },
              { id: '5', tag_number: 'DG-002', current_weight: 42, status: 'active', notes: 'Domba Garut Sehat' },
              { id: '6', tag_number: 'DG-003', current_weight: 38, status: 'active', notes: 'Domba Garut Bobot Siap' },
            ]).map((ternak) => {
              const tag = ternak.tag_number || ternak.tag || 'TAG';
              const jenis = tag.startsWith('LMS') ? 'Sapi Limousin' : tag.startsWith('DG') ? 'Domba Garut' : 'Hewan Ternak';
              const statusLabel = ternak.status === 'active' || ternak.status === 'Sehat' ? 'Sehat' : ternak.status;

              return (
                <div
                  key={ternak.id || tag}
                  className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[#071A24] text-sm flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-[#00D29E]" />
                        <span>Tag: {tag}</span>
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#00D29E] border border-emerald-200">
                        {statusLabel}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/80 rounded-2xl space-y-1.5 text-xs border border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Jenis:</span>
                        <strong className="text-[#071A24] font-bold">{jenis}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Bobot Terkini:</span>
                        <strong className="text-[#00D29E] font-black tabular-nums">
                          {ternak.current_weight || ternak.bobot || 0} kg
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Catatan / Silsilah:</span>
                        <span className="font-semibold text-slate-700 truncate max-w-[150px]">
                          {ternak.notes || 'Pejantan/Indukan Sehat'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setWeighingLivestock(ternak);
                      setNewWeight(String(ternak.current_weight || ''));
                      setWeightNotes('');
                    }}
                    className="w-full py-2 rounded-xl bg-slate-100 hover:bg-[#071A24] hover:text-white text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5 text-[#00D29E]" />
                    <span>Timbang Bobot Berkala</span>
                  </button>
                </div>
              );
            })}
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

      {/* =========================================================================
          LIVESTOCK WEIGHING MODAL / BOTTOM SHEET
         ========================================================================= */}
      <BottomSheet
        isOpen={!!weighingLivestock}
        onClose={() => setWeighingLivestock(null)}
        title={
          <div className="flex items-center gap-2.5 text-[#071A24]">
            <div className="w-7 h-7 rounded-xl bg-[#00D29E]/20 text-[#00D29E] flex items-center justify-center">
              <Scale className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-base">
              Timbang Bobot: Tag {weighingLivestock?.tag_number}
            </span>
          </div>
        }
        size="md"
      >
        {weighingLivestock && (
          <form onSubmit={handleSaveWeight} className="space-y-4">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
              <span>Bobot tercatat sebelumnya:</span>
              <strong className="text-[#071A24] font-black text-sm tabular-nums">
                {weighingLivestock.current_weight || 0} kg
              </strong>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#071A24] mb-1.5">
                Bobot Baru Hasil Timbangan (kg)
              </label>
              <input
                type="number"
                step="any"
                min="1"
                inputMode="decimal"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="Contoh: 535"
                className="input-field tabular-nums rounded-2xl border-slate-200/80 text-sm font-bold"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#071A24] mb-1.5">
                Catatan Timbangan (Kondisi Kesehatan / Pakan)
              </label>
              <input
                type="text"
                value={weightNotes}
                onChange={(e) => setWeightNotes(e.target.value)}
                placeholder="Contoh: Pertumbuhan sehat, pakan konsentrat lancar"
                className="input-field rounded-2xl border-slate-200/80"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWeighingLivestock(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isWeighingSubmitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-[#071A24] hover:bg-[#0B2533] text-white font-bold text-xs shadow-xs transition ios-spring-tap cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4 text-[#00D29E] stroke-[3]" />
                <span>{isWeighingSubmitting ? 'Menyimpan...' : 'Simpan Bobot Baru'}</span>
              </button>
            </div>
          </form>
        )}
      </BottomSheet>

      {/* =========================================================================
          BOTTOM SHEET: PILIH KOMODITAS STOK (WITH SEARCH BAR)
         ========================================================================= */}
      <BottomSheet
        isOpen={isCommoditySheetOpen}
        onClose={() => setIsCommoditySheetOpen(false)}
        title={commoditySheetTarget === 'mutations' ? 'Filter Komoditas Mutasi' : 'Pilih Komoditas'}
        size="md"
      >
        <div className="space-y-3 pb-2">
          {/* Search bar inside bottom sheet */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={commoditySheetSearch}
              onChange={(e) => setCommoditySheetSearch(e.target.value)}
              placeholder="Cari komoditas..."
              autoFocus
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00D29E] focus:border-[#00D29E] transition font-medium text-slate-800"
            />
            {commoditySheetSearch && (
              <button
                type="button"
                onClick={() => setCommoditySheetSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* List of Commodities */}
          <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-0.5">
            {/* Option: Semua Komoditas */}
            <button
              type="button"
              onClick={() => {
                if (commoditySheetTarget === 'mutations') {
                  setMutationCommodity('all');
                } else {
                  setSelectedCommodity('all');
                }
                setIsCommoditySheetOpen(false);
              }}
              className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition cursor-pointer ${
                (commoditySheetTarget === 'mutations' ? mutationCommodity === 'all' : selectedCommodity === 'all')
                  ? 'bg-[#071A24] text-white shadow-xs'
                  : 'bg-slate-50/80 hover:bg-slate-100 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  (commoditySheetTarget === 'mutations' ? mutationCommodity === 'all' : selectedCommodity === 'all')
                    ? 'bg-white/10 text-[#00D29E]'
                    : 'bg-white border border-slate-200/60 text-slate-500'
                }`}>
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold">Semua Komoditas</div>
                  <div className={`text-[11px] ${
                    (commoditySheetTarget === 'mutations' ? mutationCommodity === 'all' : selectedCommodity === 'all')
                      ? 'text-slate-300'
                      : 'text-slate-400'
                  }`}>
                    {commoditySheetTarget === 'mutations' ? 'Tampilkan seluruh log mutasi' : `Total ${items?.length || 0} barang inventaris`}
                  </div>
                </div>
              </div>
              {(commoditySheetTarget === 'mutations' ? mutationCommodity === 'all' : selectedCommodity === 'all') && (
                <Check className="w-4 h-4 text-[#00D29E] stroke-[3]" />
              )}
            </button>

            {/* Individual Commodities */}
            {filteredSheetCommodities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                Tidak ada komoditas yang cocok dengan pencarian "{commoditySheetSearch}".
              </div>
            ) : (
              filteredSheetCommodities.map((c) => {
                const isSelected = commoditySheetTarget === 'mutations'
                  ? String(mutationCommodity) === String(c.id)
                  : String(selectedCommodity) === String(c.id);
                const Icon = getCommodityIcon(c.name);
                const count = commodityItemCounts[String(c.id)] || 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (commoditySheetTarget === 'mutations') {
                        setMutationCommodity(c.id);
                      } else {
                        setSelectedCommodity(c.id);
                      }
                      setIsCommoditySheetOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#071A24] text-white shadow-xs'
                        : 'bg-slate-50/80 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-white/10 text-[#00D29E]' : 'bg-white border border-slate-200/60 text-slate-500'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold">{c.name}</div>
                        <div className={`text-[11px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                          {count} varian barang
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#00D29E] stroke-[3]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </BottomSheet>

      {/* =========================================================================
          TAMBAH / UBAH BARANG MODAL (BOTTOM SHEET)
         ========================================================================= */}
      <StockItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
        commodities={uniqueCommodities}
        conversions={conversions}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
    </div>
  );
}
