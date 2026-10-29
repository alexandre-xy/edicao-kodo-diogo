#!/usr/bin/env node
// Etapa 8 · Pacote DaVinci Resolve (FCPXML 1.9, validado no Resolve 21).
//   node build-fcpxml.mjs --projeto <p> [--saida <pasta>]   (padrão: DAVINCI_PROJECT/saida/<versão>)
// Requer: <hf>/build/edit.json, conform.json, index.html (com carve), <hf>/build/layers/*.mov (camadas alpha),
// <hf>/build/music_stem.wav (opcional) e a cópia da fonte com o disfarce (blur-original.mjs → DATA/cache).
// Regra: toda mídia vai para media/ com nome ASCII e SEM timecode embutido (timecode ≠ 0 deixa o clipe offline no Resolve).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from "node:fs";
import { join, basename, extname, dirname } from "node:path";
import { loadProjeto, linkOrCopy } from "./lib/projeto.mjs";

const pj = loadProjeto();
const { cfg, tpl } = pj;
const DV = cfg.davinci;
const ROOT = pj.hf;
const si = process.argv.indexOf("--saida");
const PKG = si > 0 ? process.argv[si + 1] : pj.P(`DAVINCI_PROJECT/saida/${DV.versao}`);
const MEDIA = join(PKG, "media");
const GFX = join(MEDIA, "grafismos");
for (const d of [MEDIA, GFX, join(MEDIA, "sfx"), join(MEDIA, "transicoes")]) mkdirSync(d, { recursive: true });

const SRC = pj.src;
const SRCBASE = basename(SRC, extname(SRC));
const edit = JSON.parse(readFileSync(join(ROOT, "build", "edit.json"), "utf8"));
const cf = JSON.parse(readFileSync(join(ROOT, "build", "conform.json"), "utf8"));
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const FD = pj.fpsDen, TB = pj.fpsNum, FPS = TB / FD;
const CW = pj.W, CH = pj.H;
const fr = (t) => Math.round(t * FPS);
const tm = (frames) => (frames === 0 ? "0s" : `${frames * FD}/${TB}s`);
const T = (t) => tm(fr(t));
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fileUrl = (p) => "file:///" + p.replace(/\\/g, "/").split("/").map((seg, i) => (i === 0 ? seg : encodeURIComponent(seg))).join("/");
const probeDur = (p) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).toString());
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const dB = (v) => `${(20 * Math.log10(Math.max(v, 1e-4))).toFixed(1)}dB`;

// remux sem timecode/metadados (regra do pacote)
const noTC = (src, dst) => ff(["-i", src, "-map", "0", "-c", "copy", "-map_metadata", "-1", "-write_tmcd", "0", dst]);
// ---------- mídia ----------
const MULTI = !!edit.segments[0]?.media; // modo Finalização: cada clipe do editor aponta para a sua mídia original
const HAS_BLUR = !MULTI && (cfg.disfarce?.areas || []).length > 0;
const BLUR = join(MEDIA, HAS_BLUR ? `${SRCBASE}_logo-disfarcada.mp4` : "video_original_sem-timecode.mp4");
const BLUR_CACHE = join(pj.data, "cache", `${SRCBASE}_logo-disfarcada.mp4`);
if (HAS_BLUR) { if (!existsSync(BLUR_CACHE)) throw new Error("falta " + BLUR_CACHE + " (rode blur-original.mjs)"); linkOrCopy(BLUR_CACHE, BLUR); }
else if (!MULTI && (!existsSync(BLUR) || statSync(BLUR).size === 0)) ff(["-i", SRC, "-map", "0:v:0", "-map", "0:a:0", "-c", "copy", "-map_metadata", "-1", "-map_metadata:s:v", "-1", "-write_tmcd", "0", BLUR]); // sem disfarce: a fonte, remuxada sem timecode (regra do pacote)
const HAS_MUSIC = !!cfg.trilha?.fonte; // sem fonte = trilha já mixada no bruto
const VOZ = join(MEDIA, HAS_MUSIC ? "voz_original.wav" : "audio_nivelado_14LUFS.wav");
if (!HAS_MUSIC) copyFileSync(join(ROOT, "assets", "voice.wav"), VOZ); // voz+trilha do bruto, loudnorm −14 LUFS / −1,5 dBTP
else if (!existsSync(VOZ)) ff(["-i", SRC, "-vn", "-c:a", "pcm_s16le", "-ar", "48000", VOZ]);
const MUSIC = join(MEDIA, "trilha.mp3");
if (HAS_MUSIC) copyFileSync(join(ROOT, "assets", "music.mp3"), MUSIC);
const TRIDS = Object.keys(cfg.transicoes?.arquivos || {});
for (const id of TRIDS) {
  noTC(join(ROOT, "assets", "tr", `${id}.mp4`), join(MEDIA, "transicoes", `transicao_${id}.mp4`));
  copyFileSync(join(ROOT, "assets", "tr", `${id}.wav`), join(MEDIA, "transicoes", `transicao_${id}_som.wav`));
}
const sfxFiles = [...new Set(cf.sfx.map((s) => s.file))];
for (const f of sfxFiles) copyFileSync(join(ROOT, "assets", "sfx", f), join(MEDIA, "sfx", f));
// faixa escura atrás da legenda (still com alpha, igual ao #scrim: top 790, altura 330)
const SCRIM = join(GFX, "faixa_legenda.png");
{
  const fx = tpl.legenda.faixa, y0 = fx.top, y1 = fx.top + fx.altura, ya = y0 + Math.floor(0.45 * fx.altura), yb = y0 + Math.floor(0.75 * fx.altura);
  ff(["-f", "lavfi", "-i", `color=black:s=${CW}x${CH},format=rgba`, "-frames:v", "1", "-vf",
    `geq=r=0:g=0:b=0:a='if(between(Y,${y0},${y1}), 255*${fx.opacidade.toFixed(2)}*min(1, if(lt(Y,${ya}), (Y-${y0})/${ya - y0}, if(gt(Y,${yb}), (${y1}-Y)/${y1 - yb}, 1))), 0)'`, SCRIM]);
}

