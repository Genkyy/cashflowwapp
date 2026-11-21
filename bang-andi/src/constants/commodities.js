export const COMMODITIES = [
  { id: 'com-01', name: 'Minyak', icon: 'Droplets', color: '#F59E0B' },
  { id: 'com-02', name: 'Telur', icon: 'Egg', color: '#EAB308' },
  { id: 'com-03', name: 'Sapi', icon: 'Beef', color: '#DC2626' },
  { id: 'com-04', name: 'Domba', icon: 'Bug', color: '#7C3AED' },
  { id: 'com-05', name: 'Susu', icon: 'Milk', color: '#3B82F6' },
];

export const EXPENSE_CATEGORIES = [
  'Pakan',
  'Vaksin & Obat',
  'Transport',
  'Sewa',
  'Listrik & Air',
  'Gaji Karyawan',
  'Perawatan',
  'Lainnya',
];

export const ADJUSTMENT_REASONS = [
  'Rusak / Pecah',
  'Kadaluwarsa / Basi',
  'Susut Bobot / Volume',
  'Selisih Opname',
];

export const PAYMENT_STATUSES = {
  PAID: 'paid',
  PARTIAL: 'partial',
  CREDIT: 'credit',
};

export const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: 'transfer',
};

export const TRANSACTION_SUB_TYPES = {
  SALE: 'sale',
  PURCHASE: 'purchase',
  OPERATIONAL: 'operational',
  RETURN_SALE: 'return_sale',
  RETURN_PURCHASE: 'return_purchase',
  OTHER_INCOME: 'other_income',
  OTHER_EXPENSE: 'other_expense',
  TRANSFER: 'transfer',
};

export const STOCK_MUTATION_TYPES = {
  IN: 'in',
  OUT: 'out',
  ADJUSTMENT: 'adjustment',
  VOID_REVERSAL: 'void_reversal',
};
