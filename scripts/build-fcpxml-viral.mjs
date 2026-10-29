#!/usr/bin/env node
// Etapa 8 · Pacote DaVinci Resolve do MOTOR VIRAL (FCPXML 1.9).
//   node build-fcpxml-viral.mjs --projeto <p> [--saida <pasta>]   (padrão: DAVINCI_PROJECT/saida/<versão>)
// Requer: <hf>/build/edit.json, conform.json (do build-comp-viral), <hf>/build/layers/{degrade,faixa,fundo,ui,caps}.mov (camadas alpha:
//   `render -c layer-<x>.html --format mov -f <fps> -q draft -o build/layers/<x>.mov`), <hf>/assets/{voice.wav,music_bed.wav,sfx/}.
// V1 = mídias ORIGINAIS do editor nos cortes finais (se houver DATA/blocos.json), com o recorte do orador (meia tela) em keyframes;
// senão V1 = assets/picture.mp4. Toda mídia vai para media/ com nome ASCII e SEM timecode.
// Faixas: V1 vídeo · lane 1 faixa da legenda · 2 degradê · 3/4 cenas (painéis/tela cheia) · 5 UI · 6 legendas · áudio: −1 voz · −2 trilha (envelope) · −3… SFX.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, basename, extname, dirname } from "node:path";
import { loadProjeto } from "./lib/projeto.mjs";

const pj = loadProjeto();
const { cfg, tpl } = pj;
const DV = cfg.davinci;
const ROOT = pj.hf;
const si = process.argv.indexOf("--saida");
const PKG = si > 0 ? process.argv[si + 1] : pj.P(`DAVINCI_PROJECT/saida/${DV.versao}`);
const MEDIA = join(PKG, "media"), GFX = join(MEDIA, "grafismos"), SFXD = join(MEDIA, "sfx");
for (const d of [MEDIA, GFX, SFXD]) mkdirSync(d, { recursive: true });

const edit = JSON.parse(readFileSync(join(ROOT, "build", "edit.json"), "utf8"));
const cf = JSON.parse(readFileSync(join(ROOT, "build", "conform.json"), "utf8"));
const FD = pj.fpsDen, TB = pj.fpsNum, FPS = TB / FD, CW = pj.W, CH = pj.H;
const fr = (t) => Math.round(t * FPS);
const tm = (f) => (f === 0 ? "0s" : `${f * FD}/${TB}s`);
const T = (t) => tm(fr(t));
const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fileUrl = (p) => "file:///" + p.replace(/\\/g, "/").split("/").map((seg, i) => (i === 0 ? seg : encodeURIComponent(seg))).join("/");
const ff = (a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a]);
const probe = (p, e) => execFileSync("ffprobe", ["-v", "error", "-show_entries", e, "-of", "csv=p=0", p]).toString().trim();
const probeDur = (p) => parseFloat(probe(p, "format=duration"));
const dB = (v) => `${(20 * Math.log10(Math.max(v, 1e-4))).toFixed(1)}dB`;
const safe = (s) => basename(s, extname(s)).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_");

// ---------- easing (nomes do GSAP usados no motor) ----------
const EASE = {
  none: (x) => x, "power1.out": (x) => 1 - (1 - x) ** 2, "power2.out": (x) => 1 - (1 - x) ** 3, "power3.out": (x) => 1 - (1 - x) ** 4,
  "power1.in": (x) => x * x, "power2.in": (x) => x ** 3, "power3.in": (x) => x ** 4,
  "power2.inOut": (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2), "power3.inOut": (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),
  "sine.inOut": (x) => -(Math.cos(Math.PI * x) - 1) / 2,
};
// GSAP: power1=quad, power2=cubic, power3=quart
const ez = (n, x) => (EASE[n] ?? EASE.none)(Math.min(Math.max(x, 0), 1));
const camAt = (t) => { // estado do recorte do orador (px/escala) no tempo t
  let st = { y: 0, s: 1 };
  for (const e of cf.cam) {
    if (t < e.a) break;
    if (t >= e.b) st = { y: e.y1, s: e.s1 };
    else { const k = ez(e.ease, (t - e.a) / (e.b - e.a)); st = { y: e.y0 + (e.y1 - e.y0) * k, s: e.s0 + (e.s1 - e.s0) * k }; }
  }
  return st;
};
const PYanch = cf.ancora - CH / 2; // âncora do recorte (y para baixo, a partir do centro)
const xfAt = (t, base) => { // unidades FCPXML: % da altura, y para cima
  const c = camAt(t), z = base.scale * c.s, dy = (1 - c.s) * PYanch + c.y;
  return { scale: z, x: base.pos[0], y: base.pos[1] - (dy / CH) * 100 };
};