// clipes de grafismo: recortes (cópia sem recodificar; ProRes é intra-frame) das camadas alpha
const LAYERS = join(pj.build, "layers");
const cut = (layer, a, b, name) => {
  const out = join(GFX, name);
  ff(["-ss", (fr(a) / FPS).toFixed(5), "-i", join(LAYERS, `${layer}.mov`), "-frames:v", String(fr(b) - fr(a)), "-c", "copy", "-an", "-map_metadata", "-1", "-write_tmcd", "0", out]);
  return { file: out, a, b };
};
const gfx = [];
cf.splits.forEach(([a, b], k) => gfx.push({ lane: 1, name: `Split ${k + 1}`, ...cut("panels", a - 0.05, b + 0.5, `split_${k + 1}.mov`) }));
if (cfg.hook?.x?.length) gfx.push({ lane: 1, name: "Hook — X vermelhos", ...cut("hook", 0, cf.hookEnd + 0.1, "hook_X.mov") });
cf.chunks.forEach((c, k) => gfx.push({ lane: 4, name: `Legenda ${String(k + 1).padStart(2, "0")} — ${c.text}`, ...cut("caps", c.start, c.end, `legenda_${String(k + 1).padStart(2, "0")}.mov`) }));
if (!cf.semCartao) gfx.push({ lane: 5, name: "Cartão final", ...cut("end", cf.endStart, cf.total, "cartao_final.mov") });

