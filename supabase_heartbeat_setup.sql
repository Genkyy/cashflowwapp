-- ==============================================================================
-- BANG ANDI - SUPABASE SYSTEM HEARTBEAT (KEEP-ALIVE DEDICATED TABLE)
-- ==============================================================================
-- Skrip ini membuat tabel kecil terisolasi 'system_heartbeat' untuk mencatat ping
-- otomatis dari Vercel Cron Job agar Supabase Free Tier tidak di-pause setelah 7 hari.
--
-- KEUNTUNGAN:
-- 1. Tidak menyentuh tabel bisnis (accounts, transactions, products).
-- 2. Tidak memicu realtime subscription atau merusak saldo/audit transaksi.
-- 3. Mendukung upsert berkala pada baris id = 1.
-- ==============================================================================

-- 1. Buat tabel system_heartbeat
CREATE TABLE IF NOT EXISTS public.system_heartbeat (
    id INT PRIMARY KEY DEFAULT 1,
    last_ping TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    notes TEXT DEFAULT 'Vercel Keep-Alive Heartbeat',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Pastikan baris default id = 1 sudah ada
INSERT INTO public.system_heartbeat (id, last_ping, notes)
VALUES (1, timezone('utc'::text, now()), 'Initial heartbeat row')
ON CONFLICT (id) DO UPDATE SET last_ping = timezone('utc'::text, now());

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;

-- 4. Buat policy agar endpoint Vercel Cron (menggunakan anon key atau service_role)
--    dapat melakukan SELECT, INSERT, dan UPDATE (upsert) tanpa kendala
DROP POLICY IF EXISTS "Full Access - system_heartbeat" ON public.system_heartbeat;
CREATE POLICY "Full Access - system_heartbeat" ON public.system_heartbeat
    FOR ALL TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 5. Berikan hak akses tabel ke role PostgreSQL
GRANT ALL ON TABLE public.system_heartbeat TO anon, authenticated, service_role;

-- ==============================================================================
-- SELESAI. Tabel system_heartbeat siap menerima ping otomatis dari Vercel Cron.
-- ==============================================================================
