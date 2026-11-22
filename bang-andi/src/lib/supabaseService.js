import { supabase, isSupabaseConfigured } from './supabase.js';
import { db } from './db.js';
import { notifyDatabaseChange } from '../hooks/useLiveQuery.js';
import { calculateMovingAverageHPP } from './hpp.js';
import { convertToBaseUnit } from './units.js';
import { translateErrorMessage, isOnline } from './errorHandler.js';
import { nanoid } from 'nanoid';

/**
 * Service to bridge Supabase (PostgreSQL Cloud) and Dexie (Local Offline-First)
 * Provides bidirectional sync and real-time event broadcasting between iPad and HP.
 */

// Track sync status
let isSyncing = false;
let syncListeners = new Set();

export function onSyncStatusChange(fn) {
  syncListeners.add(fn);
  return () => syncListeners.delete(fn);
}

function broadcastSyncStatus(status) {
  syncListeners.forEach((fn) => {
    try {
      fn(status);
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Full sync: Pulls all 8 tables from Supabase down to local Dexie cache
 */
export async function syncFromSupabase() {
  if (!isSupabaseConfigured || !supabase || !isOnline()) return false;
  if (isSyncing) return false;

  isSyncing = true;
  broadcastSyncStatus({ syncing: true, error: null });

  try {
    // 1. Categories
    const { data: categories, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!catErr && Array.isArray(categories) && categories.length > 0) {
      await db.commodities.clear();
      for (const cat of categories) {
        await db.commodities.put({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || 'Package',
          color: cat.color || '#064E3B',
          sort_order: cat.sort_order,
          type: cat.type,
        });
      }
    }

    // 2. Accounts
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('*')
      .order('name');

    if (!accErr && Array.isArray(accounts) && accounts.length > 0) {
      await db.accounts.clear();
      for (const acc of accounts) {
        await db.accounts.put({
          id: acc.id,
          name: acc.name,
          type: acc.type,
          balance: Number(acc.balance) || 0,
          account_number: acc.account_number,
          bank_name: acc.bank_name,
          is_active: acc.is_active ? 1 : 0,
          notes: acc.notes,
        });
      }
    }

    // 3. Contacts
    const { data: contacts, error: conErr } = await supabase
      .from('contacts')
      .select('*')
      .order('name');

    if (!conErr && Array.isArray(contacts) && contacts.length > 0) {
      await db.contacts.clear();
      for (const con of contacts) {
        await db.contacts.put({
          id: con.id,
          name: con.name,
          type: con.type,
          phone: con.phone,
          address: con.address,
          notes: con.notes,
          is_active: con.is_active ? 1 : 0,
        });
      }
    }

    // 4. Products
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .order('name');

    if (!prodErr && Array.isArray(products) && products.length > 0) {
      await db.items.clear();
      for (const prod of products) {
        await db.items.put({
          id: prod.id,
          category_id: prod.category_id,
          commodity_id: prod.category_id,
          code: prod.code,
          name: prod.name,
          base_unit: prod.base_unit,
          stock: Number(prod.stock) || 0,
          hpp: Number(prod.hpp) || 0,
          selling_price: Number(prod.selling_price) || 0,
          min_stock: Number(prod.min_stock) || 0,
          is_perishable: prod.is_perishable ? 1 : 0,
          is_livestock: prod.is_livestock ? 1 : 0,
          is_active: prod.is_active ? 1 : 0,
          metadata: prod.metadata || {},
        });
      }
    }

    // 5. Product Units
    const { data: units, error: unitErr } = await supabase
      .from('product_units')
      .select('*');

    if (!unitErr && Array.isArray(units) && units.length > 0) {
      await db.unit_conversions.clear();
      for (const u of units) {
        await db.unit_conversions.put({
          id: u.id,
          product_id: u.product_id,
          item_id: u.product_id,
          unit_name: u.unit_name,
          conversion_factor: Number(u.conversion_factor) || 1,
        });
      }
    }

    // 6. Transactions
    const { data: transactions, error: txErr } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (!txErr && Array.isArray(transactions) && transactions.length > 0) {
      await db.transactions.clear();
      await db.transaction_items.clear();

      for (const tx of transactions) {
        await db.transactions.put({
          id: tx.id,
          invoice_number: tx.invoice_number,
          type: tx.type,
          sub_type: tx.sub_type,
          category_id: tx.category_id,
          category: tx.category_name || '',
          contact_id: tx.contact_id,
          account_id: tx.account_id,
          to_account_id: tx.to_account_id,
          total_amount: Number(tx.total_amount) || 0,
          paid_amount: Number(tx.paid_amount) || 0,
          discount_amount: Number(tx.discount_amount) || 0,
          payment_status: tx.payment_status,
          status: tx.status,
          receipt_url: tx.receipt_url,
          date: tx.date,
          due_date: tx.due_date,
          notes: tx.notes,
          void_reason: tx.void_reason,
          voided_at: tx.voided_at,
          created_at: tx.created_at,
        });

        // Restore items snapshot
        if (Array.isArray(tx.items_snapshot)) {
          for (const item of tx.items_snapshot) {
            await db.transaction_items.add({
              transaction_id: tx.id,
              item_id: item.product_id || item.item_id,
              item_name: item.name || item.item_name || 'Barang',
              qty: Number(item.qty) || 0,
              base_qty: Number(item.base_qty || item.qty) || 0,
              unit: item.unit || 'unit',
              unit_price: Number(item.unit_price) || 0,
              subtotal: Number(item.subtotal) || 0,
              cost_price: Number(item.cost_price || item.hpp) || 0,
              cogs: Number(item.cogs) || 0,
            });
          }
        }
      }
    }

    // 7. Transaction Payments
    const { data: payments, error: payErr } = await supabase
      .from('transaction_payments')
      .select('*')
      .order('payment_date', { ascending: false });

    if (!payErr && Array.isArray(payments) && payments.length > 0) {
      await db.installments.clear();
      for (const pay of payments) {
        await db.installments.put({
          id: pay.id,
          transaction_id: pay.transaction_id,
          account_id: pay.account_id,
          amount: Number(pay.amount) || 0,
          date: pay.payment_date,
          payment_method: pay.payment_method,
          receipt_url: pay.receipt_url,
          notes: pay.notes,
        });
      }
    }

    // 8. Stock Movements
    const { data: movements, error: movErr } = await supabase
      .from('stock_movements')
      .select('*')
      .order('date', { ascending: false });

    if (!movErr && Array.isArray(movements) && movements.length > 0) {
      await db.stock_mutations.clear();
      for (const m of movements) {
        await db.stock_mutations.put({
          id: m.id,
          item_id: m.product_id,
          product_id: m.product_id,
          transaction_id: m.transaction_id,
          type: m.type,
          qty: Number(m.qty) || 0,
          unit: m.unit,
          previous_stock: Number(m.previous_stock) || 0,
          new_stock: Number(m.new_stock) || 0,
          date: m.date,
          notes: m.notes,
        });
      }
    }

    notifyDatabaseChange();
    broadcastSyncStatus({ syncing: false, lastSync: new Date(), error: null });
    return true;
  } catch (err) {
    const friendlyMessage = translateErrorMessage(err, 'Gagal menyinkronkan data dengan Supabase.');
    broadcastSyncStatus({ syncing: false, error: friendlyMessage });
    return false;
  } finally {
    isSyncing = false;
  }
}

/**
 * Setup Realtime Listeners to sync across iPad and HP
 */
export function setupRealtimeSync() {
  if (!isSupabaseConfigured || !supabase) return () => {};

  const channel = supabase
    .channel('bang-andi-realtime-channel')
    .on('postgres_changes', { event: '*', schema: 'public' }, async () => {
      // Trigger refresh from Supabase to keep Dexie in sync
      await syncFromSupabase();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Creates a transaction in Supabase and locally
 */
export async function createSupabaseTransaction(txData) {
  const now = new Date();
  const txDate = txData.date ? new Date(txData.date).toISOString() : now.toISOString();
  const invoiceNumber =
    txData.invoice_number ||
    `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}-${nanoid(4).toUpperCase()}`;

  const totalAmount = Math.round(Number(txData.total_amount) || 0);
  const paidAmount = Math.round(Number(txData.paid_amount) || 0);

  let paymentStatus = txData.payment_status;
  if (!paymentStatus) {
    if (paidAmount >= totalAmount) {
      paymentStatus = 'paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'credit';
    }
  }

  // Pre-calculate line items & stock changes
  const allConversions = await db.unit_conversions.toArray();
  const processedItems = [];
  const stockMovementsToCreate = [];

  if (Array.isArray(txData.items)) {
    for (const item of txData.items) {
      const rawId = item.product_id || item.item_id || item.id;
      const dbItem = await db.items.get(rawId);

      const inputQty = Number(item.qty) || 0;
      const unit = item.unit || (dbItem ? dbItem.base_unit : 'unit');
      const unitPrice = Math.round(Number(item.unit_price) || 0);
      const subtotal = Math.round(Number(item.subtotal) || inputQty * unitPrice);

      const baseQty = convertToBaseUnit(inputQty, unit, allConversions);
      const currentHPP = dbItem ? Number(dbItem.hpp) || 0 : 0;
      const currentStock = dbItem ? Number(dbItem.stock) || 0 : 0;

      let mutationType = 'in';
      let newStock = currentStock;
      let newHPP = currentHPP;

      if (txData.type === 'income' && txData.sub_type === 'sale') {
        if (currentStock <= 0) {
          throw new Error(
            `Stok komoditas "${dbItem ? dbItem.name : 'Barang'}" sedang KOSONG (0 ${dbItem?.base_unit || 'unit'}). Silakan lakukan input stok masuk / pembelian terlebih dahulu sebelum menjual.`
          );
        }
        if (currentStock < baseQty) {
          throw new Error(
            `Stok "${dbItem ? dbItem.name : 'Barang'}" tidak mencukupi (Tersedia: ${currentStock} ${dbItem?.base_unit || ''}, diminta: ${baseQty} ${unit}). Silakan input stok masuk terlebih dahulu.`
          );
        }
        mutationType = 'out';
        newStock = currentStock - baseQty;
      } else if (txData.type === 'expense' && txData.sub_type === 'purchase') {
        mutationType = 'in';
        const pricePerBaseUnit = baseQty > 0 ? subtotal / baseQty : unitPrice;
        newHPP = calculateMovingAverageHPP(currentStock, currentHPP, baseQty, pricePerBaseUnit);
        newStock = currentStock + baseQty;
      }

      processedItems.push({
        product_id: dbItem ? dbItem.id : rawId,
        name: dbItem ? dbItem.name : item.name || 'Barang',
        qty: inputQty,
        base_qty: baseQty,
        unit: unit,
        unit_price: unitPrice,
        subtotal: subtotal,
        cost_price: currentHPP,
        cogs: Math.round(baseQty * currentHPP),
        new_stock: newStock,
        new_hpp: newHPP,
      });

      if (dbItem) {
        stockMovementsToCreate.push({
          product_id: dbItem.id,
          type: mutationType,
          qty: baseQty,
          unit: dbItem.base_unit || unit,
          previous_stock: currentStock,
          new_stock: newStock,
          date: txDate,
          notes: `Faktur ${invoiceNumber}`,
        });
      }
    }
  }

  // 1. If Supabase is connected, write to Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: newTx, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user?.id || null,
          invoice_number: invoiceNumber,
          type: txData.type,
          sub_type: txData.sub_type || 'operational',
          category_id: txData.category_id || null,
          category_name: txData.category_name || txData.category || '',
          contact_id: txData.contact_id || null,
          account_id: txData.account_id || null,
          to_account_id: txData.to_account_id || null,
          total_amount: totalAmount,
          discount_amount: Number(txData.discount_amount) || 0,
          paid_amount: paidAmount,
          payment_status: paymentStatus,
          status: 'completed',
          receipt_url: txData.receipt_url || null,
          date: txDate,
          due_date: txData.due_date ? new Date(txData.due_date).toISOString() : null,
          notes: txData.notes || '',
          items_snapshot: processedItems,
        })
        .select()
        .single();

      if (txError) throw txError;

      const txId = newTx.id;

      // Create initial payment if paid partially or full
      if (paidAmount > 0) {
        await supabase.from('transaction_payments').insert({
          user_id: user?.id || null,
          transaction_id: txId,
          account_id: txData.account_id || null,
          amount: paidAmount,
          payment_date: txDate,
          payment_method: txData.payment_method || 'Kas',
          receipt_url: txData.receipt_url || null,
          notes: 'Pembayaran Pertama / Lunas',
        });
      }

      // Record stock movements and update products
      for (const item of processedItems) {
        if (item.product_id) {
          await supabase
            .from('products')
            .update({
              stock: item.new_stock,
              hpp: item.new_hpp,
              updated_at: now.toISOString(),
            })
            .eq('id', item.product_id);

          await supabase.from('stock_movements').insert({
            user_id: user?.id || null,
            product_id: item.product_id,
            transaction_id: txId,
            type: txData.type === 'income' ? 'out' : 'in',
            qty: item.base_qty,
            unit: item.unit,
            previous_stock: item.new_stock + (txData.type === 'income' ? item.base_qty : -item.base_qty),
            new_stock: item.new_stock,
            date: txDate,
            notes: `Transaksi ${invoiceNumber}`,
          });
        }
      }

      // Update account balance in Supabase
      if (txData.account_id) {
        const { data: currentAcc } = await supabase
          .from('accounts')
          .select('balance')
          .eq('id', txData.account_id)
          .single();

        if (currentAcc) {
          const delta = txData.type === 'income' ? paidAmount : -paidAmount;
          await supabase
            .from('accounts')
            .update({
              balance: (Number(currentAcc.balance) || 0) + delta,
              updated_at: now.toISOString(),
            })
            .eq('id', txData.account_id);
        }
      }

      // Pull fresh data to local Dexie
      await syncFromSupabase();
      return txId;
    } catch (err) {
      console.warn('Gagal simpan ke Supabase, simpan ke lokal Dexie:', err);
    }
  }

  // 2. Fallback / Local Dexie Execution
  const localTxId = nanoid(12);
  await db.transactions.add({
    id: localTxId,
    invoice_number: invoiceNumber,
    type: txData.type,
    sub_type: txData.sub_type || 'operational',
    category_id: txData.category_id || null,
    category: txData.category || '',
    contact_id: txData.contact_id || null,
    account_id: txData.account_id || null,
    to_account_id: txData.to_account_id || null,
    total_amount: totalAmount,
    discount_amount: Number(txData.discount_amount) || 0,
    paid_amount: paidAmount,
    payment_status: paymentStatus,
    status: 'completed',
    receipt_url: txData.receipt_url || null,
    date: txDate,
    due_date: txData.due_date ? new Date(txData.due_date).toISOString() : null,
    notes: txData.notes || '',
    created_at: now.toISOString(),
  });

  for (const item of processedItems) {
    await db.transaction_items.add({
      transaction_id: localTxId,
      item_id: item.product_id,
      item_name: item.name,
      qty: item.qty,
      base_qty: item.base_qty,
      unit: item.unit,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      cost_price: item.cost_price,
      cogs: item.cogs,
    });

    if (item.product_id) {
      await db.items.update(item.product_id, {
        stock: item.new_stock,
        hpp: item.new_hpp,
        updated_at: now.toISOString(),
      });

      await db.stock_mutations.add({
        item_id: item.product_id,
        transaction_id: localTxId,
        type: txData.type === 'income' ? 'out' : 'in',
        qty: item.base_qty,
        unit: item.unit,
        previous_stock: item.new_stock + (txData.type === 'income' ? item.base_qty : -item.base_qty),
        new_stock: item.new_stock,
        date: txDate,
        notes: `Transaksi ${invoiceNumber}`,
      });
    }
  }

  // Update account
  if (txData.account_id) {
    const acc = await db.accounts.get(txData.account_id);
    if (acc) {
      const delta = txData.type === 'income' ? paidAmount : -paidAmount;
      await db.accounts.update(acc.id, {
        balance: (Number(acc.balance) || 0) + delta,
        updated_at: now.toISOString(),
      });
    }
  }

  // Installment
  if (paidAmount > 0) {
    await db.installments.add({
      transaction_id: localTxId,
      account_id: txData.account_id || null,
      amount: paidAmount,
      date: txDate,
      payment_method: 'Kas',
      receipt_url: txData.receipt_url || null,
      notes: 'Pembayaran Pertama / Lunas',
    });
  }

  notifyDatabaseChange();
  return localTxId;
}

/**
 * Voids a transaction in Supabase and syncs back to keep cloud and local consistent
 */
export async function voidSupabaseTransaction(txId, reason = '') {
  if (!isSupabaseConfigured || !supabase || !isOnline()) return false;

  try {
    const now = new Date();

    // 1. Fetch transaction record from Supabase
    const { data: tx, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', txId)
      .maybeSingle();

    if (fetchErr || !tx) {
      // Transaction may only exist locally
      return false;
    }

    if (tx.status === 'void') return true;

    // 2. Mark transaction as void in Supabase
    const { error: updateErr } = await supabase
      .from('transactions')
      .update({
        status: 'void',
        void_reason: reason || 'Dibatalkan oleh pengguna',
        voided_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', txId);

    if (updateErr) throw updateErr;

    // 3. Reverse stock for line items in Supabase
    if (Array.isArray(tx.items_snapshot)) {
      for (const item of tx.items_snapshot) {
        const prodId = item.product_id || item.item_id;
        if (!prodId) continue;

        const { data: currentProd } = await supabase
          .from('products')
          .select('stock')
          .eq('id', prodId)
          .maybeSingle();

        if (currentProd) {
          const curStock = Number(currentProd.stock) || 0;
          const baseQty = Number(item.base_qty || item.qty) || 0;
          let newStock = curStock;

          if (tx.type === 'income' && (tx.sub_type === 'sale' || tx.sub_type === 'sales')) {
            newStock = curStock + baseQty;
          } else if (tx.type === 'expense' && (tx.sub_type === 'purchase' || tx.sub_type === 'purchases')) {
            newStock = Math.max(0, curStock - baseQty);
          }

          await supabase
            .from('products')
            .update({
              stock: newStock,
              updated_at: now.toISOString(),
            })
            .eq('id', prodId);

          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('stock_movements').insert({
            user_id: user?.id || null,
            product_id: prodId,
            transaction_id: txId,
            type: 'void_reversal',
            qty: baseQty,
            unit: item.unit || 'unit',
            previous_stock: curStock,
            new_stock: newStock,
            date: now.toISOString(),
            notes: `Pembatalan (Void) Faktur ${tx.invoice_number}: ${reason || 'Batal'}`,
          });
        }
      }
    }

    // 4. Reverse account balance in Supabase
    if (tx.account_id && Number(tx.paid_amount) > 0) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', tx.account_id)
        .maybeSingle();

      if (acc) {
        const paid = Number(tx.paid_amount) || 0;
        const curBal = Number(acc.balance) || 0;
        const delta = tx.type === 'income' ? -paid : paid;

        await supabase
          .from('accounts')
          .update({
            balance: curBal + delta,
            updated_at: now.toISOString(),
          })
          .eq('id', tx.account_id);
      }
    }

    return true;
  } catch (err) {
    console.warn('Gagal void transaksi di Supabase:', err);
    return false;
  }
}

/**
 * Creates a new product in Supabase and returns the created record or null
 */
export async function createSupabaseProduct(productData) {
  if (!isSupabaseConfigured || !supabase || !isOnline()) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date();

    const insertPayload = {
      user_id: user?.id || null,
      category_id: productData.commodity_id || productData.category_id || null,
      code: productData.code || null,
      name: String(productData.name || '').trim().slice(0, 150),
      base_unit: String(productData.base_unit || 'kg').trim().toLowerCase().slice(0, 30),
      stock: Math.max(0, Number(productData.stock) || 0),
      hpp: Math.max(0, Math.round(Number(productData.hpp) || 0)),
      selling_price: Math.max(0, Math.round(Number(productData.selling_price) || 0)),
      min_stock: Math.max(0, Number(productData.min_stock) || 0),
      is_perishable: Boolean(productData.is_perishable),
      is_livestock: Boolean(productData.is_livestock),
      is_active: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { data, error } = await supabase
      .from('products')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Gagal simpan produk ke Supabase:', err);
    return null;
  }
}

/**
 * Updates a product in Supabase
 */
export async function updateSupabaseProduct(productId, updates) {
  if (!isSupabaseConfigured || !supabase || !isOnline() || !productId) return false;

  try {
    const now = new Date();
    const payload = {
      updated_at: now.toISOString(),
    };

    if (updates.name !== undefined) payload.name = String(updates.name).trim().slice(0, 150);
    if (updates.commodity_id !== undefined) payload.category_id = updates.commodity_id || null;
    if (updates.category_id !== undefined) payload.category_id = updates.category_id || null;
    if (updates.base_unit !== undefined) payload.base_unit = String(updates.base_unit).trim().toLowerCase().slice(0, 30);
    if (updates.stock !== undefined) payload.stock = Math.max(0, Number(updates.stock) || 0);
    if (updates.hpp !== undefined) payload.hpp = Math.max(0, Math.round(Number(updates.hpp) || 0));
    if (updates.selling_price !== undefined) payload.selling_price = Math.max(0, Math.round(Number(updates.selling_price) || 0));
    if (updates.min_stock !== undefined) payload.min_stock = Math.max(0, Number(updates.min_stock) || 0);
    if (updates.is_perishable !== undefined) payload.is_perishable = Boolean(updates.is_perishable);
    if (updates.is_livestock !== undefined) payload.is_livestock = Boolean(updates.is_livestock);

    const { error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', productId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Gagal update produk di Supabase:', err);
    return false;
  }
}

/**
 * Deletes a product in Supabase
 */
export async function deleteSupabaseProduct(productId) {
  if (!isSupabaseConfigured || !supabase || !isOnline() || !productId) return false;

  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Gagal hapus produk di Supabase:', err);
    return false;
  }
}

/**
 * Records a stock adjustment (Opname) in Supabase
 */
export async function adjustSupabaseStock(productId, delta, reason = 'Penyesuaian Stok', notes = '') {
  if (!isSupabaseConfigured || !supabase || !isOnline() || !productId) return false;

  try {
    const now = new Date();
    const { data: prod, error: fetchErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (fetchErr || !prod) return false;

    const curStock = Number(prod.stock) || 0;
    const newStock = Math.max(0, curStock + Number(delta));

    await supabase
      .from('products')
      .update({
        stock: newStock,
        updated_at: now.toISOString(),
      })
      .eq('id', productId);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('stock_movements').insert({
      user_id: user?.id || null,
      product_id: productId,
      type: 'adjustment',
      qty: Number(delta),
      unit: prod.base_unit || 'unit',
      previous_stock: curStock,
      new_stock: newStock,
      date: now.toISOString(),
      notes: `${reason}${notes ? ` - ${notes}` : ''}`,
    });

    return true;
  } catch (err) {
    console.warn('Gagal catat penyesuaian stok di Supabase:', err);
    return false;
  }
}
