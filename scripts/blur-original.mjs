#!/usr/bin/env node
// Gera uma cópia 4K do original com a logo do fundo disfarçada (mesmo rastreio do build-edit),
// para a timeline do DaVinci apontar para ela e os cortes continuarem editáveis. Vídeo apenas.
//   node blur-original.mjs --projeto <p> [--saida <arquivo.mp4>] [--blocos N]
//   (padrão: DATA/cache/<nome>_logo-disfarcada.mp4; --blocos N gera só os N primeiros blocos, para teste)
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { trackOffset } from "./track-bg.mjs";
import { loadProjeto } from "./lib/projeto.mjs";

const pj = loadProjeto();
const SRC = pj.src;
const oi = process.argv.indexOf("--saida");
const OUT = oi > 0 ? process.argv[oi + 1] : join(pj.data, "cache", `${basename(SRC, extname(SRC))}_logo-disfarcada.mp4`);
const bi = process.argv.indexOf("--blocos");
const MAX_BLOCOS = bi > 0 ? Number(process.argv[bi + 1]) : Infinity;
const TMP = join(pj.data, "cache", "blurorig");
mkdirSync(TMP, { recursive: true });
const FPS = pj.fps, SRC_W = pj.cfg.fonte.largura, SRC_H = pj.cfg.fonte.altura;
const TOTAL_FRAMES = Math.floor(parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", SRC]).toString()) * FPS);
const CHUNK = 48;
const BLURS_REF = pj.cfg.disfarce.areas;
function blursFor(a, b) {
  const offs = [a + 0.02, (a + b) / 2, Math.max(a + 0.02, b - 0.02)].map((t) => trackOffset(t));
  return BLURS_REF.map((r) => {
    const x0 = Math.min(...offs.map((o) => r.x + o.dx)) - 20, y0 = Math.min(...offs.map((o) => r.y + o.dy)) - 20;
    const x1 = Math.max(...offs.map((o) => r.x + o.dx + r.w)) + 20, y1 = Math.max(...offs.map((o) => r.y + o.dy + r.h)) + 20;
    const cx = Math.max(0, x0), cy = Math.max(0, y0);
    return { ...r, x: cx & ~1, y: cy & ~1, w: (Math.min(SRC_W, x1) - cx) & ~1, h: (Math.min(SRC_H, y1) - cy) & ~1 };
  }).filter((r) => r.w > 40 && r.h > 40);
}
const list = [];
for (let f = 0, k = 0; f < TOTAL_FRAMES && k < MAX_BLOCOS; f += CHUNK, k++) {
  const n = Math.min(CHUNK, TOTAL_FRAMES - f);
  const a = f / FPS, b = (f + n) / FPS;
  const out = join(TMP, `c_${String(k).padStart(3, "0")}.mp4`);
  if (!existsSync(out)) {
    const B = blursFor(a, Math.min(b, pj.cfg.transcricao.duracao));
    const parts = [`[0:v]split=${B.length + 1}[base]${B.map((_, i) => `[r${i}]`).join("")}`];
    B.forEach((r, i) => parts.push(`[r${i}]crop=${r.w}:${r.h}:${r.x}:${r.y},gblur=sigma=${r.sigma},format=yuva420p,geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*min(1,min(min(X,W-1-X),min(Y,H-1-Y))/${r.feather})'[b${i}]`));
    let last = "base";
    B.forEach((r, i) => { parts.push(`[${last}][b${i}]overlay=${r.x}:${r.y}[o${i}]`); last = `o${i}`; });
    parts.push(`[${last}]format=yuv420p[v]`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", Math.max(a - 0.0005, 0).toFixed(4), "-i", SRC, "-filter_complex", parts.join(";"), "-map", "[v]", "-frames:v", String(n),
      "-r", pj.fpsStr, "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-g", "24", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-an", out]);
  }
  list.push(`file '${out.replace(/\\/g, "/")}'`);
  process.stdout.write(`\rbloco ${k + 1}/${Math.ceil(TOTAL_FRAMES / CHUNK)}`);
}
writeFileSync(join(TMP, "list.txt"), list.join("\n"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(TMP, "list.txt"), "-c", "copy", OUT]);
console.log(`\nok → ${OUT} (${TOTAL_FRAMES} frames)`);
