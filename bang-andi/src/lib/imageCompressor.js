/**
 * Compress an image file using HTML5 canvas
 * @param {File|Blob} file - Original image file
 * @param {number} [maxWidth=800] - Maximum width for compressed image
 * @param {number} [quality=0.7] - JPEG quality (0.1 to 1.0)
 * @returns {Promise<Blob>} Compressed image as JPEG Blob
 */
export async function compressImage(file, maxWidth = 800, quality = 0.7) {
  if (typeof window === 'undefined' || !window.HTMLCanvasElement) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gagal memuat gambar'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a Blob to Base64 data URL
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal mengonversi blob ke base64'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Base64 string to Blob
 * @param {string} base64
 * @param {string} [mimeType='image/jpeg']
 * @returns {Blob}
 */
export function base64ToBlob(base64, mimeType = 'image/jpeg') {
  if (!base64) return new Blob([], { type: mimeType });

  let byteString;
  let type = mimeType;

  if (base64.includes(',')) {
    const parts = base64.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch && mimeMatch[1]) {
      type = mimeMatch[1];
    }
    byteString = atob(parts[1]);
  } else {
    byteString = atob(base64);
  }

  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type });
}
