import { createClient } from '@supabase/supabase-js';

/**
 * VERCEL CRON / SERVERLESS FUNCTION: /api/keep-alive
 * 
 * Otomatis dipanggil oleh Vercel Cron Job setiap 3 hari sekali
 * untuk melakukan update timestamp pada tabel 'system_heartbeat' di Supabase.
 * Menghindari auto-pause 7 hari Supabase Free Tier tanpa mengotori data bisnis.
 */
export default async function handler(req, res) {
  // Hanya izinkan method GET & POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: 'Method Not Allowed. Gunakan GET atau POST.',
    });
  }

  // 1. Ambil URL dan API Key dari Environment Variables Vercel
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ''
  ).trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      status: 'error',
      message: 'Konfigurasi Supabase tidak ditemukan. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY sudah disetel di Vercel Environment Variables.',
    });
  }

  const now = new Date().toISOString();

  try {
    // 2. Inisialisasi client Supabase
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 3. Upsert baris id = 1 pada tabel system_heartbeat
    const { data, error } = await supabase
      .from('system_heartbeat')
      .upsert(
        {
          id: 1,
          last_ping: now,
          notes: 'Vercel Cron Keep-Alive Ping',
        },
        { onConflict: 'id' }
      )
      .select();

    if (error) {
      console.error('Supabase heartbeat upsert error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Gagal mencatat heartbeat ke tabel system_heartbeat di Supabase.',
        details: error.message || error,
        code: error.code || null,
        timestamp: now,
      });
    }

    return res.status(200).json({
      status: 'ok',
      message: 'Supabase keep-alive heartbeat berhasil dikirim.',
      timestamp: now,
      data: data?.[0] || null,
    });
  } catch (err) {
    console.error('Unhandled keep-alive exception:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan internal pada serverless function keep-alive.',
      details: err.message || String(err),
      timestamp: now,
    });
  }
}
