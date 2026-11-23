import { useCallback, useMemo } from 'react';
import { db } from '../lib/db.js';
import { useLiveQuery, notifyDatabaseChange } from './useLiveQuery.js';

/**
 * Custom Hook for CV Amanah Barokah Capital Rotation (Rotasi Modal Berbasis Proyek/Batch)
 * Handles:
 * - Real-time Live Query with Dexie
 * - Chronological Cumulative Calculations (Modal s.d., Profit s.d., ROI % s.d.)
 * - Automatic 8% Margin calculation for fixed commodities (Susu MBG, Telur, Ikan Nila, dll.)
 * - Lifecycle Statuses: 'waiting' (berjalan di lapangan), 'done' (cair), 'cancel' (batal)
 * - Anti-drift cumulative running totals
 */
export function useCapitalRotations() {
  const rawRotations = useLiveQuery(
    async () => {
      if (!db.capital_rotations) return [];
      return await db.capital_rotations.toArray();
    },
    [],
    []
  );

  // Compute precise chronological running totals (s.d.)
  const { rotationsWithCumulatives, metrics } = useMemo(() => {
    const list = Array.isArray(rawRotations) ? [...rawRotations] : [];

    // Sort chronologically ascending (oldest first) to compute cumulative running total
    const chronological = [...list].sort((a, b) => {
      const dateA = new Date(a.start_date || a.created_at || 0).getTime();
      const dateB = new Date(b.start_date || b.created_at || 0).getTime();
      return dateA - dateB;
    });

    let runningModal = 0;
    let runningProfit = 0;
    const cumulativeMap = new Map();

    chronological.forEach((item) => {
      if (item.status !== 'cancel') {
        runningModal += Number(item.capital_amount) || 0;
        runningProfit += Number(item.profit_amount) || 0;
      }
      const roiCumulative = runningModal > 0 ? (runningProfit / runningModal) * 100 : 0;

      cumulativeMap.set(item.id, {
        modal_sd: runningModal,
        profit_sd: runningProfit,
        roi_sd: roiCumulative,
      });
    });

    // Attach cumulative values to items
    const enriched = list.map((item) => {
      const cum = cumulativeMap.get(item.id) || { modal_sd: 0, profit_sd: 0, roi_sd: 0 };
      const capital = Number(item.capital_amount) || 0;
      const profit = Number(item.profit_amount) || 0;
      const singleRoi = capital > 0 ? (profit / capital) * 100 : 0;

      return {
        ...item,
        capital_amount: capital,
        profit_amount: profit,
        roi_percentage: Number(item.roi_percentage) || singleRoi,
        modal_sd: cum.modal_sd,
        profit_sd: cum.profit_sd,
        roi_sd: cum.roi_sd,
      };
    });

    // Calculate core business KPIs
    let totalWaitingModal = 0;
    let waitingCount = 0;
    let totalDoneCapital = 0;
    let totalDoneProfit = 0;
    let doneCount = 0;
    let cancelCount = 0;

    enriched.forEach((item) => {
      if (item.status === 'waiting') {
        totalWaitingModal += item.capital_amount;
        waitingCount++;
      } else if (item.status === 'done') {
        totalDoneCapital += item.capital_amount;
        totalDoneProfit += item.profit_amount;
        doneCount++;
      } else if (item.status === 'cancel') {
        cancelCount++;
      }
    });

    const averageRoi = totalDoneCapital > 0 ? (totalDoneProfit / totalDoneCapital) * 100 : 0;

    return {
      rotationsWithCumulatives: enriched,
      metrics: {
        totalWaitingModal,
        waitingCount,
        totalDoneCapital,
        totalDoneProfit,
        doneCount,
        cancelCount,
        averageRoi,
        totalProjects: enriched.length,
      },
    };
  }, [rawRotations]);

  // Create new rotation project
  const addRotation = useCallback(async (data) => {
    if (!db.capital_rotations) return null;

    const now = new Date();
    const capital = Math.round(Number(data.capital_amount) || 0);
    const profit = Math.round(Number(data.profit_amount) || 0);
    const roi = capital > 0 ? (profit / capital) * 100 : 0;

    const record = {
      project_name: data.project_name || 'Proyek Rotasi Baru',
      commodity: data.commodity || 'Komoditas Umum',
      capital_amount: capital,
      profit_amount: profit,
      roi_percentage: Number(data.roi_percentage) || roi,
      status: data.status || 'waiting', // 'waiting' | 'done' | 'cancel'
      start_date: data.start_date ? new Date(data.start_date).toISOString() : now.toISOString(),
      completion_date: data.status === 'done'
        ? (data.completion_date ? new Date(data.completion_date).toISOString() : now.toISOString())
        : null,
      proof_url: data.proof_url || '',
      notes: data.notes || '',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const id = await db.capital_rotations.add(record);
    notifyDatabaseChange();
    return id;
  }, []);

  // Update existing rotation project
  const updateRotation = useCallback(async (id, updates) => {
    if (!db.capital_rotations || !id) return;

    const patch = { ...updates, updated_at: new Date().toISOString() };
    if (patch.capital_amount !== undefined || patch.profit_amount !== undefined) {
      const existing = await db.capital_rotations.get(Number(id) || id);
      const cap = patch.capital_amount !== undefined ? Number(patch.capital_amount) : Number(existing?.capital_amount || 0);
      const prof = patch.profit_amount !== undefined ? Number(patch.profit_amount) : Number(existing?.profit_amount || 0);
      patch.capital_amount = Math.round(cap);
      patch.profit_amount = Math.round(prof);
      patch.roi_percentage = cap > 0 ? (prof / cap) * 100 : 0;
    }

    await db.capital_rotations.update(Number(id) || id, patch);
    notifyDatabaseChange();
  }, []);

  // Mark project as Done (Cair) with completion date
  const markAsDone = useCallback(async (id, completionDate = null) => {
    if (!db.capital_rotations || !id) return;
    const now = new Date();
    const dateStr = completionDate ? new Date(completionDate).toISOString() : now.toISOString();

    await db.capital_rotations.update(Number(id) || id, {
      status: 'done',
      completion_date: dateStr,
      updated_at: now.toISOString(),
    });
    notifyDatabaseChange();
  }, []);

  // Mark project as Cancel (Batal)
  const markAsCancel = useCallback(async (id, reason = '') => {
    if (!db.capital_rotations || !id) return;
    const now = new Date();
    const existing = await db.capital_rotations.get(Number(id) || id);
    const existingNotes = existing?.notes || '';
    const updatedNotes = reason ? `${existingNotes}\n[BATAL: ${reason}]`.trim() : existingNotes;

    await db.capital_rotations.update(Number(id) || id, {
      status: 'cancel',
      notes: updatedNotes,
      updated_at: now.toISOString(),
    });
    notifyDatabaseChange();
  }, []);

  // Delete rotation record
  const deleteRotation = useCallback(async (id) => {
    if (!db.capital_rotations || !id) return;
    await db.capital_rotations.delete(Number(id) || id);
    notifyDatabaseChange();
    return true;
  }, []);

  // Clear all rotation records (Reset Modal ke Rp 0)
  const clearAllRotations = useCallback(async () => {
    if (!db.capital_rotations) return;
    await db.capital_rotations.clear();
    notifyDatabaseChange();
    return true;
  }, []);

  // Helper utility: calculate 8% margin instantly
  const calculate8PercentMargin = useCallback((capital) => {
    const capNum = Number(capital) || 0;
    const profit = Math.round(capNum * 0.08);
    return {
      profit,
      roi: 8.0,
    };
  }, []);

  return {
    rotations: rotationsWithCumulatives,
    metrics,
    addRotation,
    updateRotation,
    markAsDone,
    markAsCancel,
    deleteRotation,
    clearAllRotations,
    calculate8PercentMargin,
  };
}

export default useCapitalRotations;
