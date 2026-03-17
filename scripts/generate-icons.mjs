import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const outputDir = path.join(root, "icons");
const sizes = [16, 32, 48, 128];
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
})();

fs.mkdirSync(outputDir, { recursive: true });

for (const size of sizes) {
  const png = buildIcon(size);
  fs.writeFileSync(path.join(outputDir, `icon${size}.png`), png);
}

function buildIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);

  const bg = [15, 23, 42, 255];
  const accent = [56, 189, 248, 255];
  const light = [226, 232, 240, 255];

  fillRect(pixels, size, 0, 0, size, size, bg);
  fillRoundedRect(pixels, size, 2, 2, size - 4, size - 4, Math.max(3, Math.floor(size * 0.16)), accent);

  const inset = Math.max(3, Math.floor(size * 0.18));
  fillRoundedRect(
    pixels,
    size,
    inset,
    inset,
    size - inset * 2,
    size - inset * 2,
    Math.max(2, Math.floor(size * 0.12)),
    light
  );

  const innerInset = Math.max(5, Math.floor(size * 0.29));
  fillRect(pixels, size, innerInset, innerInset, size - innerInset * 2, Math.max(2, Math.floor(size * 0.1)), accent);
  fillRect(
    pixels,
    size,
    innerInset,
    innerInset + Math.max(5, Math.floor(size * 0.16)),
    Math.max(2, Math.floor(size * 0.44)),
    Math.max(2, Math.floor(size * 0.1)),
    accent
  );

  return encodePng(size, size, pixels);
}

function fillRect(buffer, width, x, y, rectWidth, rectHeight, rgba) {
  const xEnd = Math.min(width, x + rectWidth);
  const yEnd = Math.min(width, y + rectHeight);

  for (let py = Math.max(0, y); py < yEnd; py += 1) {
    for (let px = Math.max(0, x); px < xEnd; px += 1) {
      setPixel(buffer, width, px, py, rgba);
    }
  }
}

function fillRoundedRect(buffer, width, x, y, rectWidth, rectHeight, radius, rgba) {
  const xEnd = Math.min(width, x + rectWidth);
  const yEnd = Math.min(width, y + rectHeight);
  const r = Math.max(0, radius);

  for (let py = Math.max(0, y); py < yEnd; py += 1) {
    for (let px = Math.max(0, x); px < xEnd; px += 1) {
      const left = px - x;
      const top = py - y;
      const right = xEnd - 1 - px;
      const bottom = yEnd - 1 - py;

      const inCorner =
        (left < r && top < r && distance(left, top, r - 1, r - 1) > r - 0.5) ||
        (right < r && top < r && distance(right, top, r - 1, r - 1) > r - 0.5) ||
        (left < r && bottom < r && distance(left, bottom, r - 1, r - 1) > r - 0.5) ||
        (right < r && bottom < r && distance(right, bottom, r - 1, r - 1) > r - 0.5);

      if (!inCorner) {
        setPixel(buffer, width, px, py, rgba);
      }
    }
  }
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function setPixel(buffer, width, x, y, [r, g, b, a]) {
  const index = (y * width + x) * 4;
  buffer[index] = r;
  buffer[index + 1] = g;
  buffer[index + 2] = b;
  buffer[index + 3] = a;
}

function encodePng(width, height, rgbaBuffer) {
  const rowSize = width * 4 + 1;
  const raw = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    rgbaBuffer.copy(raw, rowOffset + 1, y * width * 4, y * width * 4 + width * 4);
  }

  const chunks = [];
  chunks.push(createChunk("IHDR", createIhdr(width, height)));
  chunks.push(createChunk("IDAT", zlib.deflateSync(raw)));
  chunks.push(createChunk("IEND", Buffer.alloc(0)));

  return Buffer.concat([Buffer.from(PNG_SIGNATURE), ...chunks]);
}

function createIhdr(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}
