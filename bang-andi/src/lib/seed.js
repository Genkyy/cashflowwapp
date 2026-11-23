import { db } from './db.js';
import { COMMODITIES } from '../constants/commodities.js';
import { notifyDatabaseChange } from '../hooks/useLiveQuery.js';

let isSeeding = false;
let seedPromise = null;

/**
 * Standard master catalog items - Empty for production data
 */
export const STANDARD_ITEMS = [];

/**
 * Initializes clean real baseline if the database is empty:
 * - 1 single primary cash account: "Kas Utama" (balance: 0)
 * - Standard commodities categories
 * - 0 dummy products/items
 * - 0 dummy transactions, 0 dummy rotations, 0 dummy contacts
 */
export async function seedDatabase(force = false) {
  if (seedPromise && !force) {
    return seedPromise;
  }
  if (isSeeding && !force) {
    return false;
  }

  isSeeding = true;
  seedPromise = (async () => {
    try {
      const [accCount, comCount] = await Promise.all([
        db.accounts.count(),
        db.commodities.count(),
      ]);

      if (accCount > 0 && comCount > 0 && !force) {
        return false;
      }

      const now = new Date().toISOString();

      // 1. Ensure exactly 1 primary account with balance 0
      if (accCount === 0 || force) {
        if (force) {
          await db.accounts.clear();
        }
        await db.accounts.add({
          code: 'ACC-KAS',
          name: 'Kas Utama',
          type: 'cash',
          account_number: '',
          balance: 0,
          is_active: 1,
          created_at: now,
          updated_at: now,
        });
      }

      // 2. Ensure standard commodities categories exist
      const comIdMap = {};
      if (comCount === 0 || force) {
        if (force) {
          await db.commodities.clear();
        }
        for (const c of COMMODITIES) {
          const id = await db.commodities.add({
            id_str: c.id,
            name: c.name,
            icon: c.icon,
            color: c.color,
            created_at: now,
          });
          comIdMap[c.name] = id;
        }
      }

      // 3. Ensure master items exist (if any defined)
      if (STANDARD_ITEMS.length > 0) {
        const itemsCount = await db.items.count();
        if (itemsCount === 0 || force) {
          if (force) {
            await db.items.clear();
          }
          for (const std of STANDARD_ITEMS) {
            const comId = comIdMap[std.commodity_name] || null;
            await db.items.add({
              code: std.code,
              commodity_id: comId,
              name: std.name,
              base_unit: std.base_unit,
              stock: 0,
              hpp: 0,
              selling_price: 0,
              min_stock: 0,
              is_perishable: std.is_perishable,
              is_livestock: std.is_livestock,
              is_active: 1,
              created_at: now,
              updated_at: now,
            });
          }
        }
      }

      notifyDatabaseChange();
      return true;
    } catch (err) {
      console.error('Error in seedDatabase:', err);
      return false;
    } finally {
      isSeeding = false;
      seedPromise = null;
    }
  })();

  return seedPromise;
}

/**
 * Standard catalog sync helper (production ready, no dummy items inserted)
 */
export async function syncStandardCatalog() {
  return true;
}

/**
 * Complete Database Reset to Real Mode
 * Purges ALL dummy transactions, items, mutations, rotations, notes, contacts, and extra accounts.
 * Resets 1 single account 'Kas Utama' with balance 0 and 0 dummy products.
 */
export async function resetDatabaseToReal() {
  try {
    const now = new Date().toISOString();

    // 1. Clear all transactional & dummy tables
    await db.transactions.clear();
    await db.transaction_items.clear();
    await db.stock_mutations.clear();
    await db.items.clear();
    if (db.capital_rotations) await db.capital_rotations.clear();
    if (db.operational_notes) await db.operational_notes.clear();
    if (db.contacts) await db.contacts.clear();
    if (db.installments) await db.installments.clear();
    if (db.audit_log) await db.audit_log.clear();
    if (db.stock_batches) await db.stock_batches.clear();
    if (db.unit_conversions) await db.unit_conversions.clear();
    if (db.livestock_records) await db.livestock_records.clear();
    if (db.livestock_weights) await db.livestock_weights.clear();
    if (db.livestock_health) await db.livestock_health.clear();
    if (db.photo_attachments) await db.photo_attachments.clear();

    // 2. Reset Accounts to exactly 1 single Kas Utama account (balance: 0)
    await db.accounts.clear();
    await db.accounts.add({
      code: 'ACC-KAS',
      name: 'Kas Utama',
      type: 'cash',
      account_number: '',
      balance: 0,
      is_active: 1,
      created_at: now,
      updated_at: now,
    });

    // 3. Reset Commodities categories
    await db.commodities.clear();
    for (const c of COMMODITIES) {
      await db.commodities.add({
        id_str: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        created_at: now,
      });
    }

    notifyDatabaseChange();
    return true;
  } catch (err) {
    console.error('Error resetDatabaseToReal:', err);
    throw err;
  }
}

export default seedDatabase;