// ---------- V1: originais do editor nos cortes finais ----------
const blocosFile = pj.P("DATA/blocos.json");
let XMLSTART = new Map();
const entrada = pj.P("DAVINCI_PROJECT/entrada");
if (existsSync(entrada)) {
  const x = readdirSync(entrada).find((f) => /\.fcpxml$/i.test(f));
  if (x) for (const m of readFileSync(join(entrada, x), "utf8").matchAll(/<asset [^>]*?name="([^"]*)"[^>]*?start="([^"]*)"/g)) {
    const v = m[2].replace(/s$/, ""); XMLSTART.set(m[1], v.includes("/") ? +v.split("/")[0] / +v.split("/")[1] : +v);
  }
}
const segs = edit.segments, picStarts = segs.map((s) => s.picTlStart);
const pieces = [];
const clipsB = existsSync(blocosFile) ? JSON.parse(readFileSync(blocosFile, "utf8")).blocos[0]?.clips : null;
if (clipsB) {
  segs.forEach((s, k) => {
    const a = picStarts[k], b = k + 1 < segs.length ? picStarts[k + 1] : edit.duration;
    const srcMix = s.picSrcStart ?? s.srcStart + (a - s.tlStart); // tempo da MIXDOWN que está na imagem em `a`
    for (const c of clipsB) {
      const o0 = Math.max(srcMix, c.off), o1 = Math.min(srcMix + (b - a), c.off + c.dur);
      if (o1 - o0 < 1 / FPS) continue;
      const tc = XMLSTART.get(c.nome) ?? 0;
      pieces.push({ a: a + (o0 - srcMix), b: a + (o1 - srcMix), media: c.midia, rel: c.srcIn + (o0 - c.off) - tc, xf: c.xf, nome: c.nome });
    }
  });
} else pieces.push({ a: 0, b: edit.duration, media: join(ROOT, "assets", "picture.mp4"), rel: 0, xf: { scale: 1, pos: [0, 0], rot: 0 }, nome: "picture" });
// emenda sem buracos (arredonda em quadros)
pieces.sort((p, q) => p.a - q.a);
for (let i = 0; i < pieces.length; i++) { pieces[i].a = i === 0 ? 0 : pieces[i - 1].b; pieces[i].b = i + 1 < pieces.length ? fr(pieces[i + 1].a) / FPS : edit.duration; }

