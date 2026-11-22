import { useState, useEffect } from 'react';
import { translateErrorMessage } from '../../lib/errorHandler.js';
import {
  Plus,
  Edit3,
  Trash2,
  Check,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import BottomSheet from '../ui/BottomSheet.jsx';
import { formatCurrency } from '../../lib/formatters.js';

const COMMON_UNITS = ['kerdus', 'paket', 'kg', 'pcs', 'sak', 'botol', 'karung', 'dus', 'liter', 'ekor', 'ikat', 'butir'];

export default function StockItemModal({
  isOpen,
  onClose,
  item = null,
  commodities = [],
  conversions = [],
  onSave,
  onDelete,
}) {
  const isEdit = !!item;

  // Form State
  const [name, setName] = useState('');
  const [commodityId, setCommodityId] = useState('');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [baseUnit, setBaseUnit] = useState('kerdus');
  const [stock, setStock] = useState('0');
  const [hpp, setHpp] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [isPerishable, setIsPerishable] = useState(false);
  const [isLivestock, setIsLivestock] = useState(false);

  // Alternate Unit Conversion State
  const [enableAltUnit, setEnableAltUnit] = useState(false);
  const [altUnitName, setAltUnitName] = useState('');
  const [altFactor, setAltFactor] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Populate form on open or item change
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
      setErrorMessage('');
      return;
    }

    if (item) {
      setName(item.name || '');
      setCommodityId(item.commodity_id ? String(item.commodity_id) : '');
      setIsNewCategory(false);
      setNewCategoryName('');
      setBaseUnit(item.base_unit || 'kg');
      setStock(String(item.stock ?? 0));
      setHpp(String(item.hpp ?? 0));
      setSellingPrice(String(item.selling_price ?? 0));
      setMinStock(String(item.min_stock ?? 5));
      setIsPerishable(Boolean(item.is_perishable));
      setIsLivestock(Boolean(item.is_livestock));

      // Find existing conversion
      const itemConv = (conversions || []).find((c) => String(c.item_id) === String(item.id));
      if (itemConv) {
        setEnableAltUnit(true);
        setAltUnitName(itemConv.unit_name || '');
        setAltFactor(String(itemConv.factor || ''));
      } else {
        setEnableAltUnit(false);
        setAltUnitName('');
        setAltFactor('');
      }
    } else {
      // Reset for Add
      setName('');
      setCommodityId(commodities && commodities.length > 0 ? String(commodities[0].id) : '');
      setIsNewCategory(false);
      setNewCategoryName('');
      setBaseUnit('kerdus');
      setStock('0');
      setHpp('0');
      setSellingPrice('0');
      setMinStock('5');
      setIsPerishable(false);
      setIsLivestock(false);
      setEnableAltUnit(false);
      setAltUnitName('');
      setAltFactor('');
    }
    setErrorMessage('');
    setShowDeleteConfirm(false);
  }, [isOpen, item, commodities, conversions]);

  // Real-time calculations
  const numStock = Number(stock) || 0;
  const numHpp = Number(hpp) || 0;
  const numSell = Number(sellingPrice) || 0;
  const numMin = Number(minStock) || 0;

  const marginPerUnit = numSell - numHpp;
  const marginPercent = numHpp > 0 ? ((marginPerUnit / numHpp) * 100).toFixed(1) : (numSell > 0 ? '100.0' : '0.0');
  const totalValuation = Math.round(numStock * numHpp);
  const totalPotentialRevenue = Math.round(numStock * numSell);

  // Stock difference in edit mode
  const originalStock = item ? Number(item.stock) || 0 : 0;
  const stockDiff = numStock - originalStock;

  // Handle Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Nama barang tidak boleh kosong.');
      return;
    }

    if (isNewCategory && !newCategoryName.trim()) {
      setErrorMessage('Silakan isi nama kategori baru.');
      return;
    }

    if (!baseUnit.trim()) {
      setErrorMessage('Satuan dasar harus diisi (contoh: kg, liter, pcs).');
      return;
    }

    if (numStock < 0) {
      setErrorMessage('Jumlah stok tidak boleh minus.');
      return;
    }

    if (numHpp < 0 || numSell < 0) {
      setErrorMessage('Harga tidak boleh minus.');
      return;
    }

    // Prepare conversion array
    const conversionsList = [];
    if (enableAltUnit && altUnitName.trim() && Number(altFactor) > 0) {
      conversionsList.push({
        unit_name: altUnitName.trim(),
        factor: Number(altFactor),
      });
    }

    setIsSubmitting(true);
    try {
      await onSave({
        id: item?.id,
        name: name.trim(),
        commodity_id: isNewCategory ? null : (commodityId || null),
        newCommodityName: isNewCategory ? newCategoryName.trim() : null,
        base_unit: baseUnit.trim().toLowerCase(),
        stock: numStock,
        hpp: numHpp,
        selling_price: numSell,
        min_stock: numMin,
        is_perishable: isPerishable,
        is_livestock: isLivestock,
        conversions: conversionsList,
      });
      onClose();
    } catch (err) {
      setErrorMessage(translateErrorMessage(err, 'Gagal menyimpan data barang.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!item || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(item.id);
      onClose();
    } catch (err) {
      setErrorMessage(translateErrorMessage(err, 'Gagal menghapus data barang.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5 text-[#071A24]">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#00D29E] flex items-center justify-center border border-emerald-100 shadow-2xs">
            {isEdit ? <Edit3 className="w-4 h-4 stroke-[2.5]" /> : <Plus className="w-4 h-4 stroke-[2.5]" />}
          </div>
          <div>
            <div className="font-extrabold text-base leading-tight">
              {isEdit ? `Ubah Data Barang: ${item.name}` : 'Tambah Barang / Komoditas Baru'}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {isEdit
                ? 'Perbarui stok, harga modal, harga jual, dan spesifikasi komoditas'
                : 'Daftarkan stok barang dagang baru yang fleksibel'}
            </div>
          </div>
        </div>
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. NAMA BARANG */}
        <div>
          <label className="block text-xs font-bold text-[#071A24] mb-1">
            Nama Barang / Komoditas <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Beras Rojo Lele 5kg, Minyak Bimoli, Pakan Ayam..."
            className="input-field rounded-2xl border-slate-200/80 text-sm font-semibold text-slate-900"
            required
            autoFocus
          />
        </div>

        {/* 2. KATEGORI / KOMODITAS */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-[#071A24]">
            Kategori Komoditas
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={isNewCategory ? '__new__' : commodityId}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setIsNewCategory(true);
                } else {
                  setIsNewCategory(false);
                  setCommodityId(e.target.value);
                }
              }}
              className="input-field rounded-2xl border-slate-200/80 text-xs font-bold text-slate-800 bg-white"
            >
              <option value="">-- Pilih Kategori --</option>
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__new__">+ Kategori Baru...</option>
            </select>

            {isNewCategory ? (
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ketik nama kategori baru..."
                className="input-field rounded-2xl border-slate-200/80 text-xs font-bold bg-emerald-50/40 text-slate-900"
                autoFocus
              />
            ) : (
              <div className="text-[11px] text-slate-500 flex items-center px-1">
                Pilih atau buat kategori fleksibel untuk barang yang sering berganti.
              </div>
            )}
          </div>
        </div>

        {/* 3. SATUAN DASAR & CHIPS */}
        <div>
          <label className="block text-xs font-bold text-[#071A24] mb-1">
            Satuan Dasar (Base Unit) <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value)}
            placeholder="Contoh: kg, liter, ekor, pcs, karung..."
            className="input-field rounded-2xl border-slate-200/80 text-xs sm:text-sm font-bold text-slate-800"
            required
          />
          {/* Quick Unit Pills (Clean Flex Wrap - Anti Clipping) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 pb-0.5">
            <span className="text-[10px] text-slate-400 font-semibold shrink-0">Pilihan cepat:</span>
            {COMMON_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setBaseUnit(u)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition shrink-0 cursor-pointer ${baseUnit.toLowerCase() === u
                    ? 'bg-[#071A24] text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* 4. JUMLAH STOK & BATAS MINIMUM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#071A24]">
                {isEdit ? 'Jumlah Stok Terkini' : 'Jumlah Stok Awal'}
              </label>
              {isEdit && stockDiff !== 0 && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${stockDiff > 0 ? 'bg-emerald-100 text-[#00D29E]' : 'bg-rose-100 text-rose-600'
                    }`}
                >
                  {stockDiff > 0 ? `+${stockDiff}` : stockDiff} {baseUnit}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                className="input-field tabular-nums rounded-xl border-slate-200/80 pr-14 text-sm font-black text-slate-900 bg-white"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                {baseUnit || 'UNIT'}
              </span>
            </div>
            {isEdit && (
              <div className="text-[10px] text-slate-500 mt-1">
                Stok awal: <strong className="text-slate-700">{originalStock} {baseUnit}</strong>. Perubahan dicatat di mutasi.
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-[#071A24] mb-1">
              Batas Stok Minimum (Kritis)
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                placeholder="5"
                className="input-field tabular-nums rounded-xl border-slate-200/80 pr-14 text-sm font-black text-slate-900 bg-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                {baseUnit || 'UNIT'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Peringatan "Stok Menipis" muncul jika stok ≤ batas ini.
            </div>
          </div>
        </div>

        {/* 5. HARGA MODAL (HPP) & HARGA JUAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
          <div>
            <label className="block text-xs font-bold text-[#071A24] mb-1">
              Harga Modal / Beli (HPP)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="numeric"
                value={hpp}
                onChange={(e) => setHpp(e.target.value)}
                placeholder="0"
                className="input-field pl-9 tabular-nums rounded-xl border-slate-200/80 text-sm font-black text-slate-900 bg-white"
                required
              />
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">
              {formatCurrency(numHpp)} / {baseUnit || 'satuan'}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#071A24] mb-1">
              Harga Jual (ke Pelanggan)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                step="any"
                min="0"
                inputMode="numeric"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0"
                className="input-field pl-9 tabular-nums rounded-xl border-slate-200/80 text-sm font-black text-slate-900 bg-white"
                required
              />
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1 truncate">
              {formatCurrency(numSell)} / {baseUnit || 'satuan'}
            </div>
          </div>
        </div>

        {/* 6. REALTIME MARGIN & ESTIMASI VALUASI FINTECH CARD */}
        <div className="bg-gradient-to-br from-[#071A24] to-[#0B2533] text-white rounded-2xl p-3.5 space-y-2 border border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#00D29E]" />
              <span>Analisis Margin & Valuasi</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${marginPerUnit >= 0 ? 'bg-emerald-500/20 text-[#00D29E]' : 'bg-rose-500/20 text-rose-300'
                }`}
            >
              {marginPerUnit >= 0 ? `+${marginPercent}% Margin` : `${marginPercent}% Rugi`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10 text-center sm:text-left">
            <div>
              <div className="text-[10px] text-slate-400">Margin/Satuan</div>
              <div
                className={`text-xs sm:text-sm font-black tabular-nums ${marginPerUnit >= 0 ? 'text-[#00D29E]' : 'text-rose-400'
                  }`}
              >
                {formatCurrency(marginPerUnit)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Total Modal Stok</div>
              <div className="text-xs sm:text-sm font-bold text-slate-200 tabular-nums">
                {formatCurrency(totalValuation)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Potensi Omset</div>
              <div className="text-xs sm:text-sm font-black text-[#00D29E] tabular-nums">
                {formatCurrency(totalPotentialRevenue)}
              </div>
            </div>
          </div>
        </div>

        {/* 7. SATUAN ALTERNATIF / KONVERSI (OPSIONAL) */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-[#071A24]">Satuan Tambahan / Grosir (Opsional)</div>
              <div className="text-[11px] text-slate-500">
                Contoh: 1 Jeriken = 20 Liter, 1 Sak = 50 kg, 1 Dus = 24 pcs
              </div>
            </div>
            <label className="ios-switch shrink-0">
              <input
                type="checkbox"
                checked={enableAltUnit}
                onChange={(e) => setEnableAltUnit(e.target.checked)}
              />
              <span className="ios-slider" />
            </label>
          </div>

          {enableAltUnit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60 animate-in fade-in duration-150">
              <div>
                <label className="block text-[11px] font-bold text-[#071A24] mb-1">
                  Nama Satuan Tambahan
                </label>
                <input
                  type="text"
                  value={altUnitName}
                  onChange={(e) => setAltUnitName(e.target.value)}
                  placeholder="Contoh: Jeriken, Sak, Dus, Peti"
                  className="input-field rounded-xl border-slate-200 text-xs font-bold bg-white"
                  required={enableAltUnit}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#071A24] mb-1">
                  Isi per Satuan Tambahan (dalam {baseUnit || 'unit'})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={altFactor}
                  onChange={(e) => setAltFactor(e.target.value)}
                  placeholder="Contoh: 20"
                  className="input-field tabular-nums rounded-xl border-slate-200 text-xs font-bold bg-white"
                  required={enableAltUnit}
                />
              </div>
            </div>
          )}
        </div>

        {/* 8. TIPE PRODUK TOGGLES */}
        <div className="grid grid-cols-2 gap-2">
          <label className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 transition">
            <span className="text-xs font-bold text-[#071A24] select-none">
              Mudah Basi / Expired
            </span>
            <input
              type="checkbox"
              checked={isPerishable}
              onChange={(e) => setIsPerishable(e.target.checked)}
              className="w-4 h-4 rounded text-[#00D29E] focus:ring-[#00D29E] cursor-pointer"
            />
          </label>

          <label className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 transition">
            <span className="text-xs font-bold text-[#071A24] select-none">
              Hewan Ternak
            </span>
            <input
              type="checkbox"
              checked={isLivestock}
              onChange={(e) => setIsLivestock(e.target.checked)}
              className="w-4 h-4 rounded text-[#00D29E] focus:ring-[#00D29E] cursor-pointer"
            />
          </label>
        </div>

        {/* 9. DELETE CONFIRMATION SECTION (EDIT MODE ONLY) */}
        {isEdit && (
          <div className="pt-2">
            {showDeleteConfirm ? (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                <div className="text-xs font-extrabold text-rose-800">
                  Yakin ingin menghapus komoditas "{item.name}"?
                </div>
                <p className="text-[11px] text-rose-600">
                  Data komoditas ini akan dihapus dari katalog stok gudang.
                </p>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 rounded-xl bg-white text-slate-700 text-xs font-bold border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? 'Menghapus...' : 'Ya, Hapus Sekarang'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center px-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs font-bold text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-1.5 py-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Komoditas Ini</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 10. ACTION BUTTONS */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-[#00D29E] hover:bg-[#10B981] active:scale-95 text-[#071A24] font-extrabold text-xs shadow-xs transition ios-spring-tap cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah ke Stok'}</span>
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
