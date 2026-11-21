import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { differenceInCalendarDays } from 'date-fns';
import { db } from '../lib/db.js';
import { calculateMovingAverageHPP } from '../lib/hpp.js';
import { convertToBaseUnit } from '../lib/units.js';
import { useLiveQuery, notifyDatabaseChange } from './useLiveQuery.js';

export function getAllItemsQuery() {
  return db.items.toArray();
}

export function useStock() {
  const items = useLiveQuery(
    async () => {
      return await db.items.toArray();
    },
    [],
    []
  );

  /**
   * Add stock (Pembelian / Masuk) with HPP recalculation
   */
  const addStockIn = useCallback(
    async (itemId, qty, price, unit = null, expiryDate = null) => {
      return await db.transaction(
        'rw',
        [db.items, db.stock_mutations, db.stock_batches, db.unit_conversions, db.audit_log],
        async () => {
          const item = await db.items.get(Number(itemId) || itemId);
          if (!item) throw new Error('Komoditas/Barang tidak ditemukan');

          const allConversions = await db.unit_conversions.toArray();
          const targetUnit = unit || item.base_unit || 'unit';
          const inputQty = Number(qty) || 0;
          const inputPrice = Number(price) || 0;

          const baseQty = convertToBaseUnit(inputQty, targetUnit, allConversions);
          const currentStock = Number(item.stock) || 0;
          const currentHPP = Number(item.hpp) || 0;

          const pricePerBaseUnit = baseQty > 0 ? (inputQty * inputPrice) / baseQty : inputPrice;
          const newHPP = calculateMovingAverageHPP(currentStock, currentHPP, baseQty, pricePerBaseUnit);
          const newStock = currentStock + baseQty;
          const now = new Date();

          await db.items.update(item.id, {
            stock: newStock,
            hpp: newHPP,
            updated_at: now.toISOString(),
          });

          // Stock mutation
          await db.stock_mutations.add({
            code: nanoid(10),
            item_id: item.id,
            type: 'in',
            qty: baseQty,
            unit: item.base_unit || targetUnit,
            previous_stock: currentStock,
            new_stock: newStock,
            date: now.toISOString(),
            notes: `Stok Masuk: ${inputQty} ${targetUnit} @ Rp ${inputPrice.toLocaleString('id-ID')}`,
          });

          // Create batch if expiring
          if (expiryDate || item.is_perishable) {
            await db.stock_batches.add({
              code: nanoid(10),
              item_id: item.id,
              batch_number: `BATCH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${nanoid(4).toUpperCase()}`,
              initial_qty: baseQty,
              current_qty: baseQty,
              unit: item.base_unit || targetUnit,
              expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
              status: 'active',
              created_at: now.toISOString(),
            });
          }

          await db.audit_log.add({
            timestamp: now.toISOString(),
            action: 'stock_in',
            entity_type: 'item',
            entity_id: item.id,
            details: { qty: baseQty, newHPP, newStock },
          });

          notifyDatabaseChange();
          return { newStock, newHPP };
        }
      );
    },
    []
  );

  /**
   * Remove stock (Pengeluaran Barang)
   */
  const addStockOut = useCallback(async (itemId, qty, unit = null, reason = 'Stok Keluar') => {
    return await db.transaction('rw', [db.items, db.stock_mutations, db.unit_conversions, db.audit_log], async () => {
      const item = await db.items.get(Number(itemId) || itemId);
      if (!item) throw new Error('Komoditas/Barang tidak ditemukan');

      const allConversions = await db.unit_conversions.toArray();
      const targetUnit = unit || item.base_unit || 'unit';
      const inputQty = Number(qty) || 0;
      const baseQty = convertToBaseUnit(inputQty, targetUnit, allConversions);

      const currentStock = Number(item.stock) || 0;
      const newStock = Math.max(0, currentStock - baseQty);
      const now = new Date();

      await db.items.update(item.id, {
        stock: newStock,
        updated_at: now.toISOString(),
      });

      await db.stock_mutations.add({
        code: nanoid(10),
        item_id: item.id,
        type: 'out',
        qty: baseQty,
        unit: item.base_unit || targetUnit,
        previous_stock: currentStock,
        new_stock: newStock,
        date: now.toISOString(),
        notes: reason || 'Stok Keluar',
      });

      await db.audit_log.add({
        timestamp: now.toISOString(),
        action: 'stock_out',
        entity_type: 'item',
        entity_id: item.id,
        details: { qty: baseQty, previous_stock: currentStock, new_stock: newStock, reason },
      });

      notifyDatabaseChange();
      return { newStock };
    });
  }, []);

  /**
   * Adjust stock (Penyesuaian Opname / Rusak / Susut)
   * deltaQty can be negative or positive
   */
  const adjustStock = useCallback(async (itemId, deltaQty, reason = 'Penyesuaian Stok', notes = '') => {
    return await db.transaction('rw', [db.items, db.stock_mutations, db.audit_log], async () => {
      const item = await db.items.get(Number(itemId) || itemId);
      if (!item) throw new Error('Komoditas/Barang tidak ditemukan');

      const delta = Number(deltaQty) || 0;
      const currentStock = Number(item.stock) || 0;
      const newStock = Math.max(0, currentStock + delta);
      const now = new Date();

      await db.items.update(item.id, {
        stock: newStock,
        updated_at: now.toISOString(),
      });

      await db.stock_mutations.add({
        code: nanoid(10),
        item_id: item.id,
        type: 'adjustment',
        qty: delta,
        unit: item.base_unit || 'unit',
        previous_stock: currentStock,
        new_stock: newStock,
        date: now.toISOString(),
        notes: `${reason}${notes ? ` - ${notes}` : ''}`,
      });

      await db.audit_log.add({
        timestamp: now.toISOString(),
        action: 'stock_adjustment',
        entity_type: 'item',
        entity_id: item.id,
        details: { delta, currentStock, newStock, reason },
      });

      notifyDatabaseChange();
      return { newStock };
    });
  }, []);

  /**
   * Returns active stock alerts: below min_stock or near expiry
   */
  const getStockAlerts = useCallback(async () => {
    const allItems = await db.items.toArray();
    const allBatches = await db.stock_batches.toArray();
    const now = new Date();

    const lowStock = allItems.filter((it) => {
      const min = Number(it.min_stock) || 0;
      return (Number(it.stock) || 0) <= min;
    });

    const expiringBatches = allBatches.filter((batch) => {
      if (batch.status !== 'active' || !batch.expiry_date) return false;
      const daysUntilExpiry = differenceInCalendarDays(new Date(batch.expiry_date), now);
      return daysUntilExpiry <= 7; // 7 days or less to expiry
    });

    return {
      lowStock,
      expiringBatches,
      totalAlerts: lowStock.length + expiringBatches.length,
    };
  }, []);

  /**
   * Update livestock weight record
   */
  const updateLivestockWeight = useCallback(async (livestockId, weight, date = null) => {
    return await db.transaction('rw', [db.livestock_records, db.livestock_weights, db.audit_log], async () => {
      const record = await db.livestock_records.get(Number(livestockId) || livestockId);
      if (!record) throw new Error('Data ternak tidak ditemukan');

      const numWeight = Number(weight) || 0;
      const measureDate = date ? new Date(date).toISOString() : new Date().toISOString();

      const weightId = await db.livestock_weights.add({
        livestock_id: record.id,
        weight: numWeight,
        date: measureDate,
        notes: 'Pencatatan timbangan rutin',
      });

      await db.livestock_records.update(record.id, {
        current_weight: numWeight,
        updated_at: new Date().toISOString(),
      });

      notifyDatabaseChange();
      return weightId;
    });
  }, []);

  return {
    items,
    addStockIn,
    addStockOut,
    adjustStock,
    getStockAlerts,
    updateLivestockWeight,
  };
}

export default useStock;
