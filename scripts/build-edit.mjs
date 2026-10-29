#!/usr/bin/env node
// Etapa 5 · Corte. Monta o corte a partir do original, tudo parametrizado por DATA/projeto.json (bloco "corte").
//   node align-words.mjs --projeto <p>            → <hf>/build/words.json + silences.json
//   node build-edit.mjs --projeto <p>             → calcula e grava <hf>/build/edit.json (dry run)
//   node build-edit.mjs --projeto <p> --render    → também gera <hf>/assets/picture.mp4 e voice.wav
//
// - Cortes travados em palavras (texto Whisper, tempos Parakeet) e nos silêncios reais do áudio.
// - Silêncios ≥ 0,30 s dentro dos trechos mantidos viram jump cut (com troca de enquadramento).
// - J cut de 3 frames nos cortes de silêncio (o som do próximo trecho entra antes da imagem).
// - Enquadramentos estáticos recortados do 4K (máx. 1,2x) e logo do fundo desfocada antes do recorte.
// - Imagem em 1296x2304 (1,2x do 1080) para os zooms animados no HyperFrames não perderem nitidez.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { trackOffset } from "./track-bg.mjs";
import { loadProjeto } from "./lib/projeto.mjs";

const pj = loadProjeto();
const C = pj.cfg.corte;
const ROOT = pj.hf;
const SRC = pj.src;
const BUILD = pj.build;
const RENDER = pj.flag("--render");
mkdirSync(BUILD, { recursive: true });
mkdirSync(join(ROOT, "assets"), { recursive: true });

const FPS_NUM = pj.fpsNum, FPS_DEN = pj.fpsDen;
const FPS = FPS_NUM / FPS_DEN;
const SRC_W = pj.cfg.fonte.largura, SRC_H = pj.cfg.fonte.altura;
const [OUT_W, OUT_H] = C.intermediario; // ex.: 1,2x da saída, para zooms animados sem perda
const SRC_DUR = pj.cfg.fonte.duracao;
const J_FRAMES = C.jFrames;

const words = JSON.parse(readFileSync(join(BUILD, "words.json"), "utf8"));
const sil = JSON.parse(readFileSync(join(BUILD, "silences.json"), "utf8"));
const q = (t, mode) => (mode === "floor" ? Math.floor(t * FPS + 1e-6) : Math.ceil(t * FPS - 1e-6)); // frames

// ---------- trechos mantidos (índices de palavras; in/out manuais onde a vizinha é enchimento) ----------
const KEEPS = C.trechos; // [{ id, from, to, in?, out?, tail?, nota? }] por índice de palavra
const MIN_PIECE = C.minPedaco, PAD_OUT = C.folgaSaida, PAD_IN = C.folgaEntrada, MIN_SIL = C.silencioMin;

// ---------- segmentos de áudio (em frames de origem) ----------
const segs = [];
for (const k of KEEPS) {
  const a = k.in ?? Math.max(words[k.from].start - PAD_IN, 0);
  const b = k.out ?? Math.min(words[k.to].end + (k.tail ?? PAD_OUT), SRC_DUR - 0.03);
  const pieces = [];
  let cur = a;
  for (const [s0, s1] of sil) {
    if (s1 - s0 < MIN_SIL || s0 <= a || s1 >= b) continue;
    if (s0 + PAD_OUT - cur < MIN_PIECE || b - (s1 - PAD_IN) < MIN_PIECE) continue;
    pieces.push([cur, s0 + PAD_OUT]);
    cur = s1 - PAD_IN;
  }
  pieces.push([cur, b]);
  pieces.forEach(([s0, s1], i) => segs.push({ keep: k.id, a: q(s0, "floor"), b: q(s1, "ceil"), joinBefore: i === 0 ? "hard" : "silence" }));
}

// ---------- enquadramentos ----------
// v3: só dois enquadramentos próximos (1,0 ↔ 1,05) alternando a cada corte; viradas de raciocínio ganham transição overlay
let tl = 0;
segs.forEach((s, i) => {
  s.tlStart = tl;
  tl += s.b - s.a;
  s.zoom = C.zooms[i % C.zooms.length];
});
const totalFrames = tl;

