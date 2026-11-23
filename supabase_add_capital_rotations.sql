-- ==============================================================================
-- BANG ANDI - SUPABASE DATABASE MIGRATION: TABEL PROYEK ROTASI MODAL
-- ==============================================================================
-- Skrip ini untuk membuat tabel 'capital_rotations' di Supabase Cloud.
-- Jalankan di: Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- ==============================================================================

-- 1. Buat Tabel capital_rotations (Proyek Rotasi Modal Lapangan)
CREATE TABLE IF NOT EXISTS public.capital_rotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_name VARCHAR(200) NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    capital_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    profit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    roi_percentage NUMERIC(8, 2) NOT NULL DEFAULT 8.00,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'done', 'cancel')),
    start_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completion_date TIMESTAMPTZ,
    proof_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes untuk performa cepat
CREATE INDEX IF NOT EXISTS idx_capital_rotations_user ON public.capital_rotations(user_id);
CREATE INDEX IF NOT EXISTS idx_capital_rotations_status ON public.capital_rotations(status);
CREATE INDEX IF NOT EXISTS idx_capital_rotations_date ON public.capital_rotations(start_date DESC);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.capital_rotations ENABLE ROW LEVEL SECURITY;

-- 4. Berikan kebijakan Full Access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Full Access - capital_rotations" ON public.capital_rotations;
CREATE POLICY "Full Access - capital_rotations" ON public.capital_rotations
    FOR ALL TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- 5. Berikan hak akses tabel ke role PostgreSQL
GRANT ALL ON TABLE public.capital_rotations TO anon, authenticated, service_role;

-- 6. Tambahkan ke Realtime Publication (agar iPad & HP tersinkronisasi instan)
ALTER PUBLICATION supabase_realtime ADD TABLE public.capital_rotations;

-- ==============================================================================
-- SELESAI. Tabel capital_rotations kini aktif dan tersinkronisasi dengan Supabase!
-- ==============================================================================
