import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv() {
  const envFiles = [
    resolve(__dirname, '..', 'bang-andi', '.env.local'),
    resolve(__dirname, '..', 'bang-andi', '.env'),
    resolve(__dirname, '..', '.env.local'),
    resolve(__dirname, '..', '.env'),
  ];
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

async function sendHeartbeat() {
  try {
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
    console.log('🎉 Project Supabase Anda tetap AKTIF.');
  } catch (err) {
    console.error('❌ Gagal mengirim heartbeat ke Supabase:', err.message);
    process.exit(1);
  }
}

sendHeartbeat();
