import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, colorFn) {
  // Color function returns [r, g, b, a] for given x, y
  const rowBytes = width * 4 + 1; // 1 filter byte per scanline
  const buffer = Buffer.alloc(height * rowBytes);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    buffer[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = colorFn(x, y, width, height);
      buffer[offset++] = r;
      buffer[offset++] = g;
      buffer[offset++] = b;
      buffer[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(buffer);

  // PNG Header
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA (6)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  function makeChunk(type, data) {
    const len = data.length;
    const chunk = Buffer.alloc(len + 12);
    chunk.writeUInt32BE(len, 0);
    chunk.write(type, 4, 4, 'ascii');
    data.copy(chunk, 8);
    const crc = crc32(chunk.subarray(4, 8 + len));
    chunk.writeUInt32BE(crc, 8 + len);
    return chunk;
  }

  // Simple CRC32 table
  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        if ((crc ^ byte) & 1) {
          crc = (crc >>> 1) ^ 0xedb88320;
        } else {
          crc = crc >>> 1;
        }
        byte >>>= 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Icon Drawer with Bang Andi branding:
// Primary Background: #064E3B (r: 6, g: 78, b: 59)
// Accent Circle / Badge: #D97706 (r: 217, g: 119, b: 6)
// White details
function bangAndiIconColor(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = w * 0.44;
  const innerRadius = w * 0.36;

  // Outer border with subtle rounding
  const cornerRadius = w * 0.22;
  const inBoxX = Math.abs(dx) <= cx - cornerRadius;
  const inBoxY = Math.abs(dy) <= cy - cornerRadius;
  const cornerDist = Math.hypot(Math.max(0, Math.abs(dx) - (cx - cornerRadius)), Math.max(0, Math.abs(dy) - (cy - cornerRadius)));
  const insideRoundedRect = inBoxX || inBoxY || cornerDist <= cornerRadius;

  if (!insideRoundedRect) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Base emerald green background (#064E3B)
  let r = 6;
  let g = 78;
  let b = 59;
  let a = 255;

  // Gold circular accent ring (#D97706)
  if (dist >= innerRadius && dist <= radius) {
    r = 217;
    g = 119;
    b = 6;
  } else if (dist < innerRadius) {
    // Inner emerald green with slightly lighter tone (#065F46)
    r = 6;
    g = 95;
    b = 70;

    // Draw stylized 'BA' monogram / agricultural leaf shape
    // Left pillar 'B':
    const lx = x / w;
    const ly = y / h;
    
    // Vertical bar of B
    if (lx >= 0.30 && lx <= 0.38 && ly >= 0.28 && ly <= 0.72) {
      return [254, 243, 199, 255]; // Soft cream / gold #FEF3C7
    }
    // Top loop of B
    if (lx >= 0.35 && lx <= 0.48 && (ly >= 0.28 && ly <= 0.34 || ly >= 0.47 && ly <= 0.52)) {
      return [254, 243, 199, 255];
    }
    if (lx >= 0.44 && lx <= 0.50 && ly >= 0.28 && ly <= 0.52) {
      return [254, 243, 199, 255];
    }
    // Bottom loop of B
    if (lx >= 0.35 && lx <= 0.52 && (ly >= 0.47 && ly <= 0.52 || ly >= 0.67 && ly <= 0.72)) {
      return [254, 243, 199, 255];
    }
    if (lx >= 0.48 && lx <= 0.54 && ly >= 0.47 && ly <= 0.72) {
      return [254, 243, 199, 255];
    }

    // Letter 'A' / Growth spike
    if (lx >= 0.58 && lx <= 0.72 && ly >= 0.28 && ly <= 0.72) {
      // Slanted legs
      const legDist1 = Math.abs((lx - 0.65) - (0.50 - ly) * 0.35);
      const legDist2 = Math.abs((lx - 0.65) + (0.50 - ly) * 0.35);
      if ((legDist1 < 0.045 || legDist2 < 0.045) && ly >= 0.30) {
        return [217, 119, 6, 255]; // Warm Gold #D97706
      }
      // Crossbar of A
      if (ly >= 0.53 && ly <= 0.58 && lx >= 0.60 && lx <= 0.70) {
        return [217, 119, 6, 255];
      }
    }
  }

  return [r, g, b, a];
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

console.log('Generating PWA icons...');
const png192 = createPNG(192, 192, bangAndiIconColor);
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), png192);

const png512 = createPNG(512, 512, bangAndiIconColor);
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), png512);

const appleIcon = createPNG(180, 180, bangAndiIconColor);
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), appleIcon);

console.log('PWA icons created successfully.');
