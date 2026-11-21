import { useState, useRef, useMemo } from 'react';
import { useCapitalRotations } from '../../hooks/useCapitalRotations.js';
import { formatCurrency, formatDate } from '../../lib/formatters.js';
import { uploadReceiptImage } from '../../lib/storage.js';
import { usePagination } from '../../hooks/usePagination.js';
import { LoadMoreButton } from '../ui/LoadMoreButton.jsx';
import { BottomSheet } from '../ui/BottomSheet.jsx';
import { EmptyState } from '../ui/EmptyState.jsx';
import {
  Plus,
  Search,
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  Trash2,
  CheckCircle2,
  Clock,
  Ban,
  Percent,
  TrendingUp,
  Layers,
  Sparkles,
  ExternalLink,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Eye,
  FileText
} from 'lucide-react';

const COMMON_COMMODITIES = [
  'Susu MBG',
  'Telur',
  'Minyak Sunco',
  'Minyak Kita',
  'Sapi',
  'Domba',
  'Ikan Nila',
];

export default function CapitalRotationsView() {
  const {
    rotations,
    metrics,
    addRotation,
    updateRotation,
    markAsDone,
    markAsCancel,
    deleteRotation,
    calculate8PercentMargin,
  } = useCapitalRotations();

  // 1. Filter & Search State
  const [filterStatus, setFilterStatus] = useState('all'); // all | waiting | done | cancel
  const [search, setSearch] = useState('');

  // 2. Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [cairModalItem, setCairModalItem] = useState(null);
  const [cairDate, setCairDate] = useState(new Date().toISOString().slice(0, 10));
  const [previewProofUrl, setPreviewProofUrl] = useState(null);
  const [cancelModalItem, setCancelModalItem] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  // 3. Form State
  const [projectName, setProjectName] = useState('');
  const [commodity, setCommodity] = useState('Susu MBG');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [capitalAmount, setCapitalAmount] = useState('');
  const [profitAmount, setProfitAmount] = useState('');
  const [roiPercentage, setRoiPercentage] = useState(8.0);
  const [status, setStatus] = useState('waiting');
  const [notes, setNotes] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Filtered Rotations
  const filteredRotations = useMemo(() => {
    let result = Array.isArray(rotations) ? [...rotations] : [];

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter((r) => r.status === filterStatus);
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.project_name && r.project_name.toLowerCase().includes(q)) ||
          (r.commodity && r.commodity.toLowerCase().includes(q)) ||
          (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    // Sort newest start_date first for user convenience
    result.sort((a, b) => new Date(b.start_date || b.created_at) - new Date(a.start_date || a.created_at));

    return result;
  }, [rotations, filterStatus, search]);

  // Anti-Lag Pagination: 20 per view
  const {
    displayedItems: paginatedRotations,
    remainingCount,
    loadMore,
  } = usePagination(filteredRotations, {
    initialLimit: 20,
    step: 20,
    resetDependencies: [filterStatus, search],
  });

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setProjectName('');
    setCommodity('Susu MBG');
    setStartDate(new Date().toISOString().slice(0, 10));
    setCapitalAmount('');
    setProfitAmount('');
    setRoiPercentage(8.0);
    setStatus('waiting');
    setNotes('');
    setProofFile(null);
    setProofPreview('');
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setProjectName(item.project_name || '');
    setCommodity(item.commodity || 'Susu MBG');
    setStartDate(item.start_date ? item.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setCapitalAmount(String(item.capital_amount || ''));
    setProfitAmount(String(item.profit_amount || ''));
    setRoiPercentage(Number(item.roi_percentage) || 8.0);
    setStatus(item.status || 'waiting');
    setNotes(item.notes || '');
    setProofFile(null);
    setProofPreview(item.proof_url || '');
    setShowAddModal(true);
  };

  // Quick 8% Margin Auto-Calculate
  const handleApply8Percent = () => {
    const cap = Number(capitalAmount) || 0;
    const { profit, roi } = calculate8PercentMargin(cap);
    setProfitAmount(String(profit));
    setRoiPercentage(roi);
  };

  // Handle Capital Change -> recalculate ROI if profit exists
  const handleCapitalChange = (val) => {
    setCapitalAmount(val);
    const capNum = Number(val) || 0;
    const profNum = Number(profitAmount) || 0;
    if (capNum > 0 && profNum > 0) {
      setRoiPercentage(Number(((profNum / capNum) * 100).toFixed(2)));
    }
  };

  // Handle Profit Change -> recalculate ROI
  const handleProfitChange = (val) => {
    setProfitAmount(val);
    const capNum = Number(capitalAmount) || 0;
    const profNum = Number(val) || 0;
    if (capNum > 0) {
      setRoiPercentage(Number(((profNum / capNum) * 100).toFixed(2)));
    }
  };

  // Handle File Input
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofFile(file);
      setProofPreview(URL.createObjectURL(file));
    }
  };

  // Submit Rotation Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    const capNum = Number(capitalAmount) || 0;
    if (capNum <= 0) {
      alert('Mohon masukkan nominal modal yang valid (> 0)');
      return;
    }

    setIsUploading(true);
    let finalProofUrl = proofPreview;

    try {
      if (proofFile) {
        const uploadRes = await uploadReceiptImage(proofFile, 'rotasi');
        finalProofUrl = uploadRes.url;
      }

      const profNum = Number(profitAmount) || 0;
      const calcRoi = capNum > 0 ? Number(((profNum / capNum) * 100).toFixed(2)) : 0;

      const payload = {
        project_name: projectName.trim() || `Pengadaan ${commodity}`,
        commodity,
        capital_amount: capNum,
        profit_amount: profNum,
        roi_percentage: calcRoi,
        status,
        start_date: startDate,
        proof_url: finalProofUrl,
        notes: notes.trim(),
      };

      if (editingItem) {
        await updateRotation(editingItem.id, payload);
      } else {
        await addRotation(payload);
      }

      setShowAddModal(false);
    } catch (err) {
      console.error('Error saving rotation project:', err);
      alert('Terjadi kesalahan saat menyimpan data proyek.');
    } finally {
      setIsUploading(false);
    }
  };

  // Confirm Mark As Done
  const handleConfirmDone = async () => {
    if (!cairModalItem) return;
    try {
      await markAsDone(cairModalItem.id, cairDate);
      setCairModalItem(null);
    } catch (err) {
      console.error('Error marking as done:', err);
    }
  };

  // Confirm Cancel
  const handleConfirmCancel = async () => {
    if (!cancelModalItem) return;
    try {
      await markAsCancel(cancelModalItem.id, cancelReason);
      setCancelModalItem(null);
      setCancelReason('');
    } catch (err) {
      console.error('Error cancelling rotation:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* =========================================================================
          1. 4 KPI SUMMARY CARDS (Apple HIG / FlowMint Style)
         ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Card 1: Modal Berjalan (Waiting) */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-4 rounded-3xl border border-amber-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">
              Modal di Lapangan
            </span>
            <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-2xs">
              <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-950 tabular-nums tracking-tight">
            {formatCurrency(metrics.totalWaitingModal)}
          </div>
          <div className="text-[11px] font-semibold text-amber-700/90 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>{metrics.waitingCount} proyek berstatus Waiting</span>
          </div>
        </div>

        {/* Card 2: Total Modal Cair (Done) */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Modal Selesai (Done)
            </span>
            <div className="w-7 h-7 rounded-xl bg-slate-100 text-[#071A24] flex items-center justify-center">
              <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#071A24] tabular-nums tracking-tight">
            {formatCurrency(metrics.totalDoneCapital)}
          </div>
          <div className="text-[11px] font-medium text-slate-400 mt-1">
            {metrics.doneCount} proyek berhasil cair
          </div>
        </div>

        {/* Card 3: Total Realisasi Profit (Done) */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white p-4 rounded-3xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
              Realisasi Profit
            </span>
            <div className="w-7 h-7 rounded-xl bg-[#00D29E] text-[#071A24] flex items-center justify-center shadow-2xs">
              <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 tabular-nums tracking-tight">
            +{formatCurrency(metrics.totalDoneProfit)}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            Laba Bruto masuk kas
          </div>
        </div>

        {/* Card 4: Rata-rata ROI (%) */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Rata-rata ROI
            </span>
            <div className="w-7 h-7 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <Percent className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#071A24] tabular-nums tracking-tight">
            {metrics.averageRoi.toFixed(1)}%
          </div>
          <div className="text-[11px] font-medium text-slate-400 mt-1">
            Return on Investment
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. ACTION & FILTER CONTROLS BAR
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-2xl overflow-x-auto max-w-full">
            {[
              { id: 'all', label: 'Semua Proyek' },
              { id: 'waiting', label: `Waiting (${metrics.waitingCount})` },
              { id: 'done', label: `Done (${metrics.doneCount})` },
              { id: 'cancel', label: `Cancel (${metrics.cancelCount})` },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setFilterStatus(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  filterStatus === st.id
                    ? 'bg-[#071A24] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* New Project CTA Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 bg-[#071A24] hover:bg-[#0B2533] active:scale-95 text-white px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm shadow-sm transition ios-spring-tap cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-[#00D29E] stroke-[3]" />
            <span>+ Catat Proyek Rotasi</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama proyek, komoditas (Susu MBG, Sunco, Telur, dll.)..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50/80 rounded-2xl text-xs sm:text-sm border border-slate-200/80 focus:bg-white focus:outline-hidden focus:border-[#00D29E] focus:ring-1 focus:ring-[#00D29E] transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          3. ROTATION BATCH LIST & RUNNING TOTALS (s.d.)
         ========================================================================= */}
      {paginatedRotations.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Belum Ada Data Proyek Rotasi"
          description={
            search
              ? 'Tidak ditemukan proyek rotasi yang sesuai dengan kata kunci pencarian.'
              : 'Mulai catat proyek pengadaan komoditas (Susu MBG, Minyak Sunco, Telur) untuk melacak rotasi modal dan margin 8%.'
          }
          actionLabel="+ Catat Proyek Pertama"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="space-y-3">
          {paginatedRotations.map((item) => {
            const isWaiting = item.status === 'waiting';
            const isDone = item.status === 'done';
            const isCancel = item.status === 'cancel';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl p-4 sm:p-5 border transition-all ${
                  isWaiting
                    ? 'border-amber-300/80 shadow-xs hover:border-amber-400'
                    : isDone
                    ? 'border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:border-emerald-200'
                    : 'border-slate-200/60 opacity-60 bg-slate-50/60'
                }`}
              >
                {/* Header row: Project Title, Badge, and Action dropdown/buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isWaiting
                          ? 'bg-amber-100 text-amber-700'
                          : isDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isWaiting ? (
                        <Clock className="w-5 h-5 stroke-[2.5]" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                      ) : (
                        <Ban className="w-5 h-5 stroke-[2.5]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-sm sm:text-base text-[#071A24] truncate">
                          {item.project_name}
                        </h3>
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            isWaiting
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : isDone
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {isWaiting && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                          {isWaiting ? 'Waiting (Berjalan)' : isDone ? 'Done (Cair)' : 'Cancel (Batal)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5 flex-wrap">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.commodity}
                        </span>
                        <span>Mulai: {formatDate(item.start_date, 'medium')}</span>
                        {isDone && item.completion_date && (
                          <span className="text-emerald-700 font-semibold">
                            Cair: {formatDate(item.completion_date, 'medium')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* View Proof Button */}
                    {item.proof_url && (
                      <button
                        type="button"
                        onClick={() => setPreviewProofUrl(item.proof_url)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Lihat Bukti Transfer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#00D29E]" />
                        <span>Bukti</span>
                      </button>
                    )}

                    {/* Mark As Done CTA (for waiting) */}
                    {isWaiting && (
                      <button
                        type="button"
                        onClick={() => {
                          setCairModalItem(item);
                          setCairDate(new Date().toISOString().slice(0, 10));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Tandai Cair</span>
                      </button>
                    )}

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition cursor-pointer"
                    >
                      Ubah
                    </button>

                    {/* Cancel (for waiting) */}
                    {isWaiting && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelModalItem(item);
                          setCancelReason('');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold transition cursor-pointer"
                        title="Batalkan Proyek"
                      >
                        Batal
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Hapus catatan proyek "${item.project_name}"?`)) {
                          deleteRotation(item.id);
                        }
                      }}
                      className="p-1.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="Hapus Data"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Metrics Grid: Single Batch Metrics vs Cumulative s.d. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                  {/* Modal Keluar */}
                  <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Modal Keluar
                    </div>
                    <div className="text-sm sm:text-base font-black text-[#071A24] tabular-nums mt-0.5">
                      {formatCurrency(item.capital_amount)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      Modal s.d.: <strong className="text-slate-700">{formatCurrency(item.modal_sd)}</strong>
                    </div>
                  </div>

                  {/* Profit Realisasi / Estimasi */}
                  <div className="bg-emerald-50/50 p-2.5 rounded-2xl border border-emerald-100/60">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      {isDone ? 'Profit Cair' : 'Estimasi Profit'}
                    </div>
                    <div className="text-sm sm:text-base font-black text-emerald-700 tabular-nums mt-0.5">
                      +{formatCurrency(item.profit_amount)}
                    </div>
                    <div className="text-[10px] text-emerald-800 font-medium">
                      Profit s.d.: <strong>{formatCurrency(item.profit_sd)}</strong>
                    </div>
                  </div>

                  {/* ROI (%) */}
                  <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      ROI Proyek
                    </div>
                    <div className="text-sm sm:text-base font-black text-[#071A24] tabular-nums mt-0.5">
                      {item.roi_percentage ? `${item.roi_percentage.toFixed(1)}%` : '0%'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      ROI s.d.: <strong className="text-[#071A24]">{item.roi_sd ? `${item.roi_sd.toFixed(1)}%` : '0%'}</strong>
                    </div>
                  </div>

                  {/* Notes / Bruto Netto */}
                  <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Catatan / Timbangan
                    </div>
                    <div className="text-xs text-slate-700 line-clamp-2 mt-0.5 font-medium">
                      {item.notes || 'Tidak ada catatan timbangan/spesifik.'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Anti-Lag Load More */}
          <LoadMoreButton
            displayedCount={paginatedRotations.length}
            totalCount={filteredRotations.length}
            remainingCount={remainingCount}
            onLoadMore={loadMore}
          />
        </div>
      )}

      {/* =========================================================================
          MODAL 1: FORM CATAT / EDIT PROYEK ROTASI (BottomSheet Apple HIG)
         ========================================================================= */}
      <BottomSheet
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingItem ? 'Ubah Data Proyek Rotasi' : 'Catat Proyek Rotasi Modal Baru'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Commodity Quick Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Komoditas Utama
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {COMMON_COMMODITIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCommodity(c);
                    if (!projectName || projectName.startsWith('Pengadaan ')) {
                      setProjectName(`Pengadaan ${c}`);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    commodity === c
                      ? 'bg-[#071A24] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Proyek / Batch Pengadaan
            </label>
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Contoh: Pengadaan Susu MBG Tahap 3"
              className="w-full px-3.5 py-2.5 bg-slate-50 rounded-2xl text-xs sm:text-sm border border-slate-200 focus:bg-white focus:outline-hidden focus:border-[#00D29E]"
            />
          </div>

          {/* Date & Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tanggal Pengadaan / Mulai
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 rounded-2xl text-xs sm:text-sm border border-slate-200 focus:bg-white focus:outline-hidden focus:border-[#00D29E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status Siklus Uang
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 rounded-2xl text-xs sm:text-sm border border-slate-200 focus:bg-white focus:outline-hidden focus:border-[#00D29E]"
              >
                <option value="waiting">Waiting (Sedang Berjalan di Lapangan)</option>
                <option value="done">Done (Sudah Cair / Selesai)</option>
                <option value="cancel">Cancel (Dibatalkan)</option>
              </select>
            </div>
          </div>

          {/* Capital Out (Modal Keluar) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Modal Keluar (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                required
                min="1"
                value={capitalAmount}
                onChange={(e) => handleCapitalChange(e.target.value)}
                placeholder="50000000"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-2xl text-xs sm:text-sm font-bold text-[#071A24] border border-slate-200 focus:bg-white focus:outline-hidden focus:border-[#00D29E]"
              />
            </div>
          </div>

          {/* Auto-Calculate 8% Margin Option */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[#00D29E]/10 to-transparent border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                <Sparkles className="w-3.5 h-3.5 text-[#00D29E]" />
                <span>Opsi Cepat: Margin Tetap 8%</span>
              </div>
              <p className="text-[11px] text-emerald-800/80 font-medium">
                Khusus komoditas Susu MBG, Telur, Ikan Nila dengan persentase margin pasti.
              </p>
            </div>
            <button
              type="button"
              onClick={handleApply8Percent}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
            >
              Hitung Otomatis 8%
            </button>
          </div>

          {/* Profit Amount & ROI Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estimasi / Realisasi Profit (Rp)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  value={profitAmount}
                  onChange={(e) => handleProfitChange(e.target.value)}
                  placeholder="4000000"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-2xl text-xs sm:text-sm font-bold text-emerald-700 border border-slate-200 focus:bg-white focus:outline-hidden focus:border-[#00D29E]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ROI Otomatis (Profit / Modal × 100%)
              </label>
              <div className="px-3.5 py-2.5 bg-slate-100 rounded-2xl text-xs sm:text-sm font-black text-[#071A24] border border-slate-200 flex items-center justify-between">
                <span>{roiPercentage ? `${roiPercentage.toFixed(1)}%` : '0%'}</span>
                <Percent className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Transfer Proof Photo Upload */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Upload Bukti Transfer / Nota (Opsional)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {proofPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-48 flex items-center justify-center group">
                <img
                  src={proofPreview}
                  alt="Bukti Transfer"
                  className="w-full h-40 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setProofFile(null);
                    setProofPreview('');
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/60 text-white hover:bg-rose-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#00D29E] bg-slate-50/60 hover:bg-slate-50 text-slate-500 flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer"
              >
                <Camera className="w-4 h-4 text-[#00D29E]" />
                <span>Foto Nota / Ambil Gambar Transfer</span>
              </button>
            )}
          </div>

          {/* Notes (Bruto/Netto timbangan) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Catatan Proyek (Opsional Bruto / Netto Timbangan)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Bruto timbangan 3.500L, Netto 3.480L. Penyusutan normal 0.5%."
              className="w-full px-3.5 py-2 bg-slate-50 rounded-2xl text-xs sm:text-sm border border-slate-200 focus:bg-white focus:outline-hidden focus:border-[#00D29E]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 py-3 rounded-2xl bg-[#071A24] hover:bg-[#0B2533] text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isUploading ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Catat Proyek'}
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* =========================================================================
          MODAL 2: TANDAI CAIR (DONE) DIALOG
         ========================================================================= */}
      {cairModalItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#071A24] text-base">Konfirmasi Pencairan</h3>
                <p className="text-xs text-slate-500 font-medium">Proyek: {cairModalItem.project_name}</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Modal Kembali:</span>
                <strong className="text-slate-800">{formatCurrency(cairModalItem.capital_amount)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Profit Masuk:</span>
                <strong className="text-emerald-700">+{formatCurrency(cairModalItem.profit_amount)}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Cair</label>
              <input
                type="date"
                required
                value={cairDate}
                onChange={(e) => setCairDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 rounded-2xl text-xs sm:text-sm border border-slate-200 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCairModalItem(null)}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmDone}
                className="flex-1 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
              >
                Konfirmasi Cair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: BATALKAN PROYEK (CANCEL) DIALOG
         ========================================================================= */}
      {cancelModalItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#071A24] text-base">Batalkan Proyek</h3>
                <p className="text-xs text-slate-500 font-medium">{cancelModalItem.project_name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Proyek yang dibatalkan tidak akan dihitung ke akumulasi total modal berjalan maupun laba kotor.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Alasan Pembatalan</label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Supplier kehabisan stok / alokasi dialihkan"
                className="w-full px-3.5 py-2 bg-slate-50 rounded-2xl text-xs border border-slate-200"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCancelModalItem(null)}
                className="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: BUKTI TRANSFER IMAGE PREVIEW
         ========================================================================= */}
      {previewProofUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewProofUrl(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl overflow-hidden p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-100">
              <span className="font-bold text-xs text-slate-800">Bukti Transfer / Dokumen Batch</span>
              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-900 rounded-2xl">
              <img
                src={previewProofUrl}
                alt="Bukti Transfer"
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
