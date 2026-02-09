// Simple script to generate PWA icons as PNG using Node.js
// Run: node scripts/generate-icons.js

const fs = require("fs");
const path = require("path");

function createPNG(size) {
  // Create a minimal valid PNG file with a colored square
  // This uses raw PNG generation without external dependencies

  const width = size;
  const height = size;

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk("IHDR", ihdrData);

  // IDAT chunk - create image data
  const rawData = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.4;
  const innerRadius = width * 0.25;

  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < innerRadius) {
        // Inner circle - white
        rawData.push(255, 255, 255);
      } else if (dist < radius) {
        // Outer ring - dark color (#171717)
        rawData.push(23, 23, 23);
      } else if (dist < radius + 2) {
        // Anti-alias edge
        rawData.push(100, 100, 100);
      } else {
        // Background - primary brand color
        rawData.push(23, 23, 23);
      }
    }
  }

  const rawBuffer = Buffer.from(rawData);

  // Compress with zlib
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(rawBuffer);

  const idatChunk = createChunk("IDAT", compressed);

  // IEND chunk
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(data) {
  let crc = 0xffffffff;
  const table = [];

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[192, 512].forEach((size) => {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated: ${filePath} (${png.length} bytes)`);
});

console.log("Done! PWA icons generated.");
