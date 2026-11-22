import { db } from './db.js';
import { COMMODITIES } from '../constants/commodities.js';
import { notifyDatabaseChange } from '../hooks/useLiveQuery.js';

let isSeeding = false;
let seedPromise = null;

/**
 * Standard master catalog items for CV Amanah Barokah
 * All initialized with 0 stock, ready for real business testing
 */
export const STANDARD_ITEMS = [
  {
    name: 'Minyak Sunco',
    code: 'ITM-MYK-SNC',
    commodity_name: 'Minyak',
    base_unit: 'kerdus',
    stock: 0,
    hpp: 0,
    selling_price: 0,
    min_stock: 0,
    is_perishable: 0,
    is_livestock: 0,
  },
  {
    name: 'Minyak Kita',
    code: 'ITM-MYK-KTA',
    commodity_name: 'Minyak',
    base_unit: 'kerdus',
    stock: 0,
    hpp: 0,
    selling_price: 0,
    min_stock: 0,
    is_perishable: 0,
    is_livestock: 0,
  },
  {
    name: 'Telur',
    code: 'ITM-TLR-01',
    commodity_name: 'Telur',
    base_unit: 'paket',
    stock: 0,
    hpp: 0,
    selling_price: 0,
    min_stock: 0,
    is_perishable: 1,
    is_livestock: 0,
  },
  {
    name: 'Susu UHT',
    code: 'ITM-SSU-01',
    commodity_name: 'Susu UHT',
    base_unit: 'paket',
    stock: 0,
    hpp: 0,
    selling_price: 0,
    min_stock: 0,
    is_perishable: 1,
    is_livestock: 0,
  },
  {
    name: 'Ikan Nila',
    code: 'ITM-NLA-01',
    commodity_name: 'Ikan Nila',
    base_unit: 'paket',
    stock: 0,
    hpp: 0,
    selling_price: 0,
    min_stock: 0,
    is_perishable: 1,
    is_livestock: 0,
  },
  {
    name: 'Domba',
    code: 'ITM-DMB-01',
    commodity_name: 'Domba',
    base_unit: 'paket',
    stock: 0,
    hpp: 0,
    selling_price: 0,
    min_stock: 0,
    is_perishable: 0,
    is_livestock: 1,
  },
  {
    name: 'Sapi',
    code: 'ITM-SPI-01',
    commodity_name: 'Sapi',
    base_unit: 'paket',
    stock: 0,
    hpp: 0,
    selling_price: 0,
    min_stock: 0,
    is_perishable: 0,
    is_livestock: 1,
  },
];

/**
 * Initializes clean real baseline if the database is empty:
 * - 1 single primary cash account: "Kas Utama" (balance: 0)
 * - Standard commodities
 * - Standard catalog items with stock = 0
 * - NO dummy transactions, NO dummy rotations, NO dummy contacts
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

      // 1. Ensure exactly 1 primary account
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

      // 2. Ensure standard commodities exist
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
      } else {
        const allComs = await db.commodities.toArray();
        allComs.forEach((c) => {
          comIdMap[c.name] = c.id;
        });
      }

      // 3. Ensure master items exist with stock = 0
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
 * Standard catalog sync helper
 */
export async function syncStandardCatalog() {
  try {
    const itemsCount = await db.items.count();
    if (itemsCount === 0) {
      await seedDatabase(true);
    }
    return true;
  } catch (err) {
    console.warn('syncStandardCatalog warning:', err);
    return false;
  }
}

/**
 * Complete Database Reset to Real Mode
 * Purges ALL dummy transactions, mutations, rotations, notes, contacts, and extra accounts.
 * Resets 1 single account 'Kas Utama' with balance 0 and sets catalog stock to 0.
 */
export async function resetDatabaseToReal() {
  try {
    const now = new Date().toISOString();

    // 1. Clear all transactional & dummy tables
    await db.transactions.clear();
    await db.transaction_items.clear();
    await db.stock_mutations.clear();
    if (db.capital_rotations) await db.capital_rotations.clear();
    if (db.operational_notes) await db.operational_notes.clear();
    if (db.contacts) await db.contacts.clear();
    if (db.installments) await db.installments.clear();
    if (db.audit_log) await db.audit_log.clear();
    if (db.stock_batches) await db.stock_batches.clear();
    if (db.unit_conversions) await db.unit_conversions.clear();

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

    // 3. Reset Commodities
    await db.commodities.clear();
    const comIdMap = {};
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

    // 4. Reset Items to 0 stock
    await db.items.clear();
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

    notifyDatabaseChange();
    return true;
  } catch (err) {
    console.error('Error resetDatabaseToReal:', err);
    throw err;
  }
}

export default seedDatabase;
