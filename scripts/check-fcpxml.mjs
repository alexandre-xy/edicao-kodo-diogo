#!/usr/bin/env node
// Conferência do pacote DaVinci: lê o FCPXML, recompõe quadros com ffmpeg (V1 com transform/keyframes,
// camadas conectadas por lane, Screen nas transições) e compara com o render de referência.
//   node scripts/check-fcpxml.mjs <fcpxml> <render-referencia.mp4> <saida.jpg> t1,t2,...
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const [FX, REF, OUT, TIMES] = process.argv.slice(2);
const x = readFileSync(FX, "utf8");
const TMP = join(dirname(OUT), "_conferencia");
mkdirSync(TMP, { recursive: true });
const sec = (v) => { if (!v || v === "0s") return 0; const s = v.replace(/s$/, ""); if (s.includes("/")) { const [n, d] = s.split("/"); return +n / +d; } return +s; };
const attr = (tag, name) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1];
const assets = {};
for (const m of x.matchAll(/<asset id="([^"]+)"[^>]*>\s*<media-rep[^>]*src="([^"]+)"/g)) assets[m[1]] = decodeURIComponent(m[2].replace(/^file:\/\/\//, ""));

// spine: itens de primeiro nível e seus filhos conectados
const spineBody = x.slice(x.indexOf("<spine>") + 7, x.indexOf("</spine>"));
const items = [];
const re = /<(asset-clip|gap)\b([^>]*?)(\/?)>/g;
let depth = 0, cur = null, m;
const tagRe = /<(\/?)(asset-clip|gap|video)\b([^>]*?)(\/?)>/g;
while ((m = tagRe.exec(spineBody))) {
  const [, close, name, attrs, self] = m;
  if (close) { depth--; if (depth === 0) { cur.body = spineBody.slice(cur.bodyStart, m.index); items.push(cur); cur = null; } continue; }
  if (depth === 0) { cur = { name, attrs, bodyStart: m.index + m[0].length }; if (self) { cur.body = ""; items.push(cur); cur = null; } else depth++; }
  else if (!self) depth++;
}
const layers = [];
for (const it of items) {
  it.off = sec(attr(it.attrs, "offset")); it.start = sec(attr(it.attrs, "start")); it.dur = sec(attr(it.attrs, "duration")); it.ref = attr(it.attrs, "ref");
  for (const c of it.body.matchAll(/<(asset-clip|video)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g)) {
    const a = c[2], lane = +attr(a, "lane");
    if (!(lane > 0)) continue;
    layers.push({ lane, ref: attr(a, "ref"), abs: it.off + (sec(attr(a, "offset")) - it.start), dur: sec(attr(a, "duration")), screen: /mode="Screen"/.test(c[3] || ""), isStill: /\.png$/i.test(assets[attr(a, "ref")] || "") });
  }
}
const kfInterp = (body, param, tLocal) => {
  const blk = (body.match(new RegExp(`<param name="${param}"><keyframeAnimation>([\\s\\S]*?)</keyframeAnimation>`)) || [])[1];
  if (!blk) return null;
  const ks = [...blk.matchAll(/time="([^"]+)" value="([^"]+)"/g)].map((k) => ({ t: sec(k[1]), v: k[2].split(" ").map(Number) }));
  if (tLocal <= ks[0].t) return ks[0].v;
  for (let i = 1; i < ks.length; i++) if (tLocal <= ks[i].t) { const p = (tLocal - ks[i - 1].t) / (ks[i].t - ks[i - 1].t); return ks[i].v.map((v, j) => ks[i - 1].v[j] + (v - ks[i - 1].v[j]) * p); }
  return ks.at(-1).v;
};
const FPS = 24000 / 1001;
const times = TIMES.split(",").map(Number);
const rows = [];
for (const t of times) {
  const f = Math.round(t * FPS) / FPS + 0.001;
  const it = items.find((i) => f >= i.off && f < i.off + i.dur);
  const base = join(TMP, `b_${t}.png`);
  if (it && it.name === "asset-clip") {
    const tl = it.start + (f - it.off);
    const tf = it.body.match(/<adjust-transform position="([^"]+)" scale="([^"]+)"/);
    const pos = kfInterp(it.body, "position", tl) ?? tf[1].split(" ").map(Number);
    const sc = (kfInterp(it.body, "scale", tl) ?? tf[2].split(" ").map(Number))[0];
    const W = Math.round(1080 * sc / 2) * 2, H = Math.round(1920 * sc / 2) * 2;
    const X = (pos[0] / 100) * 1920, Y = (pos[1] / 100) * 1920;
    const cx = Math.round((W - 1080) / 2 - X), cy = Math.round((H - 1920) / 2 + Y);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", tl.toFixed(4), "-i", assets[it.ref], "-frames:v", "1", "-vf",
      `scale=${W}:${H}:flags=lanczos,pad=max(iw\\,1080+abs(${cx})*2):max(ih\\,1920+abs(${cy})*2):(ow-iw)/2:(oh-ih)/2,crop=1080:1920:(iw-${W})/2+${cx}:(ih-${H})/2+${cy},format=rgba`, base]);
  } else {
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=black:s=1080x1920", "-frames:v", "1", "-pix_fmt", "rgba", base]);
  }
  let curImg = base;
  const act = layers.filter((l) => f >= l.abs && f < l.abs + l.dur).sort((a, b) => a.lane - b.lane);
  act.forEach((l, i) => {
    const nxt = join(TMP, `c_${t}_${i}.png`);
    const inArgs = l.isStill ? ["-i", assets[l.ref]] : ["-ss", (f - l.abs).toFixed(4), "-i", assets[l.ref]];
    const fc = l.screen ? "[1:v]setpts=0,format=gbrp,scale=1080:1920[o];[0:v]setpts=0,format=gbrp[b];[b][o]blend=all_mode=screen,format=rgba" : "[1:v]setpts=0,format=rgba[o];[0:v]setpts=0[b];[b][o]overlay=0:0,format=rgba";
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", curImg, ...inArgs, "-frames:v", "1", "-filter_complex", fc, nxt]);
    curImg = nxt;
  });
  const ref = join(TMP, `r_${t}.png`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(4), "-i", REF, "-frames:v", "1", "-pix_fmt", "rgba", ref]);
  const psnr = (execFileSync("ffmpeg", ["-hide_banner", "-i", curImg, "-i", ref, "-lavfi", "[0:v]format=rgb24[a];[1:v]format=rgb24[b];[a][b]psnr", "-f", "null", "-"], { stdio: ["ignore", "pipe", "pipe"] }).toString() || "");
  rows.push({ t, cur: curImg, ref, layers: act.length });
}
// PSNR via stderr
for (const r of rows) {
  try { execFileSync("ffmpeg", ["-hide_banner", "-i", r.cur, "-i", r.ref, "-lavfi", "[0:v]format=rgb24[a];[1:v]format=rgb24[b];[a][b]psnr", "-f", "null", "-"], { stdio: ["ignore", "ignore", "pipe"] }); } catch {}
  const er = (() => { try { return execFileSync("ffmpeg", ["-hide_banner", "-i", r.cur, "-i", r.ref, "-lavfi", "[0:v]format=rgb24[a];[1:v]format=rgb24[b];[a][b]psnr", "-f", "null", "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { return String(e.stderr); } })();
  r.psnr = (er.match(/average:([\d.inf]+)/) || [])[1];
}
// lado a lado: pacote | v4
const pairs = rows.map((r, i) => `[${2 * i}:v]scale=270:480[a${i}];[${2 * i + 1}:v]scale=270:480[b${i}];[a${i}][b${i}]hstack[p${i}]`);
const n = rows.length;
execFileSync("ffmpeg", ["-v", "error", "-y", ...rows.flatMap((r) => ["-i", r.cur, "-i", r.ref]), "-filter_complex",
  `${pairs.join(";")};${rows.map((_, i) => `[p${i}]`).join("")}xstack=inputs=${n}:layout=${rows.map((_, i) => `${(i % 3) * 540 + (i % 3) * 10}_${Math.floor(i / 3) * 490}`).join("|")}:fill=0x202020`, "-frames:v", "1", OUT]);
for (const r of rows) console.log(`t=${r.t}s · camadas ${r.layers} · PSNR ${r.psnr} dB`);
