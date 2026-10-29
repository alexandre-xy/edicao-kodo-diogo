#!/usr/bin/env node
// frame-sheet — gera uma folha de revisão (JPG único) com prévias de frames de um vídeo,
// em grade, cada frame com legenda "N. tempo  Título" + nota curta.
//
// Uso:
//   node frame-sheet.mjs <video> [opções]
//
// Fonte dos momentos (escolha uma; padrão = --scenes):
//   --beats <arquivo.json>      [{ "t": 3.2, "title": "Abertura", "note": "logo entra" }, ...]
//   --transcript <arquivo.json> palavras do `hyperframes transcribe` → um frame por frase
//   --every <segundos>          um frame a cada N segundos
//   --scenes [limiar]           um frame por corte detectado (limiar padrão 0.3)
//
// Layout:
//   --cols <n>        colunas (padrão: 3 para horizontal, 6 para vertical)
//   --width <px>      largura de cada frame (padrão: 480 horizontal, 300 vertical)
//   --max <n>         limite de frames (padrão 40)
//   --out <arquivo>   saída (padrão: <pasta do vídeo>/<nome>_sheet.jpg)
//
// Requer ffmpeg/ffprobe no PATH. Não altera o vídeo de origem.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename, extname, resolve } from "node:path";

const args = process.argv.slice(2);
if (!args.length || args.includes("-h") || args.includes("--help")) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 19).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}
const video = resolve(args[0]);
const opt = (name, def) => {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
if (!existsSync(video)) throw new Error(`vídeo não encontrado: ${video}`);

// ---------- probe ----------
const probe = JSON.parse(
  execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation:format=duration", "-of", "json", video]).toString(),
);
let { width: vw, height: vh } = probe.streams[0];
const rot = Math.abs(probe.streams[0].side_data_list?.[0]?.rotation ?? 0);
if (rot === 90 || rot === 270) [vw, vh] = [vh, vw];
const duration = parseFloat(probe.format.duration);
const vertical = vh > vw;

const cols = parseInt(opt("--cols", vertical ? 6 : 3));
const tileW = parseInt(opt("--width", vertical ? 300 : 480)) & ~1;
const tileH = Math.round((tileW * vh) / vw / 2) * 2;
const max = parseInt(opt("--max", 40));
const out = resolve(opt("--out", join(dirname(video), `${basename(video, extname(video))}_sheet.jpg`)));

// ---------- momentos ----------
const fmt = (t) => `${t.toFixed(2)}s`;
const clampT = (t) => Math.min(Math.max(t, 0), Math.max(duration - 0.05, 0));
let beats = [];

if (opt("--beats")) {
  beats = JSON.parse(readFileSync(resolve(opt("--beats")), "utf8")).map((b) => ({ t: +b.t, title: b.title ?? "", note: b.note ?? "" }));
} else if (opt("--transcript")) {
  const raw = JSON.parse(readFileSync(resolve(opt("--transcript")), "utf8"));
  const words = Array.isArray(raw) ? raw : raw.words;
  // agrupa palavras em frases: pausa > 0.3s, pontuação, ou frase longa demais
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    const s = cur[0].start, e = cur.at(-1).end;
    beats.push({ t: (s + e) / 2, title: cur.map((w) => w.text).join(" "), note: `${fmt(s)}–${fmt(e)}` });
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(w);
    const nx = words[i + 1];
    const len = w.end - cur[0].start;
    if (!nx || nx.start - w.end > 0.3 || /[.!?]$/.test(w.text) || (len > 2.5 && /,$/.test(w.text)) || len > 4) flush();
  });
} else if (opt("--every")) {
  const step = parseFloat(opt("--every"));
  for (let t = 0; t < duration; t += step) beats.push({ t, title: "", note: "" });
} else {
  const thr = opt("--scenes") === true || !opt("--scenes") ? 0.3 : parseFloat(opt("--scenes"));
  const cuts = [0];
  const err = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-vf", `scale=320:-2,select='gt(scene,${thr})',showinfo`, "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 }).stderr ?? "";
  for (const m of err.matchAll(/pts_time:([\d.]+)/g)) cuts.push(parseFloat(m[1]));
  cuts.forEach((c, i) => {
    const end = cuts[i + 1] ?? duration;
    beats.push({ t: c + Math.min(0.4, (end - c) / 2), title: i === 0 ? "Abertura" : "Corte", note: `${fmt(c)}–${fmt(end)}` });
  });
}

if (beats.length > max) {
  // reduz uniformemente mantendo primeiro e último
  const step = (beats.length - 1) / (max - 1);
  beats = Array.from({ length: max }, (_, i) => beats[Math.round(i * step)]);
}
if (!beats.length) throw new Error("nenhum momento para amostrar");

// ---------- tiles ----------
const tmp = mkdtempSync(join(tmpdir(), "frame-sheet-"));
// ffmpeg roda com cwd=tmp e caminhos relativos: evita escapar "C:" dentro do filtergraph
const fontDir = process.platform === "win32" ? "C:/Windows/Fonts" : "/usr/share/fonts/truetype/dejavu";
const [fb, fr] = process.platform === "win32" ? ["arialbd.ttf", "arial.ttf"] : ["DejaVuSans-Bold.ttf", "DejaVuSans.ttf"];
copyFileSync(join(fontDir, fb), join(tmp, "bold.ttf"));
copyFileSync(join(fontDir, fr), join(tmp, "reg.ttf"));
const capH = 74;
const charsPerLine = Math.floor(tileW / 6.4);
const ellipsize = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
// quebra em até `lines` linhas de `n` caracteres, com reticências no fim se sobrar texto
const wrap = (s, n, lines) => {
  const out = [""];
  for (const w of s.split(/\s+/)) {
    const cur = out.at(-1);
    if (!cur || (cur + " " + w).length <= n) out[out.length - 1] = cur ? cur + " " + w : w;
    else if (out.length < lines) out.push(w);
    else { out[out.length - 1] = ellipsize(cur + " " + w, n); break; }
  }
  return out.join("\n");
};

try {
  beats.forEach((b, i) => {
    const t = clampT(b.t);
    const n = String(i).padStart(3, "0");
    const head = `h${n}.txt`, note = `n${n}.txt`;
    writeFileSync(join(tmp, head), wrap(`${i + 1}. ${fmt(t)}  ${b.title}`, Math.floor(tileW / 8.4), 2));
    writeFileSync(join(tmp, note), ellipsize(b.note || " ", charsPerLine));
    const vf = [
      `scale=${tileW}:${tileH}:force_original_aspect_ratio=decrease`,
      `pad=${tileW}:${tileH + capH}:(ow-iw)/2:0:color=0x1b1b1f`,
      `drawtext=fontfile=bold.ttf:textfile=${head}:x=2:y=${tileH + 9}:fontsize=15:line_spacing=4:fontcolor=0xf2f2f2:expansion=none`,
      `drawtext=fontfile=reg.ttf:textfile=${note}:x=2:y=${tileH + 50}:fontsize=12:fontcolor=0x9a9aa2:expansion=none`,
    ].join(",");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", video, "-frames:v", "1", "-vf", vf, `tile_${n}.png`], { cwd: tmp });
  });

  const rows = Math.ceil(beats.length / cols);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", "1", "-i", join(tmp, "tile_%03d.png"), "-vf", `tile=${cols}x${rows}:margin=20:padding=14:color=0x1b1b1f`, "-frames:v", "1", "-q:v", "2", out]);
  console.log(`ok: ${beats.length} frames, ${cols}x${rows} → ${out}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
