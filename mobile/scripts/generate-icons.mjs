import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function px(pixels, size, x, y, r, g, b) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  pixels[i] = r;
  pixels[i + 1] = g;
  pixels[i + 2] = b;
  pixels[i + 3] = 255;
}

function fill(pixels, size, color) {
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = 255;
  }
}

function rect(pixels, size, x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) px(pixels, size, x, y, color[0], color[1], color[2]);
  }
}

function roundedRect(pixels, size, x0, y0, x1, y1, radius, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = x < x0 + radius ? x0 + radius - x : x > x1 - radius ? x - (x1 - radius) : 0;
      const dy = y < y0 + radius ? y0 + radius - y : y > y1 - radius ? y - (y1 - radius) : 0;
      if (dx * dx + dy * dy > radius * radius) continue;
      px(pixels, size, x, y, color[0], color[1], color[2]);
    }
  }
}

function drawIcon(size, { splash = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const pine = [22, 56, 44];
  const cream = [243, 238, 228];
  const rust = [184, 92, 56];
  fill(pixels, size, splash ? cream : pine);
  const inset = Math.round(size * (splash ? 0.18 : 0.12));
  roundedRect(pixels, size, inset, inset, size - inset, size - inset, Math.round(size * 0.16), splash ? pine : cream);
  const barX = Math.round(size * 0.3);
  const barW = Math.round(size * 0.12);
  const top = Math.round(size * 0.3);
  const bot = Math.round(size * 0.72);
  const mid = Math.round(size * 0.48);
  const arm = Math.round(size * 0.62);
  const ink = splash ? cream : pine;
  rect(pixels, size, barX, top, barX + barW, bot, ink);
  rect(pixels, size, barX, top, arm, top + Math.round(size * 0.1), ink);
  rect(pixels, size, barX, mid, Math.round(size * 0.56), mid + Math.round(size * 0.08), ink);
  rect(pixels, size, Math.round(size * 0.3), Math.round(size * 0.78), Math.round(size * 0.7), Math.round(size * 0.83), rust);
  return encodePng(size, size, pixels);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(root, { recursive: true });
writeFileSync(join(root, "icon.png"), drawIcon(1024));
writeFileSync(join(root, "adaptive-icon.png"), drawIcon(1024));
writeFileSync(join(root, "splash-icon.png"), drawIcon(1024, { splash: true }));
writeFileSync(join(root, "favicon.png"), drawIcon(196));
console.log("Wrote Exempo icons to", root);
