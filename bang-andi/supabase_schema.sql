-- ==============================================================================
-- BANG ANDI - SKEMA DATABASE SUPABASE (POSTGRESQL) - FASE 2 PRODUCTION-READY
-- ==============================================================================
-- 8 Tabel Utama:
-- 1. accounts             : Akun Kas & Bank
-- 2. contacts             : Pelanggan & Supplier
-- 3. categories           : Komoditas & Kategori Biaya/Pendapatan
-- 4. products             : Barang, Komoditas, & Ternak (Aset Hidup)
-- 5. product_units        : Multi-Satuan & Faktor Konversi
-- 6. transactions         : Transaksi Keuangan (Penjualan, Pembelian, Operasional, Transfer, Retur)
-- 7. transaction_payments : Cicilan / Angsuran Pembayaran & DP
-- 8. stock_movements      : Riwayat Mutasi Stok (Masuk, Keluar, Opname/Penyesuaian, Void)
-- ==============================================================================

-- 0. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABEL: accounts (Kas & Bank)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('cash', 'bank', 'other')),
    account_number VARCHAR(50),
    bank_name VARCHAR(50),
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. TABEL: contacts (Pelanggan & Supplier)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'supplier', 'both')),
    phone VARCHAR(30),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 3. TABEL: categories (Komoditas & Kategori Operasional)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'commodity' CHECK (type IN ('commodity', 'expense', 'income')),
    icon VARCHAR(50) DEFAULT 'Package',
    color VARCHAR(30) DEFAULT '#064E3B',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 4. TABEL: products (Barang Komoditas & Hewan Ternak)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    code VARCHAR(50),
    name VARCHAR(150) NOT NULL,
    base_unit VARCHAR(30) NOT NULL DEFAULT 'kg', -- 'kg', 'liter', 'ekor', dll
    stock NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    hpp NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Moving Average HPP
    selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    min_stock NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_perishable BOOLEAN NOT NULL DEFAULT false,
    is_livestock BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb, -- detail bobot, ear tag, batch kadaluarsa
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 5. TABEL: product_units (Konversi Satuan Alternatif)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    unit_name VARCHAR(50) NOT NULL, -- Peti, Tray, Jeriken
    conversion_factor NUMERIC(15, 4) NOT NULL, -- Contoh: 1 Peti = 15 kg
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(product_id, unit_name)
);

-- ------------------------------------------------------------------------------
-- 6. TABEL: transactions (Faktur Keuangan & Arus Kas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_number VARCHAR(60) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    sub_type VARCHAR(30) NOT NULL CHECK (sub_type IN ('sale', 'purchase', 'operational', 'return_sale', 'return_purchase', 'transfer', 'other_income', 'other_expense')),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name VARCHAR(100),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- jika transfer antar rekening
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'credit')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'void', 'draft')),
    receipt_url TEXT, -- URL Foto Nota dari Supabase Storage Bucket 'receipts'
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    due_date TIMESTAMPTZ,
    notes TEXT,
    void_reason TEXT,
    voided_at TIMESTAMPTZ,
    items_snapshot JSONB DEFAULT '[]'::jsonb, -- Rincian baris barang: [{product_id, name, qty, unit, unit_price, subtotal, cogs}]
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 7. TABEL: transaction_payments (Cicilan / Angsuran Pembayaran)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Kas Tunai',
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 8. TABEL: stock_movements (Mutasi Stok Komoditas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'void_reversal')),
    qty NUMERIC(15, 2) NOT NULL, -- Satuan dasar (positif / negatif)
    unit VARCHAR(30) NOT NULL,
    previous_stock NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    new_stock NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- INDEXES UNTUK PERFORMA TINGGI
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_units_product ON public.product_units(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON public.transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_tx_payments_tx ON public.transaction_payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(date DESC);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) - SINGLE USER / AUTHENTICATED
-- ------------------------------------------------------------------------------
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Helper macro policies: Hanya pemilik (auth.uid() = user_id) atau authenticated user jika single-user
CREATE POLICY "Single User Full Access - accounts" ON public.accounts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Single User Full Access - contacts" ON public.contacts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Single User Full Access - categories" ON public.categories
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Single User Full Access - products" ON public.products
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Single User Full Access - product_units" ON public.product_units
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Single User Full Access - transactions" ON public.transactions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Single User Full Access - transaction_payments" ON public.transaction_payments
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Single User Full Access - stock_movements" ON public.stock_movements
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR user_id IS NULL)
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ------------------------------------------------------------------------------
-- SUPABASE STORAGE BUCKET: receipts (Foto Nota Transaksi)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies: Siapapun yang authenticated bisa upload & view
CREATE POLICY "Public Read Access for receipts" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated Users can upload receipts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Authenticated Users can update/delete receipts" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'receipts');

CREATE POLICY "Authenticated Users can delete receipts" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'receipts');

-- ------------------------------------------------------------------------------
-- REALTIME REPLICATION SETUP (Agar iPad & HP tersinkronisasi seketika)
-- ------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;

