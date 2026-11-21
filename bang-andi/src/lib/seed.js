import { nanoid } from 'nanoid';
import { subDays, addDays } from 'date-fns';
import { db } from './db.js';
import { COMMODITIES } from '../constants/commodities.js';

let isSeeding = false;
let seedPromise = null;

/**
 * Seeds the Dexie database with realistic commodity management data
 * if the database is currently empty.
 * Guarded against React StrictMode concurrent execution to prevent duplicate records.
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
      const [existingCommodities, existingTransactions] = await Promise.all([
        db.commodities.count(),
        db.transactions.count()
      ]);

      if ((existingCommodities > 0 || existingTransactions > 0) && !force) {
        return false;
      }

      if (force) {
        await db.delete();
        await db.open();
      }

  const now = new Date();
  const dateT1 = subDays(now, 5); // 15 Nov
  const dateT2 = subDays(now, 4); // 16 Nov
  const dateT3 = subDays(now, 3); // 17 Nov
  const dateT4 = subDays(now, 2); // 18 Nov
  const dateT5 = subDays(now, 2); // 18 Nov
  const dateT6 = now;            // 20 Nov
  const dueT2  = addDays(now, 10); // 30 Nov

  // 1. Seed Accounts
  const kasTunaiId = await db.accounts.add({
    code: 'ACC-KAS',
    name: 'Kas Tunai',
    type: 'cash',
    balance: 13960000, // Starting 15M + 960k (T1) + 300k (T2) - 2.5M (T4) + 200k (T6)
    is_active: 1,
    created_at: subDays(now, 30).toISOString(),
    updated_at: now.toISOString(),
  });

  const bcaId = await db.accounts.add({
    code: 'ACC-BCA',
    name: 'Bank BCA',
    type: 'bank',
    balance: 47825000, // Starting 50M - 2.175M (T3)
    is_active: 1,
    created_at: subDays(now, 30).toISOString(),
    updated_at: now.toISOString(),
  });

  // 2. Seed Commodities
  const commodityIdMap = {};
  for (const c of COMMODITIES) {
    const id = await db.commodities.add({
      id_str: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      created_at: now.toISOString(),
    });
    commodityIdMap[c.name] = id;
  }

  // 3. Seed Items
  const minyakId = await db.items.add({
    code: 'ITM-MYK-01',
    commodity_id: commodityIdMap['Minyak'],
    name: 'Minyak Goreng Curah',
    base_unit: 'liter',
    stock: 160, // 200 initial - 40 sold (T2)
    hpp: 14000,
    selling_price: 16000,
    min_stock: 50,
    is_perishable: 0,
    is_livestock: 0,
    is_active: 1,
    created_at: subDays(now, 30).toISOString(),
    updated_at: now.toISOString(),
  });

  const telurId = await db.items.add({
    code: 'ITM-TLR-01',
    commodity_id: commodityIdMap['Telur'],
    name: 'Telur Ayam Ras',
    base_unit: 'kg',
    stock: 340, // 300 initial - 30 sold (T1) + 75 bought (T3) - 5 broken (T5)
    hpp: 28217, // moving average after T3 purchase
    selling_price: 32000,
    min_stock: 50,
    is_perishable: 1,
    is_livestock: 0,
    is_active: 1,
    created_at: subDays(now, 30).toISOString(),
    updated_at: now.toISOString(),
  });

  const susuId = await db.items.add({
    code: 'ITM-SSU-01',
    commodity_id: commodityIdMap['Susu'],
    name: 'Susu Sapi Segar',
    base_unit: 'liter',
    stock: 80,
    hpp: 10000,
    selling_price: 15000,
    min_stock: 20,
    is_perishable: 1,
    is_livestock: 0,
    is_active: 1,
    created_at: subDays(now, 20).toISOString(),
    updated_at: now.toISOString(),
  });

  const sapiId = await db.items.add({
    code: 'ITM-SPI-01',
    commodity_id: commodityIdMap['Sapi'],
    name: 'Sapi Limousin',
    base_unit: 'ekor',
    stock: 5,
    hpp: 18000000,
    selling_price: 22000000,
    min_stock: 1,
    is_perishable: 0,
    is_livestock: 1,
    is_active: 1,
    created_at: subDays(now, 60).toISOString(),
    updated_at: now.toISOString(),
  });

  const dombaId = await db.items.add({
    code: 'ITM-DMB-01',
    commodity_id: commodityIdMap['Domba'],
    name: 'Domba Garut',
    base_unit: 'ekor',
    stock: 12,
    hpp: 3500000,
    selling_price: 4500000,
    min_stock: 2,
    is_perishable: 0,
    is_livestock: 1,
    is_active: 1,
    created_at: subDays(now, 60).toISOString(),
    updated_at: now.toISOString(),
  });

  // 4. Seed Unit Conversions
  // Minyak: 1 Jeriken = 20 liter
  await db.unit_conversions.add({
    item_id: minyakId,
    unit_name: 'Jeriken',
    factor: 20,
    label: '1 Jeriken = 20 liter',
  });

  // Telur: 1 Peti = 15 kg, 1 Tray = 1.8 kg
  await db.unit_conversions.add({
    item_id: telurId,
    unit_name: 'Peti',
    factor: 15,
    label: '1 Peti = 15 kg',
  });
  await db.unit_conversions.add({
    item_id: telurId,
    unit_name: 'Tray',
    factor: 1.8,
    label: '1 Tray = 1.8 kg',
  });

  // 5. Seed Contacts
  const sitiId = await db.contacts.add({
    name: 'Bu Siti',
    phone: '081234567801',
    type: 'customer',
    address: 'Pasar Baru Blok A No. 12',
    notes: 'Langganan minyak goreng curah & sembako',
    is_active: 1,
    created_at: subDays(now, 20).toISOString(),
  });

  const jokoId = await db.contacts.add({
    name: 'Pak Joko',
    phone: '081234567802',
    type: 'customer',
    address: 'Jl. Merdeka No. 45',
    notes: 'Restoran Warung Sunda, order rutin telur',
    is_active: 1,
    created_at: subDays(now, 20).toISOString(),
  });

  const mansurId = await db.contacts.add({
    name: 'Haji Mansur',
    phone: '081398765431',
    type: 'supplier',
    address: 'Kandang Besar Subang',
    notes: 'Pemasok bibit sapi limousin dan pakan konsentrat',
    is_active: 1,
    created_at: subDays(now, 30).toISOString(),
  });

  await db.contacts.add({
    name: 'PT Sinar Pangan',
    phone: '082187654321',
    type: 'supplier',
    address: 'Kawasan Industri Cikarang',
    notes: 'Distributor utama minyak curah tangki',
    is_active: 1,
    created_at: subDays(now, 40).toISOString(),
  });

  const makmurId = await db.contacts.add({
    name: 'Toko Makmur',
    phone: '085211223344',
    type: 'customer',
    address: 'Pasar Induk Kramat Jati',
    notes: 'Agen telur eceran & grosir',
    is_active: 1,
    created_at: subDays(now, 15).toISOString(),
  });

  // 6. Seed Livestock Records & Weights
  // Sapi Limousin (LMS-001 to LMS-005)
  const sapiWeights = [520, 485, 540, 510, 495];
  for (let i = 1; i <= 5; i++) {
    const tag = `LMS-${String(i).padStart(3, '0')}`;
    const weight = sapiWeights[i - 1];
    const recId = await db.livestock_records.add({
      code: nanoid(8),
      item_id: sapiId,
      tag_number: tag,
      status: 'active',
      birth_date: subDays(now, 500 + i * 20).toISOString(),
      gender: i % 2 === 0 ? 'betina' : 'jantan',
      current_weight: weight,
      notes: `Sapi Limousin pejantan/indukan unggul ${tag}`,
      created_at: subDays(now, 60).toISOString(),
    });

    await db.livestock_weights.add({
      livestock_id: recId,
      weight: weight - 15,
      date: subDays(now, 30).toISOString(),
      notes: 'Timbang awal bulan lalu',
    });
    await db.livestock_weights.add({
      livestock_id: recId,
      weight: weight,
      date: subDays(now, 5).toISOString(),
      notes: 'Timbang rutin terkini',
    });
  }

  // Domba Garut (DG-001 to DG-012)
  for (let i = 1; i <= 12; i++) {
    const tag = `DG-${String(i).padStart(3, '0')}`;
    const weight = 35 + (i * 1.5);
    const recId = await db.livestock_records.add({
      code: nanoid(8),
      item_id: dombaId,
      tag_number: tag,
      status: 'active',
      birth_date: subDays(now, 250 + i * 10).toISOString(),
      gender: i % 3 === 0 ? 'betina' : 'jantan',
      current_weight: weight,
      notes: `Domba Garut sehat bertanduk ${tag}`,
      created_at: subDays(now, 45).toISOString(),
    });

    await db.livestock_weights.add({
      livestock_id: recId,
      weight: weight,
      date: subDays(now, 7).toISOString(),
      notes: 'Penimbangan mingguan',
    });
  }

  // 7. Seed Stock Batches for Perishable Items (Susu with near expiry)
  await db.stock_batches.add({
    code: nanoid(10),
    item_id: susuId,
    batch_number: 'BATCH-SSU-001',
    initial_qty: 80,
    current_qty: 80,
    unit: 'liter',
    expiry_date: addDays(now, 2).toISOString(), // Expiring in 2 days (near expiry alert!)
    status: 'active',
    created_at: subDays(now, 2).toISOString(),
  });

  await db.stock_batches.add({
    code: nanoid(10),
    item_id: telurId,
    batch_number: 'BATCH-TLR-001',
    initial_qty: 300,
    current_qty: 340,
    unit: 'kg',
    expiry_date: addDays(now, 18).toISOString(),
    status: 'active',
    created_at: subDays(now, 5).toISOString(),
  });

  // 8. Sample Transactions & Correlated Items & Mutations

  // --- T1: Sale Telur 2 Peti (30kg) @32000, Lunas, Kas, 15 Nov 2026 ---
  const t1Id = await db.transactions.add({
    code: 'TX-001',
    invoice_number: 'INV-20261115-0001',
    type: 'income',
    sub_type: 'sale',
    contact_id: jokoId,
    account_id: kasTunaiId,
    payment_status: 'paid',
    status: 'completed',
    total_amount: 960000, // 30kg * 32000
    paid_amount: 960000,
    date: dateT1.toISOString(),
    due_date: null,
    notes: 'Penjualan telur ayam untuk Warung Sunda Pak Joko',
    created_at: dateT1.toISOString(),
    updated_at: dateT1.toISOString(),
  });

  await db.transaction_items.add({
    transaction_id: t1Id,
    item_id: telurId,
    item_name: 'Telur Ayam Ras',
    qty: 2,
    base_qty: 30,
    unit: 'Peti',
    unit_price: 32000,
    subtotal: 960000,
    cost_price: 28000,
    cogs: 30 * 28000, // 840.000
    notes: '2 Peti = 30 kg',
  });

  await db.stock_mutations.add({
    code: nanoid(10),
    item_id: telurId,
    transaction_id: t1Id,
    type: 'out',
    qty: 30,
    unit: 'kg',
    previous_stock: 300,
    new_stock: 270,
    date: dateT1.toISOString(),
    notes: 'Penjualan Faktur INV-20261115-0001',
  });

  // --- T2: Sale Minyak 2 Jeriken (40L) @16000, Tempo DP 300000 sisa 340000, due 30 Nov, Kas, Bu Siti, 16 Nov 2026 ---
  const t2Id = await db.transactions.add({
    code: 'TX-002',
    invoice_number: 'INV-20261116-0002',
    type: 'income',
    sub_type: 'sale',
    contact_id: sitiId,
    account_id: kasTunaiId,
    payment_status: 'partial',
    status: 'completed',
    total_amount: 640000, // 40L * 16000
    paid_amount: 500000,  // DP 300k + angsuran 200k (T6)
    date: dateT2.toISOString(),
    due_date: dueT2.toISOString(),
    notes: 'Penjualan minyak curah Bu Siti tempo jatuh tempo akhir bulan',
    created_at: dateT2.toISOString(),
    updated_at: dateT6.toISOString(),
  });

  await db.transaction_items.add({
    transaction_id: t2Id,
    item_id: minyakId,
    item_name: 'Minyak Goreng Curah',
    qty: 2,
    base_qty: 40,
    unit: 'Jeriken',
    unit_price: 16000,
    subtotal: 640000,
    cost_price: 14000,
    cogs: 40 * 14000, // 560.000
    notes: '2 Jeriken = 40 liter',
  });

  await db.stock_mutations.add({
    code: nanoid(10),
    item_id: minyakId,
    transaction_id: t2Id,
    type: 'out',
    qty: 40,
    unit: 'liter',
    previous_stock: 200,
    new_stock: 160,
    date: dateT2.toISOString(),
    notes: 'Penjualan Faktur INV-20261116-0002',
  });

  // DP installment for T2
  await db.installments.add({
    code: nanoid(10),
    transaction_id: t2Id,
    account_id: kasTunaiId,
    amount: 300000,
    date: dateT2.toISOString(),
    notes: 'Uang muka (DP) penjualan minyak',
    created_at: dateT2.toISOString(),
  });

  // --- T3: Purchase Telur 5 Peti (75kg) @29000, Lunas, BCA, 17 Nov 2026 (updates HPP) ---
  const t3Id = await db.transactions.add({
    code: 'TX-003',
    invoice_number: 'INV-20261117-0003',
    type: 'expense',
    sub_type: 'purchase',
    contact_id: makmurId,
    account_id: bcaId,
    payment_status: 'paid',
    status: 'completed',
    total_amount: 2175000, // 75kg * 29000
    paid_amount: 2175000,
    date: dateT3.toISOString(),
    due_date: null,
    notes: 'Kulakan telur ayam ras dari peternak 5 peti',
    created_at: dateT3.toISOString(),
    updated_at: dateT3.toISOString(),
  });

  await db.transaction_items.add({
    transaction_id: t3Id,
    item_id: telurId,
    item_name: 'Telur Ayam Ras',
    qty: 5,
    base_qty: 75,
    unit: 'Peti',
    unit_price: 29000,
    subtotal: 2175000,
    cost_price: 29000,
    cogs: 2175000,
    notes: '5 Peti = 75 kg @ 29000',
  });

  await db.stock_mutations.add({
    code: nanoid(10),
    item_id: telurId,
    transaction_id: t3Id,
    type: 'in',
    qty: 75,
    unit: 'kg',
    previous_stock: 270,
    new_stock: 345,
    date: dateT3.toISOString(),
    notes: 'Pembelian Stok Faktur INV-20261117-0003',
  });

  // --- T4: Expense Pakan Sapi 2500000, Lunas, Kas, 18 Nov 2026 ---
  await db.transactions.add({
    code: 'TX-004',
    invoice_number: 'EXP-20261118-0004',
    type: 'expense',
    sub_type: 'operational',
    contact_id: mansurId,
    account_id: kasTunaiId,
    payment_status: 'paid',
    status: 'completed',
    category: 'Pakan',
    total_amount: 2500000,
    paid_amount: 2500000,
    date: dateT4.toISOString(),
    due_date: null,
    notes: 'Beli konsentrat & rumput gajah untuk sapi limousin',
    created_at: dateT4.toISOString(),
    updated_at: dateT4.toISOString(),
  });

  // --- T5: Adjustment Telur -5kg Pecah, 18 Nov 2026 ---
  await db.stock_mutations.add({
    code: nanoid(10),
    item_id: telurId,
    transaction_id: null,
    type: 'adjustment',
    qty: -5,
    unit: 'kg',
    previous_stock: 345,
    new_stock: 340,
    date: dateT5.toISOString(),
    notes: 'Rusak / Pecah: Penyesuaian saat bongkar muat peti',
  });

  // --- T6: Installment for T2, 200000, Kas, 20 Nov 2026 ---
  await db.installments.add({
    code: nanoid(10),
    transaction_id: t2Id,
    account_id: kasTunaiId,
    amount: 200000,
    date: dateT6.toISOString(),
    notes: 'Cicilan ke-2 dari Bu Siti via Kas Tunai',
    created_at: dateT6.toISOString(),
  });

  // 9. App settings
  await db.app_settings.add({
    key: 'business_info',
    value: {
      name: 'CV Amanah Barokah',
      owner: 'Pimpinan CV Amanah Barokah',
      phone: '081234567890',
      address: 'Sentra Bisnis & Distribusi Komoditas',
    },
  });

  // 10. Operational Notes (F5.4 To-Do List)
  const existingNotes = await db.operational_notes.count();
  if (existingNotes === 0) {
    await db.operational_notes.bulkAdd([
      {
        title: 'Kirim susu ke Bu Ani jam 6 pagi',
        description: 'Pengantaran 20 liter susu sapi segar',
        category: 'Susu',
        priority: 'high',
        date: now.toISOString(),
        is_completed: 0,
        created_at: now.toISOString(),
      },
      {
        title: 'Jadwal vaksin Sapi LMS-003',
        description: 'Vaksinasi berkala oleh dokter dinas peternakan',
        category: 'Sapi',
        priority: 'medium',
        date: addDays(now, 5).toISOString(),
        is_completed: 0,
        created_at: now.toISOString(),
      },
      {
        title: 'Restok Minyak dari supplier Pak Joko',
        description: 'Pemesanan 200 liter minyak curah',
        category: 'Minyak',
        priority: 'low',
        date: subDays(now, 2).toISOString(),
        is_completed: 1,
        created_at: subDays(now, 3).toISOString(),
      },
      {
        title: 'Pembersihan kandang domba garut',
        description: 'Sanitasi kandang dan penggantian pakan rumput',
        category: 'Domba',
        priority: 'low',
        date: subDays(now, 1).toISOString(),
        is_completed: 1,
        created_at: subDays(now, 2).toISOString(),
      },
      {
        title: 'Pengecekan kualitas telur ayam rak A',
        description: 'Sortir telur retak saat bongkar muat pagi',
        category: 'Telur',
        priority: 'medium',
        date: subDays(now, 3).toISOString(),
        is_completed: 1,
        created_at: subDays(now, 4).toISOString(),
      },
    ]);
  }

  // 11. Proyek Rotasi Modal (CV Amanah Barokah Real Business Logic)
  const existingRotations = await db.capital_rotations.count();
  if (existingRotations === 0) {
    await db.capital_rotations.bulkAdd([
      {
        project_name: 'Pengadaan Minyak Sunco Batch #01',
        commodity: 'Minyak Sunco',
        capital_amount: 50000000,
        profit_amount: 4000000,
        roi_percentage: 8.0,
        status: 'done',
        start_date: subDays(now, 20).toISOString(),
        completion_date: subDays(now, 12).toISOString(),
        proof_url: '',
        notes: 'Pencairan lancar via transfer BCA. Bruto 3.500L, Netto 3.480L.',
        created_at: subDays(now, 20).toISOString(),
      },
      {
        project_name: 'Distribusi Minyak Kita Karton Batch #02',
        commodity: 'Minyak Kita',
        capital_amount: 35000000,
        profit_amount: 2800000,
        roi_percentage: 8.0,
        status: 'done',
        start_date: subDays(now, 15).toISOString(),
        completion_date: subDays(now, 7).toISOString(),
        proof_url: '',
        notes: 'Pengiriman toko ritel mitra. Bruto 2.500 pouch.',
        created_at: subDays(now, 15).toISOString(),
      },
      {
        project_name: 'Pengadaan Susu MBG Tahap 1',
        commodity: 'Susu MBG',
        capital_amount: 25000000,
        profit_amount: 2000000,
        roi_percentage: 8.0,
        status: 'done',
        start_date: subDays(now, 10).toISOString(),
        completion_date: subDays(now, 3).toISOString(),
        proof_url: '',
        notes: 'Program gizi MBG termin 1 cair tepat waktu.',
        created_at: subDays(now, 10).toISOString(),
      },
      {
        project_name: 'Pengadaan Susu MBG Tahap 2',
        commodity: 'Susu MBG',
        capital_amount: 30000000,
        profit_amount: 2400000,
        roi_percentage: 8.0,
        status: 'waiting',
        start_date: subDays(now, 3).toISOString(),
        completion_date: null,
        proof_url: '',
        notes: 'Modal di lapangan, estimasi pencairan akhir pekan ini.',
        created_at: subDays(now, 3).toISOString(),
      },
      {
        project_name: 'Pasokan Telur Ayam Sentra Mandiri',
        commodity: 'Telur',
        capital_amount: 15000000,
        profit_amount: 1200000,
        roi_percentage: 8.0,
        status: 'waiting',
        start_date: subDays(now, 2).toISOString(),
        completion_date: null,
        proof_url: '',
        notes: 'Margin tetap 8%. Kirim ke 3 cabang agen.',
        created_at: subDays(now, 2).toISOString(),
      },
      {
        project_name: 'Penggemukan Domba Mitra Barokah',
        commodity: 'Domba',
        capital_amount: 40000000,
        profit_amount: 4400000,
        roi_percentage: 11.0,
        status: 'done',
        start_date: subDays(now, 30).toISOString(),
        completion_date: subDays(now, 5).toISOString(),
        proof_url: '',
        notes: 'Batch penggemukan 20 ekor, panen bobot sehat.',
        created_at: subDays(now, 30).toISOString(),
      },
    ]);
  }

      return true;
    } finally {
      isSeeding = false;
    }
  })();

  return seedPromise;
}

export default seedDatabase;