// imagem: J cut desloca a fronteira de imagem J_FRAMES depois da fronteira de som
const pics = segs.map((s) => ({ a: s.a, b: s.b, zoom: s.zoom }));
for (let i = 1; i < segs.length; i++) {
  if (segs[i].joinBefore !== "silence") continue;
  const d = Math.min(J_FRAMES, segs[i].b - segs[i].a - 6);
  if (d <= 0) continue;
  pics[i - 1].b += d;
  pics[i].a += d;
  segs[i].jFrames = d;
}

// ---------- palavras na timeline (pelo som) ----------
const tlWords = [];
for (const s of segs) {
  const a = s.a / FPS, b = s.b / FPS, off = s.tlStart / FPS - a;
  for (const w of words) {
    const mid = (w.start + w.end) / 2;
    if (mid >= a && mid <= b) tlWords.push({ i: w.i, text: w.text, start: +(Math.max(w.start, a) + off).toFixed(3), end: +(Math.min(w.end, b) + off).toFixed(3), seg: segs.indexOf(s) });
  }
}

const edit = {
  fps: `${FPS_NUM}/${FPS_DEN}`,
  totalFrames,
  duration: +(totalFrames / FPS).toFixed(4),
  segments: segs.map((s, i) => ({
    keep: s.keep, join: s.joinBefore, jFrames: s.jFrames ?? 0, zoom: s.zoom,
    srcStart: +(s.a / FPS).toFixed(4), srcEnd: +(s.b / FPS).toFixed(4),
    tlStart: +(s.tlStart / FPS).toFixed(4), tlEnd: +((s.tlStart + s.b - s.a) / FPS).toFixed(4),
    picTlStart: +((s.tlStart + (pics[i].a - s.a)) / FPS).toFixed(4),
  })),
  words: tlWords,
};
writeFileSync(join(BUILD, "edit.json"), JSON.stringify(edit, null, 1));
console.log(`${segs.length} segmentos · ${edit.duration.toFixed(2)} s`);
if (pj.flag("--verbose")) for (const s of edit.segments) {
  const txt = tlWords.filter((w) => w.seg === edit.segments.indexOf(s)).map((w) => w.text).join(" ");
  console.log(`${s.keep.padEnd(4)} ${s.join[0]} j${s.jFrames} z${s.zoom.toFixed(2)}  src ${s.srcStart.toFixed(2)}–${s.srcEnd.toFixed(2)}  tl ${s.tlStart.toFixed(2)}–${s.tlEnd.toFixed(2)}  ${txt}`);
}
if (!RENDER) process.exit(0);

