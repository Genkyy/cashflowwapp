import { supabase, isSupabaseConfigured } from './supabase.js';
import { compressImage, blobToBase64 } from './imageCompressor.js';

/**
 * Uploads a receipt image to Supabase Storage bucket 'receipts'
 * Automatically compresses client-side before uploading.
 * Falls back to base64 Data URL if Supabase is not configured or in offline mode.
 * 
 * @param {File|Blob} file - Gambar nota dari kamera / file input
 * @param {string} [prefix='nota'] - Prefix nama file
 * @returns {Promise<{ url: string, isStorage: boolean }>}
 */
export async function uploadReceiptImage(file, prefix = 'nota') {
  if (!file) return { url: '', isStorage: false };

  // 1. Client-side compression (maks lebar 800px, JPEG quality 0.75)
  const compressedBlob = await compressImage(file, 800, 0.75);

  // 2. Jika Supabase aktif, upload ke Storage Bucket 'receipts'
  if (isSupabaseConfigured && supabase) {
    try {
      const now = new Date();
      const timestamp = now.getTime();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const filename = `${prefix}_${timestamp}_${randomStr}.jpg`;
      const filePath = `receipts/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${filename}`;

      const { data, error } = await supabase.storage
        .from('receipts')
        .upload(filePath, compressedBlob, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: true,
        });

      if (error) {
        console.warn('Gagal upload ke Supabase Storage, beralih ke local storage:', error.message);
      } else {
        // Dapatkan URL publik dari Supabase Storage
        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(data?.path || filePath);

        if (publicUrlData?.publicUrl) {
          return {
            url: publicUrlData.publicUrl,
            isStorage: true,
          };
        }
      }
    } catch (err) {
      console.warn('Error upload receipt ke Supabase:', err);
    }
  }

  // 3. Fallback: simpan sebagai Base64 data URL untuk offline / demo mode
  const base64Url = await blobToBase64(compressedBlob);
  return {
    url: base64Url,
    isStorage: false,
  };
}
