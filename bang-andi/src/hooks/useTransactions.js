import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { db } from '../lib/db.js';
import { calculateMovingAverageHPP } from '../lib/hpp.js';
import { convertToBaseUnit } from '../lib/units.js';
import { useLiveQuery, notifyDatabaseChange } from './useLiveQuery.js';

export function getAllTransactionsQuery() {
  return db.transactions.orderBy('date').reverse().toArray();
}

export function getTransactionById(id) {
  return db.transactions.get(Number(id) || id);
}

export function useTransactions() {
  const transactions = useLiveQuery(
    async () => {
      const list = await db.transactions.orderBy('date').reverse().toArray();
      // Attach items, contacts, and accounts if needed
      return list;
    },
    [],
    []
  );

  /**
   * Create a new transaction with automatic items, stock mutations, HPP recalculation, and account balances
   */
  const addTransaction = useCallback(async (data) => {
    return await db.transaction(
      'rw',
      [
        db.transactions,
        db.transaction_items,
        db.stock_mutations,
        db.items,
        db.unit_conversions,
        db.accounts,
        db.installments,
        db.audit_log,
      ],
      async () => {
        const now = new Date();
        const txDate = data.date ? new Date(data.date).toISOString() : now.toISOString();
        const code = nanoid(10);
        const invoiceNumber =
          data.invoice_number ||
          `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
            now.getDate()
          ).padStart(2, '0')}-${nanoid(4).toUpperCase()}`;

        const totalAmount = Math.round(Number(data.total_amount) || 0);
        const paidAmount = Math.round(Number(data.paid_amount) || 0);

        let paymentStatus = data.payment_status;
        if (!paymentStatus) {
          if (paidAmount >= totalAmount) {
            paymentStatus = 'paid';
          } else if (paidAmount > 0) {
            paymentStatus = 'partial';
          } else {
            paymentStatus = 'credit';
          }
        }

        const txRecord = {
          code,
          invoice_number: invoiceNumber,
          type: data.type, // 'income' | 'expense' | 'transfer'
          sub_type: data.sub_type || 'operational',
          contact_id: data.contact_id || null,
          account_id: data.account_id || null,
          to_account_id: data.to_account_id || null,
          payment_status: paymentStatus,
          status: 'completed',
          total_amount: totalAmount,
          paid_amount: paidAmount,
          date: txDate,
          due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
          notes: data.notes || '',
          category: data.category || '',
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        const txId = await db.transactions.add(txRecord);

        // Fetch conversions once for items calculation
        const allConversions = await db.unit_conversions.toArray();

        // Process line items if any
        if (Array.isArray(data.items) && data.items.length > 0) {
          for (const itemData of data.items) {
            const rawItemId = itemData.item_id || itemData.id;
            const item = await db.items.get(Number(rawItemId) || rawItemId);

            const inputQty = Number(itemData.qty) || 0;
            const unit = itemData.unit || (item ? item.base_unit : 'unit');
            const unitPrice = Math.round(Number(itemData.unit_price) || 0);
            const subtotal = Math.round(Number(itemData.subtotal) || inputQty * unitPrice);

            const baseQty = convertToBaseUnit(inputQty, unit, allConversions);
            const currentHPP = item ? Number(item.hpp) || 0 : 0;
            const currentStock = item ? Number(item.stock) || 0 : 0;

            let mutationType = 'in';
            let newStock = currentStock;
            let newHPP = currentHPP;

            if (data.type === 'income' && data.sub_type === 'sale') {
              mutationType = 'out';
              newStock = currentStock - baseQty;
            } else if (data.type === 'expense' && data.sub_type === 'purchase') {
              mutationType = 'in';
              const pricePerBaseUnit = baseQty > 0 ? subtotal / baseQty : unitPrice;
              newHPP = calculateMovingAverageHPP(currentStock, currentHPP, baseQty, pricePerBaseUnit);
              newStock = currentStock + baseQty;
            }

            // Update item stock and HPP if item exists
            if (item) {
              await db.items.update(item.id, {
                stock: newStock,
                hpp: newHPP,
                updated_at: now.toISOString(),
              });
            }

            // Add transaction item
            await db.transaction_items.add({
              transaction_id: txId,
              item_id: item ? item.id : rawItemId,
              item_name: item ? item.name : itemData.item_name || 'Item',
              qty: inputQty,
              base_qty: baseQty,
              unit: unit,
              unit_price: unitPrice,
              subtotal: subtotal,
              cost_price: currentHPP,
              cogs: Math.round(baseQty * currentHPP),
              notes: itemData.notes || '',
            });

            // Add stock mutation
            if (item) {
              await db.stock_mutations.add({
                item_id: item.id,
                transaction_id: txId,
                type: mutationType,
                qty: baseQty,
                unit: item.base_unit || unit,
                previous_stock: currentStock,
                new_stock: newStock,
                date: txDate,
                notes: `Transaksi ${invoiceNumber}`,
              });
            }
          }
        }

        // Process account balance updates
        if (data.account_id) {
          const acc = await db.accounts.get(Number(data.account_id) || data.account_id);
          if (acc) {
            let balanceDelta = 0;
            if (data.type === 'income') {
              balanceDelta = paidAmount;
            } else if (data.type === 'expense') {
              balanceDelta = -paidAmount;
            } else if (data.type === 'transfer') {
              balanceDelta = -totalAmount;
            }

            await db.accounts.update(acc.id, {
              balance: (Number(acc.balance) || 0) + balanceDelta,
              updated_at: now.toISOString(),
            });
          }
        }

        if (data.type === 'transfer' && data.to_account_id) {
          const toAcc = await db.accounts.get(Number(data.to_account_id) || data.to_account_id);
          if (toAcc) {
            await db.accounts.update(toAcc.id, {
              balance: (Number(toAcc.balance) || 0) + totalAmount,
              updated_at: now.toISOString(),
            });
          }
        }

        // Add initial installment record if paid partially
        if (paidAmount > 0 && (paymentStatus === 'partial' || paymentStatus === 'credit')) {
          await db.installments.add({
            code: nanoid(10),
            transaction_id: txId,
            account_id: data.account_id || null,
            amount: paidAmount,
            date: txDate,
            notes: 'Pembayaran DP / Awal',
            created_at: now.toISOString(),
          });
        }

        // Audit log
        await db.audit_log.add({
          timestamp: now.toISOString(),
          action: 'create_transaction',
          entity_type: 'transaction',
          entity_id: txId,
          details: { invoice_number: invoiceNumber, total: totalAmount, type: data.type },
        });

        notifyDatabaseChange();
        return txId;
      }
    );
  }, []);

  /**
   * Voids a transaction and reverses stock mutations and account balance changes
   */
  const voidTransaction = useCallback(async (id, reason = '') => {
    return await db.transaction(
      'rw',
      [
        db.transactions,
        db.transaction_items,
        db.stock_mutations,
        db.items,
        db.accounts,
        db.installments,
        db.audit_log,
      ],
      async () => {
        const tx = await db.transactions.get(Number(id) || id);
        if (!tx) throw new Error('Transaksi tidak ditemukan');
        if (tx.status === 'void') throw new Error('Transaksi sudah dibatalkan sebelumnya');

        const now = new Date();
        const txItems = await db.transaction_items.where('transaction_id').equals(tx.id).toArray();

        // Reverse stock for items
        for (const lineItem of txItems) {
          if (!lineItem.item_id) continue;
          const item = await db.items.get(Number(lineItem.item_id) || lineItem.item_id);
          if (!item) continue;

          const baseQty = Number(lineItem.base_qty) || Number(lineItem.qty) || 0;
          const currentStock = Number(item.stock) || 0;
          let newStock = currentStock;

          if (tx.type === 'income' && tx.sub_type === 'sale') {
            // Put stock back
            newStock = currentStock + baseQty;
          } else if (tx.type === 'expense' && tx.sub_type === 'purchase') {
            // Take back purchased stock
            newStock = currentStock - baseQty;
          }

          await db.items.update(item.id, {
            stock: newStock,
            updated_at: now.toISOString(),
          });

          await db.stock_mutations.add({
            item_id: item.id,
            transaction_id: tx.id,
            type: 'void_reversal',
            qty: baseQty,
            unit: item.base_unit || lineItem.unit || 'unit',
            previous_stock: currentStock,
            new_stock: newStock,
            date: now.toISOString(),
            notes: `Pembatalan (Void) Faktur ${tx.invoice_number}: ${reason}`,
          });
        }

        // Reverse account balances
        const totalPaid = Number(tx.paid_amount) || 0;
        if (tx.account_id && totalPaid > 0) {
          const acc = await db.accounts.get(Number(tx.account_id) || tx.account_id);
          if (acc) {
            let balanceDelta = 0;
            if (tx.type === 'income') {
              balanceDelta = -totalPaid;
            } else if (tx.type === 'expense') {
              balanceDelta = totalPaid;
            }
            await db.accounts.update(acc.id, {
              balance: (Number(acc.balance) || 0) + balanceDelta,
              updated_at: now.toISOString(),
            });
          }
        }

        if (tx.type === 'transfer' && tx.account_id && tx.to_account_id) {
          const fromAcc = await db.accounts.get(Number(tx.account_id) || tx.account_id);
          const toAcc = await db.accounts.get(Number(tx.to_account_id) || tx.to_account_id);
          const amount = Number(tx.total_amount) || 0;

          if (fromAcc) {
            await db.accounts.update(fromAcc.id, {
              balance: (Number(fromAcc.balance) || 0) + amount,
              updated_at: now.toISOString(),
            });
          }
          if (toAcc) {
            await db.accounts.update(toAcc.id, {
              balance: (Number(toAcc.balance) || 0) - amount,
              updated_at: now.toISOString(),
            });
          }
        }

        // Mark transaction as void
        await db.transactions.update(tx.id, {
          status: 'void',
          void_reason: reason,
          voided_at: now.toISOString(),
          updated_at: now.toISOString(),
        });

        // Audit log
        await db.audit_log.add({
          timestamp: now.toISOString(),
          action: 'void_transaction',
          entity_type: 'transaction',
          entity_id: tx.id,
          details: { invoice_number: tx.invoice_number, reason },
        });

        notifyDatabaseChange();
        return true;
      }
    );
  }, []);

  /**
   * Adds an installment payment for credit / partial invoice
   */
  const addInstallment = useCallback(async (transactionId, data) => {
    return await db.transaction(
      'rw',
      [db.transactions, db.accounts, db.installments, db.audit_log],
      async () => {
        const tx = await db.transactions.get(Number(transactionId) || transactionId);
        if (!tx) throw new Error('Transaksi tidak ditemukan');
        if (tx.status === 'void') throw new Error('Tidak bisa membayar transaksi yang sudah dibatalkan');

        const now = new Date();
        const payDate = data.date ? new Date(data.date).toISOString() : now.toISOString();
        const amount = Math.round(Number(data.amount) || 0);
        if (amount <= 0) throw new Error('Nominal angsuran harus lebih dari 0');

        const accountId = data.account_id || tx.account_id;
        const currentPaid = Number(tx.paid_amount) || 0;
        const totalAmount = Number(tx.total_amount) || 0;
        const newPaid = currentPaid + amount;
        const newStatus = newPaid >= totalAmount ? 'paid' : 'partial';

        const installmentId = await db.installments.add({
          code: nanoid(10),
          transaction_id: tx.id,
          account_id: accountId,
          amount: amount,
          date: payDate,
          payment_method: data.payment_method || 'Kas',
          notes: data.notes || '',
          created_at: now.toISOString(),
        });

        // Update transaction
        await db.transactions.update(tx.id, {
          paid_amount: newPaid,
          payment_status: newStatus,
          updated_at: now.toISOString(),
        });

        // Update account balance
        if (accountId) {
          const acc = await db.accounts.get(Number(accountId) || accountId);
          if (acc) {
            const balanceDelta = tx.type === 'income' ? amount : -amount;
            await db.accounts.update(acc.id, {
              balance: (Number(acc.balance) || 0) + balanceDelta,
              updated_at: now.toISOString(),
            });
          }
        }

        // Audit log
        await db.audit_log.add({
          timestamp: now.toISOString(),
          action: 'add_installment',
          entity_type: 'installment',
          entity_id: installmentId,
          details: { transaction_id: tx.id, amount },
        });

        notifyDatabaseChange();
        return installmentId;
      }
    );
  }, []);

  /**
   * Filter transactions in memory or via index
   */
  const getTransactionsByFilter = useCallback(
    (filters = {}) => {
      if (!Array.isArray(transactions)) return [];
      return transactions.filter((tx) => {
        if (filters.status && tx.status !== filters.status) return false;
        if (filters.type && tx.type !== filters.type) return false;
        if (filters.sub_type && tx.sub_type !== filters.sub_type) return false;
        if (filters.contact_id && String(tx.contact_id) !== String(filters.contact_id)) return false;
        if (filters.account_id && String(tx.account_id) !== String(filters.account_id)) return false;
        if (filters.payment_status && tx.payment_status !== filters.payment_status) return false;

        if (filters.startDate) {
          const start = new Date(filters.startDate).getTime();
          const txTime = new Date(tx.date).getTime();
          if (txTime < start) return false;
        }

        if (filters.endDate) {
          const end = new Date(filters.endDate).getTime();
          const txTime = new Date(tx.date).getTime();
          if (txTime > end) return false;
        }

        return true;
      });
    },
    [transactions]
  );

  return {
    transactions,
    addTransaction,
    voidTransaction,
    addInstallment,
    getTransactionsByFilter,
  };
}

export default useTransactions;
