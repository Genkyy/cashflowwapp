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

    // Finalize commodity net profit
    Object.values(commodityBreakdown).forEach((cb) => {
      cb.grossProfit = cb.revenue - cb.cogs;
      cb.netProfit = cb.grossProfit - cb.expenses;
    });

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalOperationalExpenses;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalOperationalExpenses,
      netProfit,
      expensesByCategory,
      commodityBreakdown: Object.values(commodityBreakdown),
      transactionCount: transactions.length,
    };
  }, []);

  /**
   * Cash Flow analysis per account or all accounts
   */
  const getCashFlow = useCallback(async (startDate = null, endDate = null, accountId = null) => {
    let transactions = await db.transactions.where('status').notEqual('void').toArray();

    if (startDate) {
      const startTime = new Date(startDate).getTime();
      transactions = transactions.filter((t) => new Date(t.date).getTime() >= startTime);
    }
    if (endDate) {
      const endTime = new Date(endDate).getTime();
      transactions = transactions.filter((t) => new Date(t.date).getTime() <= endTime);
    }

    if (accountId) {
      const targetId = Number(accountId) || accountId;
      transactions = transactions.filter(
        (t) =>
          Number(t.account_id) === targetId ||
          Number(t.to_account_id) === targetId
      );
    }

    let cashIn = 0;
    let cashOut = 0;

    for (const tx of transactions) {
      const paid = Number(tx.paid_amount) || 0;
      if (tx.type === 'income') {
        cashIn += paid;
      } else if (tx.type === 'expense') {
        cashOut += paid;
      } else if (tx.type === 'transfer') {
        const transferAmt = Number(tx.total_amount) || 0;
        if (accountId) {
          if (Number(tx.to_account_id) === (Number(accountId) || accountId)) {
            cashIn += transferAmt;
          }
          if (Number(tx.account_id) === (Number(accountId) || accountId)) {
            cashOut += transferAmt;
          }
        }
      }
    }

    // Add standalone installments not yet counted in paid_amount
    // (Note: in our architecture, paid_amount already reflects initial payment, but any extra installments are recorded)
    const netCashFlow = cashIn - cashOut;

    // Get current account balances
    let accounts = await db.accounts.toArray();
    if (accountId) {
      accounts = accounts.filter((a) => a.id === (Number(accountId) || accountId));
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
   * Outstanding Receivables (Piutang Usaha) with Aging analysis
   */
  const getReceivables = useCallback(async () => {
    const list = await db.transactions
      .where('status')
      .notEqual('void')
      .filter((t) => t.type === 'income' && t.payment_status !== 'paid')
      .toArray();

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

    return {
      totalReceivable,
      aging,
      list: enrichedList.sort((a, b) => b.remaining - a.remaining),
    };
  }, []);

  /**
   * Outstanding Payables (Utang Usaha) with Aging analysis
   */
  const getPayables = useCallback(async () => {
    const list = await db.transactions
      .where('status')
      .notEqual('void')
      .filter((t) => t.type === 'expense' && t.payment_status !== 'paid')
      .toArray();

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

    return {
      totalPayable,
      aging,
      list: enrichedList.sort((a, b) => b.remaining - a.remaining),
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
