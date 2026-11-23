-- ==============================================================================
-- BANG ANDI - SUPABASE DATABASE FIX: ON DELETE CASCADE & RLS POLICIES
-- ==============================================================================
-- SKRIP INI UNTUK DIJALANKAN DI: Supabase Dashboard -> SQL Editor -> Run
-- 
-- TUJUAN:
-- 1. Memperbaiki Foreign Key Constraints agar menggunakan ON DELETE CASCADE,
--    sehingga saat menghapus produk atau transaksi, PostgreSQL tidak menolak dengan
--    error code 23503 (violates foreign key constraint).
-- 2. Memastikan Row Level Security (RLS) mengizinkan aksi DELETE dan UPDATE untuk
--    semua tabel (role anon dan authenticated), sehingga data benar-benar terhapus
--    di database Supabase dan tidak muncul kembali saat refresh atau sync.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PERBAIKI FOREIGN KEY CONSTRAINTS (ON DELETE CASCADE)
-- ------------------------------------------------------------------------------

-- A. Tabel product_units -> products
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'product_units' 
          AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.product_units DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.product_units
    ADD CONSTRAINT fk_product_units_product
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


-- B. Tabel stock_movements -> products & transactions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'stock_movements' 
          AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.stock_movements
    ADD CONSTRAINT fk_stock_movements_product
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.stock_movements
    ADD CONSTRAINT fk_stock_movements_transaction
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;


-- C. Tabel transaction_payments -> transactions & accounts
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'transaction_payments' 
          AND constraint_type = 'FOREIGN KEY'
    ) LOOP
        EXECUTE 'ALTER TABLE public.transaction_payments DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.transaction_payments
    ADD CONSTRAINT fk_transaction_payments_transaction
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

ALTER TABLE public.transaction_payments
    ADD CONSTRAINT fk_transaction_payments_account
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


-- ------------------------------------------------------------------------------
-- 2. HAPUS POLICY LAMA & BERSIHKAN RLS CONFLICTS
-- ------------------------------------------------------------------------------

-- Bersihkan policy lama di semua 8 tabel
DROP POLICY IF EXISTS "Direct Access - accounts" ON public.accounts;
DROP POLICY IF EXISTS "Direct Access - contacts" ON public.contacts;
DROP POLICY IF EXISTS "Direct Access - categories" ON public.categories;
DROP POLICY IF EXISTS "Direct Access - products" ON public.products;
DROP POLICY IF EXISTS "Direct Access - product_units" ON public.product_units;
DROP POLICY IF EXISTS "Direct Access - transactions" ON public.transactions;
DROP POLICY IF EXISTS "Direct Access - transaction_payments" ON public.transaction_payments;
DROP POLICY IF EXISTS "Direct Access - stock_movements" ON public.stock_movements;

DROP POLICY IF EXISTS "Allow all - accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow all - contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow all - categories" ON public.categories;
DROP POLICY IF EXISTS "Allow all - products" ON public.products;
DROP POLICY IF EXISTS "Allow all - product_units" ON public.product_units;
DROP POLICY IF EXISTS "Allow all - transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow all - transaction_payments" ON public.transaction_payments;
DROP POLICY IF EXISTS "Allow all - stock_movements" ON public.stock_movements;

-- ------------------------------------------------------------------------------
-- 3. AKTIFKAN RLS & TERAPKAN POLICY FULL ACCESS (SELECT, INSERT, UPDATE, DELETE)
-- ------------------------------------------------------------------------------

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- 1. accounts
CREATE POLICY "Full Access - accounts" ON public.accounts
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 2. contacts
CREATE POLICY "Full Access - contacts" ON public.contacts
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 3. categories
CREATE POLICY "Full Access - categories" ON public.categories
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4. products
CREATE POLICY "Full Access - products" ON public.products
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 5. product_units
CREATE POLICY "Full Access - product_units" ON public.product_units
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 6. transactions
CREATE POLICY "Full Access - transactions" ON public.transactions
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 7. transaction_payments
CREATE POLICY "Full Access - transaction_payments" ON public.transaction_payments
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 8. stock_movements
CREATE POLICY "Full Access - stock_movements" ON public.stock_movements
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. BERIKAN HAK AKSES TABLE PERMISSIONS KE ROLE anon & authenticated
-- ------------------------------------------------------------------------------
GRANT ALL ON TABLE public.accounts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.contacts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.product_units TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.transactions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.transaction_payments TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.stock_movements TO anon, authenticated, service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. PERIKSA & AKTIFKAN STORAGE BUCKET receipts (DELETE POLICY)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Direct Access for receipts delete" ON storage.objects;
CREATE POLICY "Direct Access for receipts delete" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id = 'receipts');

-- ==============================================================================
-- SELESAI. Semua Foreign Key sudah CASCADE dan RLS sudah mengizinkan DELETE/UPDATE.
-- ==============================================================================
