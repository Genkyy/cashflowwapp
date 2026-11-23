import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { differenceInCalendarDays } from 'date-fns';
import { db } from '../lib/db.js';
import { calculateMovingAverageHPP } from '../lib/hpp.js';
import { convertToBaseUnit } from '../lib/units.js';
import { useLiveQuery, notifyDatabaseChange } from './useLiveQuery.js';
import {
  createSupabaseProduct,
  updateSupabaseProduct,
  deleteSupabaseProduct,
  adjustSupabaseStock,
} from '../lib/supabaseService.js';
import { isSupabaseConfigured } from '../lib/supabase.js';
import { isOnline } from '../lib/errorHandler.js';

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
      if (inputQty <= 0) {
        throw new Error('Jumlah stok keluar harus lebih dari 0.');
      }
      if (currentStock <= 0) {
        throw new Error(`Stok barang "${item.name}" sedang KOSONG (0 ${item.base_unit || ''}). Silakan input stok masuk terlebih dahulu.`);
      }
      if (currentStock < baseQty) {
        throw new Error(`Stok barang "${item.name}" tidak mencukupi (Tersedia: ${currentStock} ${item.base_unit || ''}, diminta: ${baseQty} ${targetUnit}). Silakan input stok masuk terlebih dahulu.`);
      }
      const newStock = currentStock - baseQty;
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
    const result = await db.transaction('rw', [db.items, db.stock_mutations, db.audit_log], async () => {
      const item = await db.items.get(Number(itemId) || itemId);
      if (!item) throw new Error('Komoditas/Barang tidak ditemukan');

      const delta = Number(deltaQty) || 0;
      const currentStock = Number(item.stock) || 0;
      if (currentStock + delta < 0) {
        throw new Error(
          `Penyesuaian stok tidak valid: stok akhir tidak boleh minus (Stok saat ini: ${currentStock} ${item.base_unit || ''}, pengurangan: ${Math.abs(delta)}).`
        );
      }
      const newStock = Math.max(0, Math.round((currentStock + delta) * 1000) / 1000);
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

    try {
      await adjustSupabaseStock(itemId, deltaQty, reason, notes);
    } catch {
      // Offline fallback
    }

    return result;
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

  /**
   * Create a new stock item (Katalog Komoditas / Barang Baru)
   */
  const createItem = useCallback(
    async ({
      name,
      commodity_id,
      newCommodityName,
      base_unit = 'kg',
      stock = 0,
      hpp = 0,
      selling_price = 0,
      min_stock = 0,
      is_perishable = false,
      is_livestock = false,
      conversions = [],
    }) => {
      const resultId = await db.transaction(
        'rw',
        [db.items, db.commodities, db.stock_mutations, db.unit_conversions, db.audit_log],
        async () => {
          const now = new Date();
          let targetCommodityId = commodity_id;

          // If user provided a new commodity category name
          if (newCommodityName && newCommodityName.trim()) {
            const trimmedName = newCommodityName.trim();
            const existingCom = await db.commodities
              .filter((c) => (c.name || '').toLowerCase() === trimmedName.toLowerCase())
              .first();

            if (existingCom) {
              targetCommodityId = existingCom.id;
            } else {
              targetCommodityId = await db.commodities.add({
                id_str: `com-${nanoid(6)}`,
                name: trimmedName,
                icon: 'Package',
                color: '#00D29E',
                created_at: now.toISOString(),
              });
            }
          }

          const stockNum = Math.max(0, Number(stock) || 0);
          const hppNum = Math.max(0, Number(hpp) || 0);
          const sellNum = Math.max(0, Number(selling_price) || 0);
          const minStockNum = Math.max(0, Number(min_stock) || 0);

          // Generate unique item code
          const cleanPrefix = (name || 'ITM')
            .trim()
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 3)
            .toUpperCase();
          const code = `ITM-${cleanPrefix || 'GEN'}-${nanoid(4).toUpperCase()}`;

          const newItemId = await db.items.add({
            code,
            commodity_id: targetCommodityId ? (Number(targetCommodityId) || targetCommodityId) : null,
            name: (name || '').trim(),
            base_unit: (base_unit || 'unit').trim().toLowerCase(),
            stock: stockNum,
            hpp: hppNum,
            selling_price: sellNum,
            min_stock: minStockNum,
            is_perishable: is_perishable ? 1 : 0,
            is_livestock: is_livestock ? 1 : 0,
            is_active: 1,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
          });

          // Record initial stock mutation if stock > 0
          if (stockNum > 0) {
            await db.stock_mutations.add({
              code: nanoid(10),
              item_id: newItemId,
              type: 'in',
              qty: stockNum,
              unit: (base_unit || 'unit').trim().toLowerCase(),
              previous_stock: 0,
              new_stock: stockNum,
              date: now.toISOString(),
              notes: `Saldo Stok Awal Barang Baru: ${stockNum} ${base_unit}`,
            });
          }

          // Save conversions if any
          if (Array.isArray(conversions) && conversions.length > 0) {
            for (const conv of conversions) {
              if (conv.unit_name && Number(conv.factor) > 0) {
                await db.unit_conversions.add({
                  item_id: newItemId,
                  unit_name: conv.unit_name.trim(),
                  factor: Number(conv.factor),
                  label: `1 ${conv.unit_name} = ${conv.factor} ${base_unit}`,
                });
              }
            }
          }

          await db.audit_log.add({
            timestamp: now.toISOString(),
            action: 'create_item',
            entity_type: 'item',
            entity_id: newItemId,
            details: { name, stock: stockNum, hpp: hppNum, selling_price: sellNum },
          });

          notifyDatabaseChange();
          return newItemId;
        }
      );

      // Sync to Supabase in background if online
      try {
        await createSupabaseProduct({
          id: resultId,
          name,
          commodity_id,
          base_unit,
          stock,
          hpp,
          selling_price,
          min_stock,
          is_perishable,
          is_livestock,
        });
      } catch {
        // Handled silently
      }

      return resultId;
    },
    []
  );

  /**
   * Update an existing stock item (Ubah Nama, Jumlah Stok, Harga, dsb)
   */
  const updateItem = useCallback(
    async (
      itemId,
      {
        name,
        commodity_id,
        newCommodityName,
        base_unit,
        stock,
        hpp,
        selling_price,
        min_stock,
        is_perishable,
        is_livestock,
        conversions = null,
      }
    ) => {
      const resultId = await db.transaction(
        'rw',
        [db.items, db.commodities, db.stock_mutations, db.unit_conversions, db.audit_log],
        async () => {
          const item = await db.items.get(Number(itemId) || itemId);
          if (!item) throw new Error('Barang/Komoditas tidak ditemukan');

          const now = new Date();
          let targetCommodityId = commodity_id !== undefined ? commodity_id : item.commodity_id;

          // If new commodity category is entered
          if (newCommodityName && newCommodityName.trim()) {
            const trimmedName = newCommodityName.trim();
            const existingCom = await db.commodities
              .filter((c) => (c.name || '').toLowerCase() === trimmedName.toLowerCase())
              .first();

            if (existingCom) {
              targetCommodityId = existingCom.id;
            } else {
              targetCommodityId = await db.commodities.add({
                id_str: `com-${nanoid(6)}`,
                name: trimmedName,
                icon: 'Package',
                color: '#00D29E',
                created_at: now.toISOString(),
              });
            }
          }

          const currentStock = Number(item.stock) || 0;
          const newStock = stock !== undefined ? Math.max(0, Number(stock) || 0) : currentStock;
          const diff = newStock - currentStock;

          // Record stock mutation if quantity was updated directly
          if (diff !== 0) {
            await db.stock_mutations.add({
              code: nanoid(10),
              item_id: item.id,
              type: diff > 0 ? 'in' : 'out',
              qty: Math.abs(diff),
              unit: (base_unit || item.base_unit || 'unit').trim().toLowerCase(),
              previous_stock: currentStock,
              new_stock: newStock,
              date: now.toISOString(),
              notes: `Perubahan Jumlah Stok: ${currentStock} → ${newStock} (${diff > 0 ? '+' : ''}${diff})`,
            });
          }

          const updatedFields = {
            updated_at: now.toISOString(),
          };

          if (name !== undefined) updatedFields.name = name.trim();
          if (targetCommodityId !== undefined) {
            updatedFields.commodity_id = targetCommodityId ? (Number(targetCommodityId) || targetCommodityId) : null;
          }
          if (base_unit !== undefined) updatedFields.base_unit = base_unit.trim().toLowerCase();
          if (stock !== undefined) updatedFields.stock = newStock;
          if (hpp !== undefined) updatedFields.hpp = Math.max(0, Number(hpp) || 0);
          if (selling_price !== undefined) updatedFields.selling_price = Math.max(0, Number(selling_price) || 0);
          if (min_stock !== undefined) updatedFields.min_stock = Math.max(0, Number(min_stock) || 0);
          if (is_perishable !== undefined) updatedFields.is_perishable = is_perishable ? 1 : 0;
          if (is_livestock !== undefined) updatedFields.is_livestock = is_livestock ? 1 : 0;

          await db.items.update(item.id, updatedFields);

          // Update conversions if provided
          if (Array.isArray(conversions)) {
            // Remove previous conversions for this item
            await db.unit_conversions.where('item_id').equals(item.id).delete();
            for (const conv of conversions) {
              if (conv.unit_name && Number(conv.factor) > 0) {
                await db.unit_conversions.add({
                  item_id: item.id,
                  unit_name: conv.unit_name.trim(),
                  factor: Number(conv.factor),
                  label: `1 ${conv.unit_name} = ${conv.factor} ${updatedFields.base_unit || item.base_unit}`,
                });
              }
            }
          }

          await db.audit_log.add({
            timestamp: now.toISOString(),
            action: 'update_item',
            entity_type: 'item',
            entity_id: item.id,
            details: { updatedFields, diff },
          });

          notifyDatabaseChange();
          return item.id;
        }
      );

      // Sync to Supabase
      try {
        await updateSupabaseProduct(itemId, {
          name,
          commodity_id,
          base_unit,
          stock,
          hpp,
          selling_price,
          min_stock,
          is_perishable,
          is_livestock,
        });
      } catch {
        // Offline
      }

      return resultId;
    },
    []
  );

  /**
   * Delete or archive a stock item
   * Note: Deletion is confirmed by Supabase first when online.
   * No optimistic local update is made if cloud deletion fails,
   * preventing the item from reappearing after sync/refresh.
   */
  const deleteItem = useCallback(
    async (itemId) => {
      const item = await db.items.get(Number(itemId) || itemId);
      if (!item) throw new Error('Barang tidak ditemukan');

      // 1. If Supabase is configured, delete in Supabase Cloud FIRST
      if (isSupabaseConfigured) {
        if (!isOnline()) {
          throw new Error('Tidak dapat menghapus barang saat offline. Koneksi internet diperlukan agar data di cloud terhapus dan tidak muncul kembali.');
        }
        await deleteSupabaseProduct(itemId);
      }

      // 2. Only after Supabase confirms deletion, delete locally in Dexie
      await db.transaction('rw', [db.items, db.unit_conversions, db.audit_log], async () => {
        await db.unit_conversions.where('item_id').equals(item.id).delete();
        await db.items.delete(item.id);

        await db.audit_log.add({
          timestamp: new Date().toISOString(),
          action: 'delete_item',
          entity_type: 'item',
          entity_id: item.id,
          details: { name: item.name },
        });

        notifyDatabaseChange();
      });

      return true;
    },
    []
  );

  return {
    items,
    addStockIn,
    addStockOut,
    adjustStock,
    getStockAlerts,
    updateLivestockWeight,
    createItem,
    updateItem,
    deleteItem,
  };
}

export default useStock;
