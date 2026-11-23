/**
 * SUPABASE KEEP-ALIVE SCRIPT (PENCEGAH AUTO-PAUSE 7 HARI SUPABASE FREE PLAN)
 * 
 * Script ini mengirimkan sinyal ping/heartbeat ke Supabase REST API
 * agar project Supabase Anda tetap aktif dan tidak pernah di-pause oleh Supabase.
 * 
 * Cara Penggunaan:
 * 1. Jalankan langsung lewat terminal:
 *    node scripts/supabase-keepalive.js
 * 
 * 2. Atau bisa dijalankan otomatis via GitHub Actions / Windows Task Scheduler.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Baca kredensial dari .env atau .env.local jika ada
function loadEnv() {
  const rootDir = resolve(__dirname, '..');
  const envFiles = [resolve(rootDir, '.env.local'), resolve(rootDir, '.env')];
  const envVars = {};

  for (const file of envFiles) {
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...values] = trimmed.split('=');
          const val = values.join('=').trim().replace(/^["']|["']$/g, '');
          if (!envVars[key.trim()]) {
            envVars[key.trim()] = val;
          }
        }
      });
    }
  }
  return envVars;
}

const env = loadEnv();
const supabaseUrl = (process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || 'https://zcnbgwhlpfuhajhlzint.supabase.co')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');

const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_nYmcyZNojUuXYGx-qmckoA_3C-QkV2e';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase URL atau Anon Key tidak ditemukan di file .env');
  process.exit(1);
}

console.log('----------------------------------------------------');
console.log('🚀 Menjalankan Supabase Keep-Alive Ping...');
console.log(`📡 Target URL : ${supabaseUrl}`);
console.log(`⏰ Waktu       : ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`);
console.log('----------------------------------------------------');

async function sendHeartbeat() {
  try {
    // 1. Ping endpoint REST API untuk membaca data
    const queryUrl = `${supabaseUrl}/rest/v1/accounts?select=id,name,updated_at&limit=1`;
    const res = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    // 2. Sentuh (touch) updated_at pada akun kas agar tercatat mutasi query tulis (write activity)
    if (Array.isArray(data) && data.length > 0) {
      const targetId = data[0].id;
      const patchUrl = `${supabaseUrl}/rest/v1/accounts?id=eq.${targetId}`;
      await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          updated_at: new Date().toISOString(),
        }),
      });
    }

    console.log('✅ SUKSES: Sinyal Heartbeat berhasil dikirim ke Supabase!');
    console.log('🎉 Project Supabase Anda tetap AKTIF dan timer 7 hari telah di-reset kembali ke 0.');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('❌ Gagal mengirim heartbeat ke Supabase:', err.message);
    process.exit(1);
  }
}

sendHeartbeat();
