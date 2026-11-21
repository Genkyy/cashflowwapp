import Dexie from 'dexie';

export class BangAndiDatabase extends Dexie {
  constructor() {
    super('BangAndiDB');

    this.version(1).stores({
      accounts: '++id, name, type, is_active, created_at',
      commodities: '++id, name',
      items: '++id, commodity_id, name, is_livestock, is_perishable, is_active, [commodity_id+is_active]',
      unit_conversions: '++id, item_id, unit_name, [item_id+unit_name]',
      stock_batches: '++id, item_id, batch_number, expiry_date, status, [item_id+status], [item_id+expiry_date]',
      livestock_records: '++id, item_id, tag_number, status, birth_date, [item_id+status]',
      livestock_weights: '++id, livestock_id, date, [livestock_id+date]',
      livestock_health: '++id, livestock_id, date, diagnosis, status',
      contacts: '++id, name, phone, type, is_active',
      transactions: '++id, invoice_number, type, sub_type, contact_id, account_id, payment_status, date, status, [type+date], [status+date], [contact_id+payment_status]',
      transaction_items: '++id, transaction_id, item_id, [transaction_id+item_id]',
      installments: '++id, transaction_id, account_id, date, [transaction_id+date]',
      stock_mutations: '++id, item_id, transaction_id, type, date, [item_id+date]',
      photo_attachments: '++id, entity_type, entity_id, created_at, [entity_type+entity_id]',
      operational_notes: '++id, date, category',
      audit_log: '++id, timestamp, action, entity_type, entity_id',
      app_settings: '++id, &key',
    });
  }
}

export const db = new BangAndiDatabase();
export default db;
