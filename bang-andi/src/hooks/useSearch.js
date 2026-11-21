import { useCallback } from 'react';
import { db } from '../lib/db.js';

export function useSearch() {
  /**
   * Performs universal search across transactions, items, and contacts
   * @param {string} query
   * @returns {Promise<{transactions: Array, items: Array, contacts: Array}>}
   */
  const search = useCallback(async (query) => {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return { transactions: [], items: [], contacts: [] };
    }

    const q = query.trim().toLowerCase();

    // Search items
    const allItems = await db.items.toArray();
    const matchedItems = allItems.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const code = (item.code || '').toLowerCase();
      const unit = (item.base_unit || '').toLowerCase();
      return name.includes(q) || code.includes(q) || unit.includes(q);
    });

    // Search contacts
    const allContacts = await db.contacts.toArray();
    const matchedContacts = allContacts.filter((contact) => {
      const name = (contact.name || '').toLowerCase();
      const phone = (contact.phone || '').toLowerCase();
      const notes = (contact.notes || '').toLowerCase();
      const type = (contact.type || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || notes.includes(q) || type.includes(q);
    });

    // Search transactions
    const allTx = await db.transactions.toArray();
    const matchedTx = allTx.filter((tx) => {
      const inv = (tx.invoice_number || '').toLowerCase();
      const notes = (tx.notes || '').toLowerCase();
      const cat = (tx.category || '').toLowerCase();
      const sub = (tx.sub_type || '').toLowerCase();
      return inv.includes(q) || notes.includes(q) || cat.includes(q) || sub.includes(q);
    });

    return {
      transactions: matchedTx,
      items: matchedItems,
      contacts: matchedContacts,
    };
  }, []);

  return {
    search,
  };
}

export default useSearch;