// ---------- mídia ----------
const res = [], assets = new Map(), fmts = new Map();
let rid = 3;
const sizeFmt = (w, h) => { const k = `${w}x${h}`; if (!fmts.has(k)) fmts.set(k, `r${fmts.size + 1}`); return fmts.get(k); };
sizeFmt(CW, CH); // r1 = saída
const asset = (path, kind, wh) => {
  if (assets.has(path)) return assets.get(path);
  const id = `r${rid++}`, dur = probeDur(path), v = kind !== "audio", a = kind !== "video";
  let [w, h] = wh ?? (v ? probe(path, "stream=width,height").split(",").map(Number) : [CW, CH]);
  if (v && !wh && /(^|,)-?90(,|$)/.test(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream_side_data=rotation", "-of", "csv=p=0", path]).toString().trim())) [w, h] = [h, w]; // vídeo gravado deitado com rotação -90 = retrato
  res.push(`<asset id="${id}" name="${xml(basename(path))}" start="0s" duration="${T(dur)}"${v ? ` hasVideo="1" format="${sizeFmt(w, h)}" videoSources="1"` : ""}${a ? ` hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000"` : ""}><media-rep kind="original-media" src="${fileUrl(path)}"/></asset>`);
  assets.set(path, id);
  return id;
};
const mediaCopy = (p) => {
  const out = join(MEDIA, `${safe(p)}${extname(p).toLowerCase()}`);
  if (!existsSync(out) || statSync(out).size === 0) ff(["-i", p, "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-map_metadata", "-1", "-map_metadata:s:v", "-1", "-write_tmcd", "0", out]);
  return out;
};

// camadas: recortes (cópia; ProRes é intra-frame) das camadas alpha
const LAYERS = join(pj.build, "layers");
const cut = (layer, a, b, name) => {
  const out = join(GFX, name);
  ff(["-ss", (fr(a) / FPS).toFixed(5), "-i", join(LAYERS, `${layer}.mov`), "-frames:v", String(Math.max(fr(b) - fr(a), 1)), "-c", "copy", "-an", "-map_metadata", "-1", "-write_tmcd", "0", out]);
  return { file: out, a, b };
};
const gfx = [];
cf.layers.faixa.forEach((l, k) => gfx.push({ lane: 1, name: `Faixa escura da legenda ${k + 1}`, ...cut("faixa", l.a, l.b, `faixa_legenda_${k + 1}.mov`) }));
cf.layers.degrade.forEach((l, k) => gfx.push({ lane: 2, name: `Degradê escuro (UI) ${k + 1}`, ...cut("degrade", l.a, l.b, `degrade_${k + 1}.mov`) }));
cf.layers.fundo.forEach((l, k) => gfx.push({ lane: 3 + (k % 2), name: `Cena ${k + 1} — ${l.nome}`, ...cut("fundo", l.a, l.b, `cena_${k + 1}.mov`) }));
cf.layers.ui.forEach((l, k) => gfx.push({ lane: 5, name: `UI ${k + 1} — ${l.nome}`, ...cut("ui", l.a, l.b, `ui_${k + 1}.mov`) }));
cf.layers.caps.forEach((l, k) => gfx.push({ lane: 6, name: `Legenda ${String(k + 1).padStart(2, "0")} — ${l.texto}`, ...cut("caps", l.a, l.b, `legenda_${String(k + 1).padStart(2, "0")}.mov`) }));

// ---------- spine (V1) ----------
const spine = [], children = new Map(), spineItems = [];
pieces.forEach((p, i) => {
  const file = mediaCopy(p.media), id = asset(file, "video");
  const start = Math.max(p.rel, 0), A = fr(p.a), B = fr(p.b), n = B - A;
  const times = new Set([p.a, p.b - 1 / FPS]);
  for (const e of cf.cam) if (e.b > e.a) for (let s = 0; s <= 8; s++) { const t = e.a + ((e.b - e.a) * s) / 8; if (t > p.a && t < p.b) times.add(t); } else if (e.a > p.a && e.a < p.b) times.add(e.a);
  const ts = [...times].sort((x, y) => x - y), vals = ts.map((t) => ({ t, ...xfAt(t, p.xf) }));
  const constant = vals.every((v) => Math.abs(v.scale - vals[0].scale) < 1e-4 && Math.abs(v.y - vals[0].y) < 1e-3);
  const kt = (t) => tm(fr(start) + (fr(t) - A));
  const kf = constant ? "" :
    `<param name="position"><keyframeAnimation>${vals.map((v) => `<keyframe time="${kt(v.t)}" value="${v.x.toFixed(3)} ${v.y.toFixed(3)}"/>`).join("")}</keyframeAnimation></param>` +
    `<param name="scale"><keyframeAnimation>${vals.map((v) => `<keyframe time="${kt(v.t)}" value="${v.scale.toFixed(4)} ${v.scale.toFixed(4)}"/>`).join("")}</keyframeAnimation></param>`;
  const v0 = vals[0];
  spineItems.push({ off: A, dur: n, start: fr(start) });
  spine.push({ i, open: `<asset-clip ref="${id}" name="${xml(`V1 ${String(i + 1).padStart(2, "0")} · ${p.nome}`)}" offset="${tm(A)}" start="${tm(fr(start))}" duration="${tm(n)}" tcFormat="NDF">` +
    `<adjust-transform${p.xf?.rot ? ` rotation="${p.xf.rot}"` : ""} position="${v0.x.toFixed(3)} ${v0.y.toFixed(3)}" scale="${v0.scale.toFixed(4)} ${v0.scale.toFixed(4)}">${kf}</adjust-transform>`, close: "</asset-clip>" });
});
const attach = (t, x) => {
  const f = fr(t);
  let i = spineItems.findIndex((s) => f >= s.off && f < s.off + s.dur);
  if (i < 0) i = f < 0 ? 0 : spineItems.length - 1;
  const s = spineItems[i], local = s.start + (f - s.off);
  if (!children.has(i)) children.set(i, []);
  children.get(i).push(x(tm(local)));
};
gfx.forEach((g) => { const id = asset(g.file, "video"); attach(g.a, (o) => `<asset-clip ref="${id}" lane="${g.lane}" name="${xml(g.name)}" offset="${o}" start="0s" duration="${tm(Math.max(fr(g.b) - fr(g.a), 1))}"/>`); });

// ---------- áudio ----------
const VOZ = join(MEDIA, "voz_nivelada_14LUFS.wav");
copyFileSync(join(ROOT, "assets", "voice.wav"), VOZ);
attach(0, (o) => `<asset-clip ref="${asset(VOZ, "audio")}" lane="-1" name="Voz (loudnorm −14 LUFS)" offset="${o}" start="0s" duration="${T(edit.duration)}"><adjust-volume amount="${DV.ganhoVoz ?? "0dB"}"/></asset-clip>`);
if (cf.music) {
  const MUS = join(MEDIA, "trilha_nivelada.wav");
  copyFileSync(join(ROOT, "assets", cf.music.file), MUS);
  const kfm = cf.music.points.map((p) => `<keyframe time="${T(p.t)}" value="${p.v <= 0.0001 ? "-96.0dB" : dB(p.v)}"/>`).join("");
  attach(0, (o) => `<asset-clip ref="${asset(MUS, "audio")}" lane="-2" name="Trilha (só sob o orador: envelope em keyframes)" offset="${o}" start="0s" duration="${T(cf.total)}"><adjust-volume amount="0dB"><param name="amount"><keyframeAnimation>${kfm}</keyframeAnimation></param></adjust-volume></asset-clip>`);
}
const laneEnds = [];
const placeLane = (a, b) => { let i = laneEnds.findIndex((e) => e <= fr(a)); if (i < 0) { laneEnds.push(0); i = laneEnds.length - 1; } laneEnds[i] = fr(b); return -3 - i; };
for (const f of new Set(cf.sfx.map((s) => s.file))) copyFileSync(join(ROOT, "assets", "sfx", f), join(SFXD, f));
const sfxItems = [...cf.sfx].sort((p, q) => p.t - q.t);
for (const s of sfxItems) {
  const path = join(SFXD, s.file), id = asset(path, "audio"), real = Math.min(s.dur, probeDur(path)), ln = placeLane(s.t, s.t + real);
  attach(s.t, (o) => `<asset-clip ref="${id}" lane="${ln}" name="${xml(`${s.cat} · ${s.file.replace(/\.(mp3|wav)$/, "")}`)}" offset="${o}" start="0s" duration="${T(real)}"><adjust-volume amount="${dB(s.vol)}"/></asset-clip>`);
}

// ---------- FCPXML ----------
const fmtXml = [...fmts].map(([k, id]) => { const [w, h] = k.split("x"); return `<format id="${id}" name="${id === "r1" ? "Saída" : "Fonte"} ${k} ${FPS.toFixed(3)}" frameDuration="${FD}/${TB}s" width="${w}" height="${h}" colorSpace="1-1-1 (Rec. 709)"/>`; });
const spineXml = spine.map((s) => s.open + (children.get(s.i) || []).join("") + s.close).join("\n        ");
const out = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    ${fmtXml.join("\n    ")}
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

// legendas.srt + LEIA-ME
const srtT = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
writeFileSync(join(PKG, "legendas.srt"), cf.chunks.map((c, k) => `${k + 1}\n${srtT(c.start)} --> ${srtT(c.end)}\n${c.text}\n`).join("\n"));
writeFileSync(join(PKG, "LEIA-ME.txt"), `PACOTE DAVINCI — ${DV.evento}
Importar: File › Import › Timeline › ${DV.projeto}.fcpxml (FCPXML 1.9). Se pedir, Relink para a pasta media/.
Fps ${pj.fpsStr} · ${CW}x${CH} · ${cf.total.toFixed(2)} s.

FAIXAS
 V1            ${pieces.length} cortes das mídias ORIGINAIS do editor (nos cortes finais). Na meia tela, o recorte do orador (escala/posição) está em keyframes.
 V2 (lane 1)   Faixa escura suave atrás da legenda (um clipe por trecho fora das telas cheias).
 V3 (lane 2)   Degradê escuro de baixo p/ cima — um clipe POR trecho de UI.
 V4/V5 (3,4)   Cenas de painel/tela cheia (ProRes 4444 com alpha, alternando de faixa).
 V6 (lane 5)   UI sobre o orador (slider, capítulos, logo…).
 V7 (lane 6)   Legendas — um clipe por bloco.
 A1 voz −14 LUFS · A2 trilha (envelope em keyframes: baixa nas cenas de animação) · A3… SFX por família (whoosh/textura).

O QUE O XML NÃO LEVA / DIFERENÇAS DO RENDER
 - O desfoque do orador sob a UI (backdrop blur) não vai: aplique um Gaussian Blur com máscara no V1 nos trechos de UI, se quiser.
 - Efeitos de áudio/limiter do master e cor não vão. Conferir o nível: voz −14 LUFS, pico ≤ −1,5 dBTP.
 - Para trocar uma animação: re-renderizar a camada (layer-*.html) e sobrescrever o clipe com o MESMO nome/duração; Relink / Delete Render Cache.
 - Referência visual: referencia_preview720.mp4 (render do HyperFrames).
`);
console.log(`ok: ${pieces.length} cortes no V1 · ${gfx.length} clipes de camada · ${sfxItems.length} sfx em ${laneEnds.length} trilhas · ${res.length} mídias · formatos ${[...fmts.keys()].join(", ")}`);