// ---------- recursos ----------
const res = [];
const assets = new Map();
let rid = 3;
const asset = (path, kind) => {
  if (assets.has(path)) return assets.get(path);
  const id = `r${rid++}`;
  const dur = probeDur(path);
  const isImg = /\.png$/i.test(path);
  const v = kind !== "audio", a = kind !== "video";
  const fmt = path === BLUR || (MULTI && dirname(path) === MEDIA && /.(mp4|mov|mxf)$/i.test(path)) ? "r2" : "r1";
  res.push(`<asset id="${id}" name="${xml(basename(path))}" start="0s" duration="${isImg ? "0s" : T(dur)}"${v ? ` hasVideo="1" format="${fmt}" videoSources="1"` : ""}${a ? ` hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000"` : ""}><media-rep kind="original-media" src="${fileUrl(path)}"/></asset>`);
  assets.set(path, id);
  return id;
};

// ---------- câmera (reproduz a timeline do HyperFrames) ----------
const segs = edit.segments;
const picStarts = segs.map((s) => s.picTlStart);
const ease = {
  p2io: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  p3io: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  sio: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
};
const lastSeg = segs.length - 1;
const HZ = tpl.camera.hook.zoom, HD = tpl.camera.hook.dur, PF = tpl.camera.pushFinal.zoom - 1;
const cssScale = (t, k) => {
  if (k === 0 && segs[0].keep === "hook") return t < HD ? HZ + (1.0 - HZ) * ease.p2io(Math.max(t, 0) / HD) : 1.0;
  if (k === lastSeg) { const a = picStarts[k], b = edit.duration; return 1 + PF * ease.sio(Math.min(Math.max((t - a) / (b - a), 0), 1)); }
  return 1;
};
const SY = cfg.splitSubida ?? tpl.split.subidaVideo, SIN = tpl.split.entra.dur, SOUT = tpl.split.sai.dur;
const shiftY = (t) => {
  for (const [a, b] of cf.splits) {
    if (t >= a && t < a + SIN) return SY * ease.p3io((t - a) / SIN);
    if (t >= a + SIN && t < b) return SY;
    if (t >= b && t < b + SOUT) return SY * (1 - ease.p3io((t - b) / SOUT));
  }
  return 0;
};
// enquadramento: zoom ancorado no rosto (47% x, 22% y); unidades FCPXML = % da altura do quadro, y para cima
const PX = (cfg.corte.ancora[0] - 0.5) * CW, PY = (cfg.corte.ancora[1] - 0.5) * CH;
const xf = (t, k, baked, base) => {
  if (base) { // clipe do editor (modo Finalização): mantém escala/posição/rotação do XML + câmera e deslocamento do painel
    const z = base.scale * cssScale(t, k);
    return { scale: z, x: base.pos[0], y: base.pos[1] - (shiftY(t) / CH) * 100 };
  }
  const z = baked * cssScale(t, k);
  const dx = (1 - z) * PX, dy = (1 - z) * PY + shiftY(t);
  return { scale: z, x: (dx / CH) * 100, y: (-dy / CH) * 100 };
};

// ---------- spine: V1 (vídeo) + gap do cartão final ----------
const V1 = segs.map((s, k) => {
  const a = picStarts[k], b = k < lastSeg ? picStarts[k + 1] : edit.duration;
  const srcIn = s.picSrcStart ?? s.srcStart + (a - s.tlStart);
  return { k, a, b, srcIn, zoom: s.zoom, keep: s.keep, media: s.media, xf: s.xf };
});
// o P&B do hook vira um clipe próprio (o FCPXML não carrega ajuste de cor): divide o plano 1 em bwStart
if (cf.bwStart != null) {
  const h = V1[0], cutT = fr(cf.bwStart) / FPS;
  V1.splice(0, 1, { ...h, b: cutT }, { ...h, a: cutT, srcIn: h.srcIn + (cutT - h.a), bw: true });
}
const spine = [];
const children = new Map(); // índice do item do spine → [xml]
const spineItems = V1.map((c) => ({ off: fr(c.a), dur: fr(c.b) - fr(c.a), start: fr(c.srcIn) }));
if (!cf.semCartao) spineItems.push({ off: fr(edit.duration), dur: fr(cf.total) - fr(edit.duration), start: 0, gap: true });
const attach = (t, x) => {
  const f = fr(t);
  let i = spineItems.findIndex((s) => f >= s.off && f < s.off + s.dur);
  if (i < 0) i = spineItems.length - 1;
  const s = spineItems[i];
  const local = s.start + (f - s.off);
  if (!children.has(i)) children.set(i, []);
  children.get(i).push(x(tm(local)));
};

const vid = MULTI ? null : asset(BLUR, "video");
const mediaCopy = (p) => { // mídia original do editor → media/ (nome ASCII, sem timecode)
  const base = basename(p, extname(p)).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_");
  const out = join(MEDIA, `${base}${extname(p).toLowerCase()}`);
  if (!existsSync(out) || statSync(out).size === 0) ff(["-i", p, "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-map_metadata", "-1", "-map_metadata:s:v", "-1", "-write_tmcd", "0", out]);
  return out;
};
V1.forEach((c) => {
  if (c.bw) c.k = 0;
  // amostra o transform: início, fim e pontos intermediários nas janelas animadas
  const times = new Set([c.a, c.b - 1 / FPS]);
  const addWin = (a, d, n = 6) => { for (let i = 0; i <= n; i++) { const t = a + (d * i) / n; if (t > c.a && t < c.b) times.add(t); } };
  if (c.k === 0 && segs[0].keep === "hook") addWin(0, HD);
  if (c.k === lastSeg) addWin(c.a, c.b - c.a, 8);
  for (const [a, b] of cf.splits) { addWin(a, SIN); addWin(b, SOUT); }
  const ts = [...times].sort((p, q) => p - q);
  const vals = ts.map((t) => ({ t, ...xf(t, c.k, c.zoom, c.xf) }));
  const constant = vals.every((v) => Math.abs(v.scale - vals[0].scale) < 1e-4 && Math.abs(v.y - vals[0].y) < 1e-3);
  const v0 = vals[0];
  const kt = (t) => tm(fr(c.srcIn) + (fr(t) - fr(c.a)));
  const kf = constant ? "" :
    `<param name="position"><keyframeAnimation>${vals.map((v) => `<keyframe time="${kt(v.t)}" value="${v.x.toFixed(3)} ${v.y.toFixed(3)}"/>`).join("")}</keyframeAnimation></param>` +
    `<param name="scale"><keyframeAnimation>${vals.map((v) => `<keyframe time="${kt(v.t)}" value="${v.scale.toFixed(4)} ${v.scale.toFixed(4)}"/>`).join("")}</keyframeAnimation></param>`;
  const marker = c.bw ? `<marker start="${tm(fr(c.srcIn))}" duration="${tm(fr(c.b) - fr(c.a))}" value="P&amp;B: aplicar Saturação 0 e Contraste 1,12 neste clipe (página Color)"/>` : "";
  spine.push({ i: V1.indexOf(c), open: `<asset-clip ref="${c.media ? asset(mediaCopy(c.media), "video") : vid}" name="${xml(`V1 ${String(c.k + 1).padStart(2, "0")}${c.bw ? "b · P&B" : ""} · ${c.keep} · zoom ${c.zoom}`)}" offset="${tm(fr(c.a))}" start="${tm(fr(c.srcIn))}" duration="${tm(fr(c.b) - fr(c.a))}" tcFormat="NDF">` +
    `<adjust-transform${c.xf?.rot ? ` rotation="${c.xf.rot}"` : ""} position="${v0.x.toFixed(3)} ${v0.y.toFixed(3)}" scale="${v0.scale.toFixed(4)} ${v0.scale.toFixed(4)}">${kf}</adjust-transform>${marker}`, close: "</asset-clip>" });
});
if (!cf.semCartao) spine.push({ i: spineItems.length - 1, open: `<gap name="Cartão final" offset="${tm(spineItems.at(-1).off)}" start="0s" duration="${tm(spineItems.at(-1).dur)}">`, close: "</gap>" });

// ---------- vídeo conectado ----------
gfx.forEach((g) => {
  const id = asset(g.file, "video");
  attach(g.a, (o) => `<asset-clip ref="${id}" lane="${g.lane}" name="${xml(g.name)}" offset="${o}" start="0s" duration="${tm(fr(g.b) - fr(g.a))}"/>`);
});
cf.transitions.forEach((t) => {
  const k = t.id;
  const id = asset(join(MEDIA, "transicoes", `transicao_${k}.mp4`), "video");
  attach(t.start, (o) => `<asset-clip ref="${id}" lane="2" name="Transição ${k} (Composite: Screen)" offset="${o}" start="0s" duration="${T(t.dur)}"><adjust-blend amount="1" mode="Screen"/></asset-clip>`);
});
{
  const id = asset(SCRIM, "video");
  attach(0, (o) => `<video ref="${id}" lane="3" name="Faixa escura da legenda" offset="${o}" start="0s" duration="${T(cf.endStart)}"/>`);
}

// ---------- áudio ----------
const voz = asset(VOZ, "audio");
const VOICE_GAIN = HAS_MUSIC ? DV.ganhoVoz : "0dB"; // ganho do loudnorm da voz (entrada medida → alvo do projeto)
// trilha já mixada (audio_nivelado = áudio da timeline, alinhado ao tempo 0): UM clipe contínuo; o tempo da mídia original NÃO vale aqui
if (!HAS_MUSIC) attach(0, (o) => `<asset-clip ref="${voz}" lane="-1" name="Áudio nivelado (voz + trilha)" offset="${o}" start="0s" duration="${T(edit.duration)}"><adjust-volume amount="${VOICE_GAIN}"/></asset-clip>`);
else segs.forEach((s, k) => {
  attach(s.tlStart, (o) => `<asset-clip ref="${voz}" lane="-1" name="${xml(`Voz ${String(k + 1).padStart(2, "0")}`)}" offset="${o}" start="${T(s.srcStart)}" duration="${tm(fr(s.tlEnd) - fr(s.tlStart))}"><adjust-volume amount="${VOICE_GAIN}"/></asset-clip>`);
});
if (HAS_MUSIC) {
// trilha: −8,4 dB + envelope do ducking (lane fx.n4.gain do carve) + fade-out final
const musicTag = html.match(/<audio id="music"[^>]*>/)[0];
const autoRaw = (musicTag.match(/data-automation='([^']*)'/) || musicTag.match(/data-automation="([^"]*)"/))[1].replace(/&quot;/g, '"');
const lane = JSON.parse(autoRaw).lanes.find((l) => l.target === "fx.n4.gain");
const mus = asset(MUSIC, "audio");
const MG = { ...tpl.trilha, ...(cfg.trilha || {}) };
const pts = lane.points.map((p) => ({ t: p.t, v: MG.ganhoDb + p.v }));
const fadeA = cf.total - MG.fadeOut;
const musicKf = [...pts.filter((p) => p.t < fadeA), { t: fadeA, v: MG.ganhoDb }, { t: cf.total - 0.05, v: -60 }]
  .map((p) => `<keyframe time="${T(p.t)}" value="${p.v.toFixed(1)}dB"/>`).join("");
attach(0, (o) => `<asset-clip ref="${mus}" lane="-2" name="Trilha (ducking em keyframes)" offset="${o}" start="0s" duration="${T(cf.total)}"><adjust-volume amount="${MG.ganhoDb}dB"><param name="amount"><keyframeAnimation>${musicKf}</keyframeAnimation></param></adjust-volume></asset-clip>`);
// reserva: trilha já com ducking/carve aplicados (stem do HyperFrames), mutada
const STEM = join(MEDIA, "trilha_com-ducking_RESERVA.wav");
if (existsSync(join(pj.build, "music_stem.wav"))) {
  copyFileSync(join(pj.build, "music_stem.wav"), STEM);
  const st = asset(STEM, "audio");
  attach(0, (o) => `<asset-clip ref="${st}" lane="-20" name="RESERVA trilha c/ ducking (mutada)" offset="${o}" start="0s" duration="${T(cf.total)}" enabled="0"/>`);
}
}
// efeitos: distribui em trilhas sem sobreposição (−3, −4, …)
const laneEnds = [];
const placeLane = (a, b) => { let i = laneEnds.findIndex((e) => e <= fr(a)); if (i < 0) { laneEnds.push(0); i = laneEnds.length - 1; } laneEnds[i] = fr(b); return -3 - i; };
const sfxItems = [
  ...cf.sfx.map((s) => ({ path: join(MEDIA, "sfx", s.file), t: s.t, dur: s.dur, vol: s.vol, ms: 0, name: s.file.replace(/\.(mp3|wav)$/, "") })),
  ...cf.transitions.map((t) => ({ path: join(MEDIA, "transicoes", `transicao_${t.id}_som.wav`), t: t.start, dur: t.dur, vol: t.vol, name: `som transição ${t.id}` })),
].sort((p, q) => p.t - q.t);
for (const s of sfxItems) {
  const id = asset(s.path, "audio");
  const real = Math.min(s.dur, probeDur(s.path));
  const ln = placeLane(s.t, s.t + real);
  attach(s.t, (o) => `<asset-clip ref="${id}" lane="${ln}" name="${xml(s.name)}" offset="${o}" start="0s" duration="${T(real)}"><adjust-volume amount="${dB(s.vol)}"/></asset-clip>`);
}

// ---------- FCPXML ----------
const spineXml = spine.map((s) => s.open + (children.get(s.i) || []).join("") + s.close).join("\n        ");
const out = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="Saída ${CW}x${CH} ${FPS.toFixed(3)}" frameDuration="${FD}/${TB}s" width="${CW}" height="${CH}" colorSpace="1-1-1 (Rec. 709)"/>
    <format id="r2" name="Fonte ${cfg.fonte.largura}x${cfg.fonte.altura} ${FPS.toFixed(3)}" frameDuration="${FD}/${TB}s" width="${cfg.fonte.largura}" height="${cfg.fonte.altura}" colorSpace="1-1-1 (Rec. 709)"/>
    ${res.join("\n    ")}
  </resources>
  <library>
    <event name="${xml(DV.evento)}">
      <project name="${xml(DV.projeto)}">
        <sequence format="r1" duration="${T(cf.total)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
        ${spineXml}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
writeFileSync(join(PKG, `${DV.projeto}.fcpxml`), out);

// ---------- legendas.srt ----------
const srtT = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
writeFileSync(join(PKG, "legendas.srt"), cf.chunks.map((c, k) => `${k + 1}\n${srtT(c.start)} --> ${srtT(c.end)}\n${c.text}\n`).join("\n"));
console.log(`ok: ${V1.length} cortes no V1 · ${gfx.length} grafismos · ${cf.transitions.length} transições · ${sfxItems.length} sfx em ${laneEnds.length} trilhas · ${res.length} mídias`);
