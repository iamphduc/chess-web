import { readFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";

// Reads advance widths straight from a .woff2 file (the self-hosted Quicksand), so a test can
// check a layout against the real glyphs, not a CSS feature the font may not have.

// The WOFF2 known-table tags, by index (WOFF2 spec, section 5.1).
const KNOWN = (
  "cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp hdmx " +
  "kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix " +
  "acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak " +
  "Zapf Silf Glat Gloc Feat Sill"
)
  .match(/.{4}\s?/g)!
  .map((t) => t.slice(0, 4));

/** The tables of a .woff2 file, decompressed (untransformed tables only are usable). */
function tables(file: string): Record<string, { data: Buffer; transformed: boolean }> {
  const b = readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "wOF2") throw new Error(`${file} is not a woff2 file`);
  const count = b.readUInt16BE(12);
  const compressed = b.readUInt32BE(20);
  let off = 48;
  const base128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const c = b[off++];
      v = v * 128 + (c & 0x7f);
      if (!(c & 0x80)) return v;
    }
    throw new Error("bad UIntBase128");
  };
  const dir: { tag: string; length: number; transformed: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const flags = b[off++];
    let tag = KNOWN[flags & 63];
    if ((flags & 63) === 63) {
      tag = b.toString("ascii", off, off + 4);
      off += 4;
    }
    const version = flags >> 6;
    const transformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    const orig = base128();
    dir.push({ tag, length: transformed ? base128() : orig, transformed });
  }
  const stream = brotliDecompressSync(b.subarray(off, off + compressed));
  const out: Record<string, { data: Buffer; transformed: boolean }> = {};
  let at = 0;
  for (const t of dir) {
    out[t.tag] = { data: stream.subarray(at, at + t.length), transformed: t.transformed };
    at += t.length;
  }
  return out;
}

/** Each character's advance width in em, from the font's cmap (format 4) and hmtx. */
export function advanceWidths(file: string, chars: string): Record<string, number> {
  const t = tables(file);
  for (const tag of ["head", "hhea", "hmtx", "cmap"]) {
    if (!t[tag] || t[tag].transformed) throw new Error(`${file}: no plain ${tag} table`);
  }
  const unitsPerEm = t.head.data.readUInt16BE(18);
  const metrics = t.hhea.data.readUInt16BE(34);
  const cmap = t.cmap.data;
  let sub = -1;
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const at = cmap.readUInt32BE(8 + i * 8);
    if (cmap.readUInt16BE(4 + i * 8) === 3 && cmap.readUInt16BE(at) === 4) sub = at;
  }
  if (sub < 0) throw new Error(`${file}: no Windows format 4 cmap`);
  const segX2 = cmap.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  const glyph = (code: number): number => {
    for (let i = 0; i < segX2 / 2; i++) {
      if (code > cmap.readUInt16BE(ends + i * 2)) continue;
      const start = cmap.readUInt16BE(starts + i * 2);
      if (code < start) return 0;
      const delta = cmap.readInt16BE(deltas + i * 2);
      const range = cmap.readUInt16BE(ranges + i * 2);
      if (range === 0) return (code + delta) & 0xffff;
      const g = cmap.readUInt16BE(ranges + i * 2 + range + (code - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
  const out: Record<string, number> = {};
  for (const ch of chars) {
    const g = glyph(ch.charCodeAt(0));
    if (g === 0) throw new Error(`${file}: no glyph for ${ch}`);
    out[ch] = t.hmtx.data.readUInt16BE(4 * Math.min(g, metrics - 1)) / unitsPerEm;
  }
  return out;
}
