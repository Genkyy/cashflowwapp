import { useCallback } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { db } from '../lib/db.js';
import { COMMODITIES } from '../constants/commodities.js';

export function useReports() {
  /**
   * Profit & Loss calculation (Laba Rugi) with per-commodity breakdown
   */
  const getProfitLoss = useCallback(async (startDate = null, endDate = null) => {
    let txQuery = db.transactions.where('status').notEqual('void');
    let transactions = await txQuery.toArray();

    if (startDate) {
      const startTime = new Date(startDate).getTime();
      transactions = transactions.filter((t) => new Date(t.date).getTime() >= startTime);
    }
    if (endDate) {
      const endTime = new Date(endDate).getTime();
      transactions = transactions.filter((t) => new Date(t.date).getTime() <= endTime);
    }

    const txIds = transactions.map((t) => t.id);
    const allTxItems = await db.transaction_items.where('transaction_id').anyOf(txIds).toArray();
    const allItems = await db.items.toArray();
    const itemMap = new Map(allItems.map((i) => [i.id, i]));

    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalOperationalExpenses = 0;
    const expensesByCategory = {};

    const commodityBreakdown = {};
    COMMODITIES.forEach((c) => {
      commodityBreakdown[c.id] = {
        id: c.id,
        name: c.name,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
      };
    });

    // Map tx items by transaction_id
    const itemsByTx = new Map();
    for (const line of allTxItems) {
      if (!itemsByTx.has(line.transaction_id)) {
        itemsByTx.set(line.transaction_id, []);
      }
      itemsByTx.get(line.transaction_id).push(line);
    }

    for (const tx of transactions) {
      if (tx.type === 'income') {
        const lines = itemsByTx.get(tx.id) || [];
        totalRevenue += Number(tx.total_amount) || 0;

        for (const line of lines) {
          const cogs = Number(line.cogs) || (Number(line.base_qty || line.qty) * Number(line.cost_price || 0));
          totalCOGS += cogs;

          const item = itemMap.get(line.item_id);
          if (item && item.commodity_id && commodityBreakdown[item.commodity_id]) {
            commodityBreakdown[item.commodity_id].revenue += Number(line.subtotal) || 0;
            commodityBreakdown[item.commodity_id].cogs += cogs;
          }
        }
      } else if (tx.type === 'expense' && tx.sub_type !== 'purchase') {
        const expenseAmount = Number(tx.total_amount) || 0;
        totalOperationalExpenses += expenseAmount;

        const cat = tx.category || 'Lainnya';
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expenseAmount;
      }
    }

    // Fetch Stock Depreciation & Shrinkage Mutations (Kerugian Rusak/Pecah/Susut)
    let stockMutations = await db.stock_mutations.where('type').equals('adjustment').toArray();
    if (startDate) {
      const startTime = new Date(startDate).getTime();
      stockMutations = stockMutations.filter((m) => new Date(m.date).getTime() >= startTime);
    }
    if (endDate) {
      const endTime = new Date(endDate).getTime();
      stockMutations = stockMutations.filter((m) => new Date(m.date).getTime() <= endTime);
    }

    let totalDepreciationLoss = 0;
    for (const mutation of stockMutations) {
      const prevStock = Number(mutation.previous_stock) || 0;
      const newStock = Number(mutation.new_stock) || 0;
      if (prevStock > newStock) {
        const item = itemMap.get(mutation.item_id);
        const itemHPP = item ? (Number(item.hpp) || 0) : 0;
        const lossQty = prevStock - newStock;
        totalDepreciationLoss += Math.round(lossQty * itemHPP);
      }
    }

    if (totalDepreciationLoss > 0) {
      totalOperationalExpenses += totalDepreciationLoss;
      expensesByCategory['Penyusutan & Kerusakan Stok'] = (expensesByCategory['Penyusutan & Kerusakan Stok'] || 0) + totalDepreciationLoss;
    }

    // Fetch Capital Rotations (Proyek Rotasi Modal CV Amanah Barokah)
    let rotQuery = db.capital_rotations ? await db.capital_rotations.toArray() : [];
    let completedRotations = rotQuery.filter((r) => r.status === 'done');
    let waitingRotations = rotQuery.filter((r) => r.status === 'waiting');

    if (startDate) {
      const startTime = new Date(startDate).getTime();
      completedRotations = completedRotations.filter((r) => {
        const d = new Date(r.completion_date || r.start_date || 0).getTime();
        return d >= startTime;
      });
    }
    if (endDate) {
      const endTime = new Date(endDate).getTime();
      completedRotations = completedRotations.filter((r) => {
        const d = new Date(r.completion_date || r.start_date || 0).getTime();
        return d <= endTime;
      });
    }

    const rotationGrossProfit = completedRotations.reduce((sum, r) => sum + (Number(r.profit_amount) || 0), 0);
    const rotationTotalCapital = completedRotations.reduce((sum, r) => sum + (Number(r.capital_amount) || 0), 0);
    const waitingModalTotal = waitingRotations.reduce((sum, r) => sum + (Number(r.capital_amount) || 0), 0);

    // Attribute rotation turnover to commodity breakdown and total turnover
    let rotationRevenue = 0;
    let rotationCOGS = 0;

    completedRotations.forEach((r) => {
      const cName = (r.commodity || '').toLowerCase();
      const matched = COMMODITIES.find((c) => cName.includes(c.name.toLowerCase()));
      const cap = Number(r.capital_amount) || 0;
      const prof = Number(r.profit_amount) || 0;
      const rev = cap + prof;

      rotationRevenue += rev;
      rotationCOGS += cap;

      if (matched && commodityBreakdown[matched.id]) {
        commodityBreakdown[matched.id].revenue += rev;
        commodityBreakdown[matched.id].cogs += cap;
        commodityBreakdown[matched.id].grossProfit += prof;
      }
    });

    // Synchronize Total Revenue and COGS (Retail + Rotation)
    const combinedTotalRevenue = totalRevenue + rotationRevenue;
    const combinedTotalCOGS = totalCOGS + rotationCOGS;

    // Finalize commodity net profit
    Object.values(commodityBreakdown).forEach((cb) => {
      if (!cb.grossProfit) {
        cb.grossProfit = cb.revenue - cb.cogs;
      }
      cb.netProfit = cb.grossProfit - cb.expenses;
    });

    // Laba Bruto Gabungan (Utama: Profit Rotasi Modal Cair + Laba Dagang Ritel)
    const retailGrossProfit = Math.max(0, totalRevenue - totalCOGS);
    const grossProfit = rotationGrossProfit > 0 ? (rotationGrossProfit + retailGrossProfit) : (totalRevenue - totalCOGS);
    const netProfit = grossProfit - totalOperationalExpenses;

    return {
      totalRevenue: combinedTotalRevenue,
      totalCOGS: combinedTotalCOGS,
      retailRevenue: totalRevenue,
      retailCOGS: totalCOGS,
      grossProfit, // Laba Bruto (Kotor)
      rotationGrossProfit, // Realisasi Profit Rotasi Modal
      rotationTotalCapital, // Total Modal Rotasi yang Sudah Cair
      waitingModalTotal, // Total Modal yang Masih Berjalan
      totalDepreciationLoss, // Kerugian Penyusutan & Kerusakan
      completedRotationsCount: completedRotations.length,
      waitingRotationsCount: waitingRotations.length,
      totalOperationalExpenses,
      netProfit, // Laba Netto (Bersih)
      expensesByCategory,
      commodityBreakdown: Object.values(commodityBreakdown),
      transactionCount: transactions.length,
    };
  }, []);

  /**
   * Cash Flow analysis per account or all accounts with exact installment & rotation dates
   */
  const getCashFlow = useCallback(async (startDate = null, endDate = null, accountId = null) => {
    const startTime = startDate ? new Date(startDate).getTime() : null;
    const endTime = endDate ? new Date(endDate).getTime() : null;
    const targetAccountId = accountId ? (Number(accountId) || accountId) : null;

    const allTx = await db.transactions.where('status').notEqual('void').toArray();
    const allInstallments = await db.installments.toArray();
    const allRotations = db.capital_rotations ? await db.capital_rotations.toArray() : [];

    const txMap = new Map(allTx.map((t) => [t.id, t]));
    const installmentsByTx = new Map();
    for (const inst of allInstallments) {
      if (!installmentsByTx.has(inst.transaction_id)) {
        installmentsByTx.set(inst.transaction_id, []);
      }
      installmentsByTx.get(inst.transaction_id).push(inst);
    }

    let cashIn = 0;
    let cashOut = 0;

    // 1. Process transactions
    for (const tx of allTx) {
      const instList = installmentsByTx.get(tx.id);

      if (tx.type === 'transfer') {
        const txTime = new Date(tx.date).getTime();
        const isInRange = (!startTime || txTime >= startTime) && (!endTime || txTime <= endTime);
        if (isInRange) {
          const amt = Number(tx.total_amount) || 0;
          if (targetAccountId) {
            if ((Number(tx.to_account_id) || tx.to_account_id) === targetAccountId) {
              cashIn += amt;
            }
            if ((Number(tx.account_id) || tx.account_id) === targetAccountId) {
              cashOut += amt;
            }
          }
        }
      } else if (instList && instList.length > 0) {
        // Has explicit installment payment records (DP + subsequent payments)
        for (const inst of instList) {
          const instTime = new Date(inst.date).getTime();
          const isInRange = (!startTime || instTime >= startTime) && (!endTime || instTime <= endTime);
          const isAccMatch = !targetAccountId || (Number(inst.account_id) || inst.account_id) === targetAccountId;

          if (isInRange && isAccMatch) {
            const amt = Number(inst.amount) || 0;
            if (tx.type === 'income') {
              cashIn += amt;
            } else if (tx.type === 'expense') {
              cashOut += amt;
            }
          }
        }
      } else {
        // Direct cash payment without separate installments
        const txTime = new Date(tx.date).getTime();
        const isInRange = (!startTime || txTime >= startTime) && (!endTime || txTime <= endTime);
        const isAccMatch = !targetAccountId || (Number(tx.account_id) || tx.account_id) === targetAccountId;

        if (isInRange && isAccMatch) {
          const paid = Number(tx.paid_amount) || 0;
          if (tx.type === 'income') {
            cashIn += paid;
          } else if (tx.type === 'expense') {
            cashOut += paid;
          }
        }
      }
    }

    // 2. Process Capital Rotations Cash Flows
    if (!targetAccountId) {
      for (const rot of allRotations) {
        if (rot.status === 'cancel') continue;

        // Cash out on project disbursement (Modal Keluar)
        const rotStartTime = new Date(rot.start_date || rot.created_at).getTime();
        const isStartInRange = (!startTime || rotStartTime >= startTime) && (!endTime || rotStartTime <= endTime);
        if (isStartInRange) {
          cashOut += Number(rot.capital_amount) || 0;
        }

        // Cash in on project completion (Modal Kembali + Profit Cair)
        if (rot.status === 'done' && rot.completion_date) {
          const rotDoneTime = new Date(rot.completion_date).getTime();
          const isDoneInRange = (!startTime || rotDoneTime >= startTime) && (!endTime || rotDoneTime <= endTime);
          if (isDoneInRange) {
            cashIn += (Number(rot.capital_amount) || 0) + (Number(rot.profit_amount) || 0);
          }
        }
      }
    }

    const netCashFlow = cashIn - cashOut;

    // Get current account balances
    let accounts = await db.accounts.toArray();
    if (targetAccountId) {
      accounts = accounts.filter((a) => (Number(a.id) || a.id) === targetAccountId);
    }
    const currentTotalBalance = accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);

    return {
      cashIn,
      cashOut,
      netCashFlow,
      closingBalance: currentTotalBalance,
      openingBalance: currentTotalBalance - netCashFlow,
      accounts,
    };
  }, []);

  /**
   * Outstanding Receivables (Piutang Usaha) with Aging analysis & Paid History
   */
  const getReceivables = useCallback(async () => {
    const allIncome = await db.transactions
      .where('status')
      .notEqual('void')
      .filter((t) => t.type === 'income')
      .toArray();

    const list = allIncome.filter((t) => t.payment_status !== 'paid');
    const paidList = allIncome.filter((t) => t.payment_status === 'paid');

    const contacts = await db.contacts.toArray();
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const now = new Date();

    let totalReceivable = 0;
    const aging = {
      current: 0, // 0-30 days
      days30: 0,  // 31-60 days
      days60: 0,  // 61-90 days
      days90Plus: 0, // > 90 days
    };

    const enrichedList = list.map((tx) => {
      const total = Number(tx.total_amount) || 0;
      const paid = Number(tx.paid_amount) || 0;
      const remaining = Math.max(0, total - paid);
      totalReceivable += remaining;

      const txDate = new Date(tx.date);
      const days = Math.max(0, differenceInCalendarDays(now, txDate));

      if (days <= 30) {
        aging.current += remaining;
      } else if (days <= 60) {
        aging.days30 += remaining;
      } else if (days <= 90) {
        aging.days60 += remaining;
      } else {
        aging.days90Plus += remaining;
      }

      const contact = tx.contact_id ? contactMap.get(tx.contact_id) : null;

      return {
        ...tx,
        remaining,
        daysOutstanding: days,
        contactName: contact ? contact.name : 'Umum',
        contactPhone: contact ? contact.phone : '',
      };
    });

    const enrichedPaidList = paidList.map((tx) => {
      const contact = tx.contact_id ? contactMap.get(tx.contact_id) : null;
      return {
        ...tx,
        remaining: 0,
        contactName: contact ? contact.name : 'Umum',
        contactPhone: contact ? contact.phone : '',
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      totalReceivable,
      aging,
      list: enrichedList.sort((a, b) => b.remaining - a.remaining),
      paidList: enrichedPaidList,
    };
  }, []);

  /**
   * Outstanding Payables (Utang Usaha) with Aging analysis & Paid History
   */
  const getPayables = useCallback(async () => {
    const allExpense = await db.transactions
      .where('status')
      .notEqual('void')
      .filter((t) => t.type === 'expense')
      .toArray();

    const list = allExpense.filter((t) => t.payment_status !== 'paid');
    const paidList = allExpense.filter((t) => t.payment_status === 'paid');

    const contacts = await db.contacts.toArray();
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const now = new Date();

    let totalPayable = 0;
    const aging = {
      current: 0,
      days30: 0,
      days60: 0,
      days90Plus: 0,
    };

    const enrichedList = list.map((tx) => {
      const total = Number(tx.total_amount) || 0;
      const paid = Number(tx.paid_amount) || 0;
      const remaining = Math.max(0, total - paid);
      totalPayable += remaining;

      const txDate = new Date(tx.date);
      const days = Math.max(0, differenceInCalendarDays(now, txDate));

      if (days <= 30) {
        aging.current += remaining;
      } else if (days <= 60) {
        aging.days30 += remaining;
      } else if (days <= 90) {
        aging.days60 += remaining;
      } else {
        aging.days90Plus += remaining;
      }

      const contact = tx.contact_id ? contactMap.get(tx.contact_id) : null;

      return {
        ...tx,
        remaining,
        daysOutstanding: days,
        contactName: contact ? contact.name : 'Supplier',
        contactPhone: contact ? contact.phone : '',
      };
    });

    const enrichedPaidList = paidList.map((tx) => {
      const contact = tx.contact_id ? contactMap.get(tx.contact_id) : null;
      return {
        ...tx,
        remaining: 0,
        contactName: contact ? contact.name : 'Supplier',
        contactPhone: contact ? contact.phone : '',
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      totalPayable,
      aging,
      list: enrichedList.sort((a, b) => b.remaining - a.remaining),
      paidList: enrichedPaidList,
    };
  }, []);

  /**
   * Stock Valuation (Current stock × HPP per item)
   */
  const getStockValuation = useCallback(async () => {
    const items = await db.items.toArray();
    const commodities = await db.commodities.toArray();
    const comMap = new Map(commodities.map((c) => [c.id, c.name]));

    let totalValuation = 0;
    let totalItems = 0;
    const byCommodity = {};

    const enrichedItems = items.map((item) => {
      const stock = Number(item.stock) || 0;
      const hpp = Number(item.hpp) || 0;
      const valuation = Math.round(stock * hpp);

      totalValuation += valuation;
      totalItems += stock;

      const comName = item.commodity_id ? (comMap.get(item.commodity_id) || 'Lainnya') : 'Lainnya';
      byCommodity[comName] = (byCommodity[comName] || 0) + valuation;

      return {
        ...item,
        valuation,
        commodityName: comName,
      };
    });

    return {
      totalValuation,
      totalItems,
      items: enrichedItems,
      byCommodity,
    };
  }, []);

  /**
   * Get all active alerts: low stock, expiring batches, due invoices
   */
  const getAlerts = useCallback(async () => {
    const allItems = await db.items.toArray();
    const allBatches = await db.stock_batches.toArray();
    const transactions = await db.transactions.where('status').notEqual('void').toArray();
    const now = new Date();

    const lowStock = allItems.filter((i) => Number(i.stock) <= (Number(i.min_stock) || 0));

    const expiringBatches = allBatches.filter((b) => {
      if (b.status !== 'active' || !b.expiry_date) return false;
      const diff = differenceInCalendarDays(new Date(b.expiry_date), now);
      return diff <= 14; // Alert within 14 days
    });

    const dueInvoices = transactions.filter((t) => {
      if (t.payment_status === 'paid' || !t.due_date) return false;
      const diff = differenceInCalendarDays(new Date(t.due_date), now);
      return diff <= 3; // Due within 3 days or overdue
    });

    return {
      lowStock,
      expiringBatches,
      dueInvoices,
      count: lowStock.length + expiringBatches.length + dueInvoices.length,
    };
  }, []);

  return {
    getProfitLoss,
    getCashFlow,
    getReceivables,
    getPayables,
    getStockValuation,
    getAlerts,
  };
}

export default useReports;