-- ------------------------------------------------------------------------------
-- DATA AWAL (SEED DATA BANG ANDI)
-- ------------------------------------------------------------------------------
-- 1. Kategori Komoditas & Biaya
INSERT INTO public.categories (id, name, type, icon, color, sort_order) VALUES
('c1000000-0000-0000-0000-000000000001', 'Minyak Goreng', 'commodity', 'Droplets', '#F59E0B', 1),
('c1000000-0000-0000-0000-000000000002', 'Telur Ayam', 'commodity', 'Egg', '#EAB308', 2),
('c1000000-0000-0000-0000-000000000003', 'Sapi Ternak', 'commodity', 'Beef', '#DC2626', 3),
('c1000000-0000-0000-0000-000000000004', 'Domba Ternak', 'commodity', 'Bug', '#7C3AED', 4),
('c1000000-0000-0000-0000-000000000005', 'Susu Sapi', 'commodity', 'Milk', '#3B82F6', 5),
('c1000000-0000-0000-0000-000000000006', 'Pakan Ternak', 'expense', 'Wheat', '#10B981', 6),
('c1000000-0000-0000-0000-000000000007', 'Vaksin & Obat', 'expense', 'ShieldAlert', '#EF4444', 7),
('c1000000-0000-0000-0000-000000000008', 'Transport & Logistik', 'expense', 'Truck', '#6366F1', 8),
('c1000000-0000-0000-0000-000000000009', 'Operasional & Gaji', 'expense', 'Users', '#64748B', 9)
ON CONFLICT (id) DO NOTHING;

-- 2. Akun Kas & Bank
INSERT INTO public.accounts (id, name, type, account_number, bank_name, initial_balance, balance, notes) VALUES
('a1000000-0000-0000-0000-000000000001', 'Kas Tunai Toko', 'cash', '-', '-', 15000000, 13960000, 'Uang kas fisik di laci'),
('a1000000-0000-0000-0000-000000000002', 'Bank BCA Andi', 'bank', '123-456-7890', 'BCA', 50000000, 47825000, 'Rekening operasional utama')
ON CONFLICT (id) DO NOTHING;

-- 3. Kontak Pelanggan & Supplier
INSERT INTO public.contacts (id, name, type, phone, address, notes) VALUES
('b1000000-0000-0000-0000-000000000001', 'Bu Siti (Warung Berkah)', 'customer', '081234567891', 'Pasar Baru Blok A No. 12', 'Langganan telur & minyak'),
('b1000000-0000-0000-0000-000000000002', 'Pak Haji Rahmat (Resto)', 'customer', '081234567892', 'Jl. Merdeka Barat No. 45', 'Pembeli susu sapi & daging'),
('b1000000-0000-0000-0000-000000000003', 'PT Pangan Sumber Makmur', 'supplier', '082198765432', 'Kawasan Industri Cikarang', 'Supplier minyak curah'),
('b1000000-0000-0000-0000-000000000004', 'Koperasi Peternak Mandiri', 'supplier', '085612349876', 'Lembang Bandung', 'Supplier pakan & bibit')
ON CONFLICT (id) DO NOTHING;

-- 4. Produk Komoditas
INSERT INTO public.products (id, category_id, code, name, base_unit, stock, hpp, selling_price, min_stock, is_perishable, is_livestock) VALUES
('p1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'MYK-CURAH', 'Minyak Goreng Curah', 'liter', 160.00, 14000.00, 16000.00, 50.00, false, false),
('p1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 'TLR-RAS', 'Telur Ayam Ras', 'kg', 340.00, 28217.00, 32000.00, 50.00, true, false),
('p1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', 'SPI-LIMOUSIN', 'Sapi Limousin', 'ekor', 5.00, 18000000.00, 22000000.00, 2.00, false, true),
('p1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004', 'DMB-GARUT', 'Domba Garut', 'ekor', 12.00, 3500000.00, 4500000.00, 4.00, false, true),
('p1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000005', 'SSU-MURNI', 'Susu Sapi Segar', 'liter', 80.00, 11000.00, 15000.00, 20.00, true, false)
ON CONFLICT (id) DO NOTHING;

-- 5. Multi-Satuan Produk
INSERT INTO public.product_units (id, product_id, unit_name, conversion_factor, is_default) VALUES
('u1000000-0000-0000-0000-000000000001', 'p1000000-0000-0000-0000-000000000001', 'Jeriken (18 L)', 18.0000, false),
('u1000000-0000-0000-0000-000000000002', 'p1000000-0000-0000-0000-000000000001', 'Drum (200 L)', 200.0000, false),
('u1000000-0000-0000-0000-000000000003', 'p1000000-0000-0000-0000-000000000002', 'Peti (15 kg)', 15.0000, false),
('u1000000-0000-0000-0000-000000000004', 'p1000000-0000-0000-0000-000000000002', 'Tray (1.8 kg)', 1.8000, false),
('u1000000-0000-0000-0000-000000000005', 'p1000000-0000-0000-0000-000000000005', 'Can (20 L)', 20.0000, false)
ON CONFLICT (id) DO NOTHING;