// ---------- render da imagem ----------
// logo "swell" no vidro e texto "…astral", medidos no frame de referência (t = 20 s, coordenadas do 4K).
// A câmera deriva: cada segmento desloca as áreas pelo rastreio do fundo (início, meio e fim do plano).
const BLURS_REF = pj.cfg.disfarce.areas; // medidas no quadro de referência (disfarce.rastreio.ref_t), em px da fonte
let BLURS = BLURS_REF;
function blursFor(a, b) {
  if (!BLURS_REF.length) return [];
  const offs = [a + 0.05, (a + b) / 2, b - 0.05].map((t) => trackOffset(t));
  return BLURS_REF.map((r) => {
    const x0 = Math.min(...offs.map((o) => r.x + o.dx)) - 20, y0 = Math.min(...offs.map((o) => r.y + o.dy)) - 20;
    const x1 = Math.max(...offs.map((o) => r.x + o.dx + r.w)) + 20, y1 = Math.max(...offs.map((o) => r.y + o.dy + r.h)) + 20;
    const cx = Math.max(0, x0), cy = Math.max(0, y0);
    const w = Math.min(SRC_W, x1) - cx, h = Math.min(SRC_H, y1) - cy;
    return { ...r, x: cx & ~1, y: cy & ~1, w: (w & ~1), h: (h & ~1) };
  }).filter((r) => r.w > 40 && r.h > 40);
}
function blurChain(input) {
  if (!BLURS.length) return { graph: `[${input}]null[base]`, out: "base" };
  const parts = [`[${input}]split=${BLURS.length + 1}[base]${BLURS.map((_, i) => `[r${i}]`).join("")}`];
  BLURS.forEach((b, i) => {
    parts.push(
      `[r${i}]crop=${b.w}:${b.h}:${b.x}:${b.y},gblur=sigma=${b.sigma},format=yuva420p,` +
        `geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*min(1,min(min(X,W-1-X),min(Y,H-1-Y))/${b.feather})'[b${i}]`,
    );
  });
  let last = "base";
  BLURS.forEach((b, i) => {
    parts.push(`[${last}][b${i}]overlay=${b.x}:${b.y}[o${i}]`);
    last = `o${i}`;
  });
  return { graph: parts.join(";"), out: last };
}
const [AX, AY] = C.ancora; // âncora do zoom (rosto), fração da largura/altura
const list = [];
pics.forEach((p, i) => {
  const out = join(BUILD, `seg_${String(i).padStart(3, "0")}.mp4`);
  const n = p.b - p.a;
  const cw = Math.round(SRC_W / p.zoom / 2) * 2, ch = Math.round((cw * OUT_H) / OUT_W / 2) * 2;
  const cx = Math.round(AX * (SRC_W - cw)), cy = Math.round(AY * (SRC_H - ch));
  BLURS = blursFor(p.a / FPS, p.b / FPS);
  const { graph, out: o } = blurChain("0:v");
  const fc = `${graph};[${o}]crop=${cw}:${ch}:${cx}:${cy},scale=${OUT_W}:${OUT_H}:flags=lanczos,setsar=1,format=yuv420p[v]`;
  const ss = Math.max(p.a / FPS - 0.0005, 0).toFixed(4);
  if (!existsSync(out) || process.argv.includes("--force")) {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", ss, "-i", SRC, "-filter_complex", fc, "-map", "[v]", "-frames:v", String(n),
      "-r", `${FPS_NUM}/${FPS_DEN}`, "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-g", "12", "-bf", "0",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-an", out]);
  }
  list.push(`file '${out.replace(/\\/g, "/")}'`);
  process.stdout.write(`\rimagem ${i + 1}/${pics.length}`);
});
writeFileSync(join(BUILD, "concat.txt"), list.join("\n"));
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", join(BUILD, "concat.txt"), "-c", "copy", join(ROOT, "assets", "picture.mp4")]);
console.log("\nimagem ok");

// ---------- voz ----------
const FADE = 0.006;
const LN = { I: pj.cfg.saida.loudness, TP: pj.cfg.saida.picoTP, LRA: 7 };
const af = segs.map((s, i) => {
  const a = s.a / FPS, b = s.b / FPS, d = b - a;
  return `[0:a]atrim=start=${a.toFixed(5)}:end=${b.toFixed(5)},asetpts=PTS-STARTPTS,afade=t=in:d=${FADE},afade=t=out:st=${(d - FADE).toFixed(5)}:d=${FADE}[a${i}]`;
});
const voiceRaw = join(BUILD, "voice_raw.wav");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", SRC, "-filter_complex", `${af.join(";")};${segs.map((_, i) => `[a${i}]`).join("")}concat=n=${segs.length}:v=0:a=1[a]`, "-map", "[a]", "-ar", "48000", voiceRaw]);
// loudnorm em duas passadas: −14 LUFS, pico ≤ −1 dBTP
const m = spawnSync("ffmpeg", ["-hide_banner", "-i", voiceRaw, "-af", `loudnorm=I=${LN.I}:TP=${LN.TP}:LRA=${LN.LRA}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr;
const ln = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", voiceRaw, "-af",
  `loudnorm=I=${LN.I}:TP=${LN.TP}:LRA=${LN.LRA}:measured_I=${ln.input_i}:measured_TP=${ln.input_tp}:measured_LRA=${ln.input_lra}:measured_thresh=${ln.input_thresh}:offset=${ln.target_offset}:linear=true,aresample=48000`,
  "-ar", "48000", join(ROOT, "assets", "voice.wav")]);
console.log(`voz ok (entrada ${ln.input_i} LUFS → ${LN.I})`);
