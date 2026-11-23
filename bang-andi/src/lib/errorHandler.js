/**
 * Error Handler & User-Friendly Translator for Bang Andi
 * Translates technical Supabase, PostgreSQL, Network, and Dexie errors
 * into empathetic, clear, and actionable Bahasa Indonesia for non-technical users.
 */

export function isOnline() {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Translates any error into a friendly Bahasa Indonesia message.
 * @param {Error|string|object} error
 * @param {string} defaultMessage
 * @returns {string}
 */
export function translateErrorMessage(error, defaultMessage = 'Terjadi kendala pada sistem. Silakan coba sesaat lagi.') {
  if (!error) return defaultMessage;

  const rawMessage = typeof error === 'string'
    ? error
    : (error.message || error.error_description || error.details || error.hint || String(error));

  const lower = rawMessage.toLowerCase();

  // 1. Network / Internet Connection Errors
  if (
    !isOnline() ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower.includes('the internet connection appears to be offline') ||
    lower.includes('err_internet_disconnected') ||
    lower.includes('net::err_connection')
  ) {
    return 'Koneksi internet terputus atau tidak stabil. Data Anda tetap tersimpan aman di HP/Tablet dan akan disinkronkan saat online kembali.';
  }

  // 2. Timeout Errors
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')) {
    return 'Waktu tunggu koneksi ke server habis. Silakan periksa sinyal internet Anda dan coba beberapa saat lagi.';
  }

  // 3. Supabase Auth / Session Errors
  if (
    lower.includes('jwt expired') ||
    lower.includes('token is expired') ||
    lower.includes('invalid claim: missing sub claim') ||
    lower.includes('session expired') ||
    lower.includes('refresh_token_not_found')
  ) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bang_andi:session_expired'));
    }
    return 'Sesi login Anda telah berakhir demi keamanan. Silakan masuk (login) kembali untuk melanjutkan sinkronisasi.';
  }

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Email atau kata sandi yang Anda masukkan salah. Silakan periksa kembali.';
  }

  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return 'Email ini sudah terdaftar. Silakan pilih menu Masuk dengan akun ini.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Alamat email belum dikonfirmasi. Silakan periksa kotak masuk email Anda.';
  }

  // 4. PostgreSQL Database & Constraint Errors
  if (lower.includes('23505') || lower.includes('duplicate key value') || lower.includes('already exists')) {
    return 'Data dengan kode atau nomor faktur tersebut sudah tercatat di sistem.';
  }

  if (lower.includes('23503') || lower.includes('violates foreign key constraint')) {
    return 'Data tidak dapat dihapus atau disimpan karena masih terkait dengan data transaksi lain.';
  }

  if (lower.includes('23514') || lower.includes('check constraint')) {
    return 'Nilai yang dimasukkan tidak memenuhi batas atau aturan yang diperbolehkan (misal: nominal atau stok tidak boleh minus).';
  }

  if (lower.includes('42501') || lower.includes('row-level security policy') || lower.includes('permission denied')) {
    return 'Akses ditolak oleh kebijakan keamanan data. Pastikan Anda telah masuk dengan akun yang memiliki hak akses.';
  }

  if (lower.includes('relation') && lower.includes('does not exist')) {
    return 'Tabel database cloud belum disiapkan. Silakan jalankan file skema SQL pada dashboard Supabase Anda.';
  }

  // 5. Business Logic & Stock Errors (already friendly in Indonesian)
  if (
    lower.includes('stok') ||
    lower.includes('kosong') ||
    lower.includes('tidak mencukupi') ||
    lower.includes('nominal') ||
    lower.includes('faktur')
  ) {
    return rawMessage;
  }

  // 6. Generic Fallback
  return rawMessage.length < 150 ? rawMessage : defaultMessage;
}

export default {
  isOnline,
  translateErrorMessage,
};
