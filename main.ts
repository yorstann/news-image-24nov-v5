// Entrypoint: render the front page and write entry.png to the output dir.
// Self-contained PNG encoder (zlib level 9, filter 0). No network, no
// randomness — two runs produce byte-identical output.
import { render, W, H } from "./render.ts";
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

// ---- CRC32 (standard table-based) ----
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(cv: { w: number; h: number; data: Uint8Array }): Buffer {
  const { w, h, data } = cv;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(data.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function main() {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  mkdirSync(outDir, { recursive: true });
  const cv = render();
  const png = encodePNG(cv);
  const outPath = outDir + "/entry.png";
  writeFileSync(outPath, png);

  // self-check: read back, verify PNG signature + IHDR dims + size cap
  const back = readFileSync(outPath);
  const sigOk = back[0] === 0x89 && back[1] === 0x50 && back[2] === 0x4e && back[3] === 0x47;
  const w = back.readUInt32BE(16);
  const h = back.readUInt32BE(20);
  const ok = sigOk && w === W && h === H && back.length < 1024 * 1024;
  console.log(`entry.png: ${w}x${h}, ${back.length} bytes, signature=${sigOk}, under 1 MiB=${back.length < 1024 * 1024}, self-check=${ok ? "PASS" : "FAIL"}`);
  if (!ok) process.exit(1);
}

main();
