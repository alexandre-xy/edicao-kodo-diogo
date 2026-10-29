#!/usr/bin/env node
// Etapa 5 · Montagem. Gera <hf>/index.html (composição HyperFrames) a partir de <hf>/build/edit.json,
// do template (templates/<nome>/style.json) e do projeto (DATA/projeto.json + DATA/cenas.mjs).
//   node build-comp.mjs --projeto <p>
// Depois: carve.mjs (ducking) e `npx hyperframes check`. Também escreve build/conform.json (DaVinci),
// build/beats.json (folha de frames) e layer-*.html (camadas com alpha para o DaVinci).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadProjeto, SKILL_DIR } from "./lib/projeto.mjs";

const pj = loadProjeto();
const { cfg, tpl } = pj;
const ROOT = pj.hf;
const cenas = await import(pathToFileURL(pj.P(cfg.cenas)).href);
const edit = JSON.parse(readFileSync(join(ROOT, "build", "edit.json"), "utf8"));
const r = (n) => Math.round(n * 1000) / 1000;
const CW = pj.W, CH = pj.H;

const VOICE_END = edit.duration;
const NO_END = !!cfg.cartao?.desativado; // cartao.desativado: sem cartão final
const END_START = NO_END ? r(VOICE_END) : r(cfg.cartao.inicio ?? VOICE_END - tpl.cartao.lead); // cartao.inicio: quando o bruto termina com preto reservado ao cartão
const END_DUR = NO_END ? 0 : tpl.cartao.dur;
const TOTAL = r(END_START + END_DUR);

// ---------- tempos por índice de palavra ----------
const byIdx = new Map(edit.words.map((w) => [w.i, w]));
const W = (i) => byIdx.get(i).start;
const WE = (i) => byIdx.get(i).end;
const segs = edit.segments;
const picStarts = segs.map((s) => s.picTlStart);

// ---------- trilha: trecho do início, ganho do template, fade-out no cartão ----------
const TRI = { ...tpl.trilha, ...(cfg.trilha || {}) };
const HAS_MUSIC = !!cfg.trilha?.fonte; // sem fonte = trilha já mixada no vídeo (modo Apenas Finalização)
if (HAS_MUSIC) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(ROOT, "assets", "music.mp3"), "-af",
  `atrim=0:${TOTAL},volume=${TRI.ganhoDb}dB,afade=t=in:d=0.02,afade=t=out:st=${r(TOTAL - TRI.fadeOut)}:d=${TRI.fadeOut}`, "-ar", "48000", join(ROOT, "assets", "music_bed.wav")]);

// ---------- legendas ----------
const LG = cfg.legenda, LT = tpl.legenda;
const KEY = new Set(LG.chaves);
// legenda fiel à fala; só grafia (mapa índice → texto; null remove)
const REPLACE = LG.substituir;
const REORDER = LG.reordenar || {};

const tokens = [];
for (const w of edit.words) {
  const base = { t: w.start, end: w.end, seg: w.seg, key: KEY.has(w.i), i: w.i };
  if (w.i in REORDER) {
    for (const [text, dt] of REORDER[w.i]) tokens.push({ ...base, text, t: w.start + dt, key: (LG.chaveReordenada || []).includes(text) });
    continue;
  }
  const rep = w.i in REPLACE ? REPLACE[w.i] : w.text;
  if (rep === null) continue;
  tokens.push({ ...base, text: rep });
}
// pontuação de respiro para quebrar blocos
const PUNCT = LG.pontuacao;
const NOPUNCT = new Set(LG.semPontuacao || []);
for (const tk of tokens) if (tk.i in PUNCT && !/[.,?!]$/.test(tk.text) && !NOPUNCT.has(tk.text)) tk.text += PUNCT[tk.i];

const chunks = [];
let cur = null;
for (const tk of tokens) {
  const prev = cur?.tokens.at(-1);
  const len = cur ? cur.tokens.reduce((a, x) => a + x.text.length + 1, 0) : 0;
  const brk = !cur || tk.seg !== prev.seg || /[.,?!]$/.test(prev.text) || tk.t - prev.end > LT.pausaQuebra || len + tk.text.length > LT.maxChars || prev.key;
  if (brk) { cur = { tokens: [] }; chunks.push(cur); }
  cur.tokens.push(tk);
}
for (let k = chunks.length - 1; k >= 0; k--) if (chunks[k].tokens[0].t > END_START - LT.juntarFinal) { chunks[k - 1].tokens.push(...chunks[k].tokens); chunks.splice(k, 1); }
chunks.forEach((c, i) => {
  c.start = r(c.tokens[0].t - LT.antecipa);
  const lastEnd = c.tokens.at(-1).end;
  const next = chunks[i + 1] ? chunks[i + 1].tokens[0].t - LT.antecipa : END_START;
  c.end = r(Math.min(next, lastEnd + LT.segura, END_START));
  for (let k = 1; k < c.tokens.length; k++) c.tokens[k].t = Math.max(c.tokens[k].t, c.tokens[k - 1].t + LT.minEntrePalavras);
});
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const capHTML = chunks.map((c, ci) =>
  `<div class="cap" id="cap${ci}">${c.tokens.map((tk, k) => `<span class="w${tk.key ? " key" : ""}" id="cap${ci}w${k}">${esc(tk.text.toLowerCase())}</span>`).join(" ")}</div>`).join("\n        ");

// ---------- pictogramas (boneco AIGA do template; cenas do projeto) ----------
const INK = tpl.cores.tinta, RED = tpl.cores.vermelho;
const fig = (id, x, y, s = 1, color = INK) => `<g transform="translate(${x} ${y}) scale(${s})"><g id="${id}">
  <circle cx="0" cy="-152" r="21" fill="${color}"/>
  <rect x="-25" y="-124" width="50" height="74" rx="20" fill="${color}"/>
  <rect x="-39" y="-118" width="12" height="60" rx="6" fill="${color}"/>
  <rect x="27" y="-118" width="12" height="60" rx="6" fill="${color}"/>
  <rect x="-22" y="-60" width="19" height="60" rx="9" fill="${color}"/>
  <rect x="3" y="-60" width="19" height="60" rx="9" fill="${color}"/></g></g>`;
const panelSVG = cenas.svg({ fig, RED, INK, W: CW, H: tpl.split.altura });

// ---------- código de barras determinístico ----------
let bx = 0;
const barcode = tpl.cartao.barcode.map((wd, k) => { const s = k % 2 === 0 ? `<rect class="bar" x="${bx}" y="0" width="${wd * 3}" height="64" fill="${INK}"/>` : ""; bx += wd * 3; return s; }).join("");

// ---------- som ----------
const SX = tpl.sfx, SFX = SX.mapa;
const sfx = [];
const addSfx = (file, t, vol, dur) => sfx.push({ file, t: r(Math.max(t, 0)), vol: +Math.min(vol * SX.ganho, SX.teto).toFixed(2), dur });
const whoosh = (t, v = 0.2) => addSfx(SFX.whoosh, t, v, 0.6);

// ---------- timeline JS ----------
const js = [];
const T = (n) => r(n).toFixed(3);
js.push(`tl.set("#panel", { yPercent: 100 }, 0);`);
js.push(`tl.set([${[...cenas.grupos, "#grid"].map((g) => `"${g}"`).join(",")}], { opacity: 0 }, 0);`);
js.push(`tl.set(".cap", { opacity: 0 }, 0);`);
js.push(`tl.set(".w", { opacity: 0, scale: ${LT.pop.de} }, 0);`);
const HK = cfg.hook || { x: [] };
HK.x ||= [];
const hxIds = HK.x.map((_, k) => `"#hx${k}"`).join(",");
js.push(`tl.set([${hxIds}], { opacity: 0, scale: 2.2, rotation: -18 }, 0);`);

// câmera: enquadramento estático por plano (vem do corte); o hook anima e o último plano faz push-in lento
const CAM = tpl.camera;
const PUNCH_IDX = [];
segs.forEach((s, k) => {
  const a = picStarts[k], b = k + 1 < segs.length ? picStarts[k + 1] : VOICE_END;
  if (s.keep === "hook") {
    js.push(`tl.set("#cam", { scale: ${CAM.hook.zoom} }, ${T(a)});`);
    js.push(`tl.to("#cam", { scale: 1.0, duration: ${CAM.hook.dur}, ease: "${CAM.hook.ease}" }, ${T(a)});`);
    return;
  }
  js.push(`tl.set("#cam", { scale: 1.0 }, ${T(a)});`);
  if (k === segs.length - 1) js.push(`tl.to("#cam", { scale: ${CAM.pushFinal.zoom}, duration: ${T(b - a)}, ease: "${CAM.pushFinal.ease}" }, ${T(a)});`);
});

// hook: X vermelhos nas palavras marcadas; tremida; SFX por X
HK.x.forEach((x, k) => {
  const sel = `#hx${k}`, i = x.palavra;
  js.push(`tl.to("${sel}", { opacity: 1, scale: 1, rotation: 0, duration: 0.22, ease: "back.out(2.2)" }, ${T(W(i))});`);
  js.push(`tl.fromTo("#shake", { x: 0 }, { keyframes: [${tpl.hookX.tremida.map((v) => `{ x: ${v} }`).join(", ")}], duration: 0.18, ease: "none" }, ${T(W(i))});`);
  addSfx(x.sfx, W(i) + x.offset, x.vol, x.dur);
});
// trecho em preto e branco no hook; a cor volta suave por baixo do flash da transição
if (HK.pb) {
  js.push(`tl.set("#cam", { filter: "grayscale(0) contrast(1)" }, 0);`);
  js.push(`tl.to("#cam", { filter: "grayscale(1) contrast(1.12)", duration: 0.12, ease: "none" }, ${T(W(HK.pb.palavra) - 0.04)});`);
}
const HOOK_END = segs[1]?.tlStart ?? 0;
js.push(`tl.to([${hxIds}], { opacity: 0, duration: 0.12 }, ${T(HOOK_END - 0.06)});`);
if (HK.pb) js.push(`tl.to("#cam", { filter: "grayscale(0) contrast(1)", duration: 0.4, ease: "sine.inOut" }, ${T(HOOK_END - 0.2)});`);

// transições overlay (blend Screen) nas viradas de raciocínio; o pico do flash cai no corte
const TRC = cfg.transicoes || { arquivos: {}, ordem: [], viradas: { entradaDeTrechos: [], srcStarts: [] } };
const TR = TRC.arquivos;
const turnIdx = segs.map((s, k) => k).filter((k) => k > 0 && (
  (segs[k].keep !== segs[k - 1].keep && TRC.viradas.entradaDeTrechos.includes(segs[k].keep)) ||
  TRC.viradas.srcStarts.some((x) => Math.abs(segs[k].srcStart - x) < (TRC.viradas.tolerancia ?? 0.2))));
const ORDER = TRC.ordem;
const transitions = turnIdx.map((k, n) => { const id = ORDER[n % ORDER.length]; const cut = picStarts[k]; return { id, cut, start: r(cut - TR[id].peak), dur: TR[id].dur, vol: TR[id].vol, n }; });
// risers do cliente: o pico cai no corte indicado
const RS = cfg.risers || {};
if (RS.hook) sfx.push({ file: RS.hook.arquivo, t: RS.hook.t, vol: RS.hook.vol, dur: RS.hook.dur });
if (RS.whoosh) {
  const riserAt = (cut) => sfx.push({ file: RS.whoosh.arquivo, t: r(Math.max(cut - RS.whoosh.pico, 0)), vol: RS.whoosh.vol, dur: RS.whoosh.dur });
  RS.whoosh.em.map((e) => ("transicao" in e ? transitions[e.transicao].cut : W(e.palavra))).forEach(riserAt);
}

// painéis (split screen)
const SP = tpl.split;
const splits = [];
const panelIn = (t) => {
  js.push(`tl.to("#panel", { yPercent: 0, duration: ${SP.entra.dur}, ease: "${SP.entra.ease}" }, ${T(t)});`);
  js.push(`tl.to("#shift", { y: ${cfg.splitSubida ?? SP.subidaVideo}, duration: ${SP.entra.dur}, ease: "${SP.entra.ease}" }, ${T(t)});`);
  js.push(`tl.fromTo("#grid", { opacity: 1, clipPath: "inset(0% 0% 100% 0%)" }, { opacity: 1, clipPath: "inset(0% 0% 0% 0%)", duration: 0.4, ease: "power2.out" }, ${T(t + 0.15)});`);
  whoosh(t - 0.06, 0.24);
};
const panelOut = (t) => {
  js.push(`tl.to("#panel", { yPercent: 100, duration: ${SP.sai.dur}, ease: "${SP.sai.ease}" }, ${T(t)});`);
  js.push(`tl.to("#shift", { y: 0, duration: ${SP.sai.dur}, ease: "${SP.sai.ease}" }, ${T(t)});`);
  whoosh(t - 0.06, 0.2);
};
const pop = (sel, t, extra = "") => {
  js.push(`tl.fromTo("${sel}", { opacity: 0, scale: 0.4, transformOrigin: "50% 100%" }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.8)"${extra} }, ${T(t)});`);
};
const show = (sel, t) => js.push(`tl.set("${sel}", { opacity: 1 }, ${T(t)});`);
const hide = (sel, t, d = 0.2) => js.push(`tl.to("${sel}", { opacity: 0, duration: ${d} }, ${T(t)});`);
const tick = (t, v = 0.3) => addSfx(SFX.tick, t, v, 0.4);
const ctx = { W, WE, js, T, addSfx, whoosh, tick, pop, show, hide, panelIn, panelOut, splits, SFX, RED, INK };
cenas.timeline(ctx);

// grafismos por receita (cfg.grafismos): cada item abre um painel e monta as receitas dentro dele
const { RECEITAS } = await import(pathToFileURL(join(SKILL_DIR, "grafismos", "receitas.mjs")).href);
let grHTML = "", usedComps = new Set(), durComps = new Map(), substComps = new Map(), trk = 40;
(cfg.grafismos || []).forEach((g, n) => {
  const a = r(W(g.de) - (g.antes ?? 0.15)), b = r(WE(g.ate) + (g.depois ?? 0.1));
  panelIn(a); panelOut(b); splits.push([a, b]);
  const t0 = r(a + SP.entra.dur - 0.05);
  g.itens.forEach((it, k) => {
    const rc = RECEITAS[it.receita];
    if (!rc) throw new Error("receita desconhecida: " + it.receita);
    const out = rc.build(it, { id: "gr" + n + "_" + k, t0, t1: b, W, WE, T, tpl, SFX, box: it.caixa || [0, SP.altura], panelW: CW, track: trk++, hf: ROOT, P: pj.P });
    grHTML += out.html;
    js.push(...out.js);
    out.sfx.forEach(([f, t, v, d]) => addSfx(f, t, v, d));
    if (rc.origem) usedComps.add(rc.origem); if (out.arquivo?.subst) substComps.set(rc.origem, out.arquivo.subst);
    if (out.arquivo) durComps.set(rc.origem, Math.max(durComps.get(rc.origem) ?? 0, out.arquivo.duracao));
  });
});
for (const id of usedComps) { const dst = join(ROOT, "compositions", "components"); mkdirSync(dst, { recursive: true }); { let h = readFileSync(join(SKILL_DIR, "grafismos", "vendor", id + ".html"), "utf8"); if (durComps.has(id)) { const d = durComps.get(id).toFixed(2); h = h.replace(/data-(composition-)?duration="[0-9.]+"/g, (m, p) => `data-${p || ""}duration="${d}"`); } for (const [a, b] of substComps.get(id) || []) h = h.split(a).join(b); // ajustes de texto/cor do arquivo vendor para o template
  writeFileSync(join(dst, id + ".html"), h); } }

// legendas
chunks.forEach((c, ci) => {
  js.push(`tl.set("#cap${ci}", { opacity: 1 }, ${T(c.start)}); tl.set("#cap${ci}", { opacity: 0 }, ${T(c.end)});`);
  c.tokens.forEach((tk, k) => js.push(`tl.to("#cap${ci}w${k}", { opacity: 1, scale: 1, duration: ${LT.pop.dur}, ease: "${LT.pop.ease}" }, ${T(tk.t)});`));
});

// cartão final
if (!NO_END) {
js.push(`tl.fromTo("#endcard .inner", { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.38, ease: "power3.inOut" }, ${T(END_START)});`);
js.push(`tl.fromTo(".bar", { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.25, stagger: 0.012, ease: "power2.out" }, ${T(END_START + 0.25)});`);
js.push(`tl.fromTo("#e1", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, ${T(END_START + 0.28)});`);
js.push(`tl.fromTo("#e2", { opacity: 0, y: 60, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.5)" }, ${T(END_START + 0.42)});`);
addSfx(SFX.whoosh, END_START - 0.08, 0.26, 0.6);
addSfx(SFX.impactoFinal, END_START + 0.42, 0.3, 1.2);
}

// ---------- estados iniciais fora da timeline (frame 0 correto) e fromTo sem immediateRender ----------
const init = [];
const lines = js.flatMap((l) => l.split(/;\s+(?=tl\.)/).map((x) => (x.endsWith(";") ? x : x + ";")));
const timed = [];
const firstFrom = new Map();
for (const l of lines) {
  const set0 = l.match(/^tl\.set\((.*), 0\);$/);
  if (set0) { init.push(`gsap.set(${set0[1]});`); continue; }
  const ft = l.match(/^tl\.fromTo\(("[^"]+"), (\{[^}]*\}), \{(.*), ([\d.]+)\);$/);
  if (ft) {
    const pos = parseFloat(ft[4]);
    if (!firstFrom.has(ft[1]) || firstFrom.get(ft[1]).pos > pos) firstFrom.set(ft[1], { pos, from: ft[2] });
    timed.push(`tl.fromTo(${ft[1]}, ${ft[2]}, { immediateRender: false, ${ft[3]}, ${ft[4]});`);
    continue;
  }
  timed.push(l);
}
for (const [sel, { from }] of firstFrom) init.push(`gsap.set(${sel}, ${from});`);
js.length = 0;
js.push(...init, ...timed);

// ---------- HTML ----------
const C = tpl.cores, F = tpl.fontes, HX = tpl.hookX, CA = tpl.cartao, FX = LT.faixa;
const fam = F[0].familia;
const sfxHTML = sfx.map((s, k) => `<audio id="sfx${k}" src="assets/sfx/${s.file}" data-start="${s.t}" data-duration="${s.dur}" data-track-index="${20 + k}" data-volume="${s.vol}"></audio>`).join("\n    ");
const hxSvg = HK.x.map((_, k) => `<svg class="hx" id="hx${k}" viewBox="0 0 100 100"><path d="M18 18 L82 82 M82 18 L18 82" stroke="${C.vermelho}" stroke-width="16" stroke-linecap="round"/></svg>`).join("\n      ");
const hxPos = HK.x.map((_, k) => `#hx${k} { ${k % 2 === 0 ? "left" : "right"}: ${HX.lateral}px; }`).join(" ");
const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${CW}, height=${CH}" />
    <title>${cfg.titulo}</title>
    <script src="${tpl.gsap}"></script>
    <style>
      ${F.map((f) => `@font-face { font-family: "${f.familia}"; font-weight: ${f.peso}; src: url("assets/fonts/${f.arquivo}") format("woff2"); }`).join("\n      ")}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${CW}px; height: ${CH}px; overflow: hidden; background: ${C.fundo}; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "${fam}", sans-serif; }
      #shake, #shift { position: absolute; inset: 0; }
      #cam { position: absolute; inset: 0; transform-origin: ${CAM.origem}; }
      #pic { position: absolute; left: 0; top: 0; width: ${CW}px; height: ${CH}px; object-fit: cover; }
      #panel { position: absolute; left: 0; top: ${SP.top}px; width: ${CW}px; height: ${SP.altura}px; background: ${C.painel}; overflow: hidden; }
      #grid { position: absolute; inset: 0;
        background-image: linear-gradient(${C.grade} 2px, transparent 2px), linear-gradient(90deg, ${C.grade} 2px, transparent 2px);
        background-size: ${SP.gradePasso}px ${SP.gradePasso}px; background-position: ${SP.gradeOffset}; }
      #pict { position: absolute; left: 0; top: 0; }
      #pict g { transform-box: view-box; }
      #scrim { position: absolute; left: 0; right: 0; top: ${FX.top}px; height: ${FX.altura}px; background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,${FX.opacidade.toFixed(2).replace(/^0/, "")}) 45%, rgba(0,0,0,${FX.opacidade.toFixed(2).replace(/^0/, "")}) 75%, rgba(0,0,0,0)); }
      #caps { position: absolute; left: ${LT.laterais}px; right: ${LT.laterais}px; bottom: ${LT.baseBottom}px; height: ${LT.altura}px; }
      .cap { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; color: ${C.branco}; font-weight: ${LT.peso}; font-size: ${LT.tamanho}px;
        line-height: ${LT.entrelinha}; letter-spacing: ${LT.tracking};
        text-shadow: ${LT.sombra}; }
      .w { display: inline-block; transform-origin: 50% 80%; }
      .w.key { color: ${C.amarelo}; font-size: ${LT.chaveEscala}em; }
      .hx { position: absolute; width: ${HX.tamanho}px; height: ${HX.tamanho}px; top: ${HX.top}px; }
      ${hxPos}
      .trv { position: absolute; left: 0; top: 0; width: ${CW}px; height: ${CH}px; object-fit: cover; mix-blend-mode: screen; pointer-events: none; }
      #endcard .inner { position: absolute; inset: 0; background: ${C.papel}; overflow: hidden; }
      #endcard .dots { position: absolute; inset: 0; background-image: radial-gradient(${C.tinta}11133 2px, transparent 2.5px); background-size: 40px 40px; background-position: 20px 20px; }
      #endcard .rule { position: absolute; left: 90px; right: 90px; height: 2px; background: ${C.tinta}11140; }
      #endcard .barcode { position: absolute; right: 90px; top: 150px; width: ${bx}px; height: 64px; }
      #endcard .txt { position: absolute; left: 90px; right: 60px; top: 760px; letter-spacing: -0.04em; line-height: 0.9; }
      #e1 { font-weight: ${CA.linha1.peso}; font-size: ${cfg.cartao.tamanho1 ?? CA.linha1.tamanho}px; color: ${C.tinta}; }
      #e2 { font-weight: ${CA.linha2.peso}; font-size: ${cfg.cartao.tamanho2 ?? CA.linha2.tamanho}px; color: ${C.vermelho}; margin-top: 18px; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${CW}" data-height="${CH}" data-fps="${pj.fpsStr}">
      <div id="shake"><div id="shift"><div id="cam">
        <video id="pic" class="clip" src="assets/picture.mp4" data-start="0" data-duration="${VOICE_END}" data-track-index="0" muted playsinline></video>
      </div></div></div>
      <div id="panel"><div id="grid"></div>${panelSVG}${grHTML}</div>
      ${hxSvg}
      ${transitions.map((t) => `<video id="tr${t.n}" class="clip trv" src="assets/tr/${t.id}.mp4" data-start="${t.start}" data-duration="${t.dur}" data-track-index="${3 + t.n}" muted playsinline></video>`).join("\n      ")}
      <div id="scrim"></div>
      <div id="caps">
        ${capHTML}
      </div>
      ${NO_END ? "" : `<div id="endcard" class="clip" data-start="${END_START}" data-duration="${r(TOTAL - END_START)}" data-track-index="2">
        <div class="inner">
          <div class="dots"></div>
          <div class="rule" style="top: 260px"></div>
          <div class="rule" style="top: 1420px"></div>
          <svg class="barcode" viewBox="0 0 ${bx} 64">${barcode}</svg>
          <div class="txt"><div id="e1">${cfg.cartao.linhas?.[0] ?? ""}</div><div id="e2">${cfg.cartao.linhas?.[1] ?? ""}</div></div>
        </div>
      </div>`}
    </div>
    <audio id="voice" src="assets/voice.wav" data-start="0" data-duration="${VOICE_END}" data-track-index="10" data-volume="1"></audio>
    ${HAS_MUSIC ? `<audio id="music" src="assets/music_bed.wav" data-start="0" data-duration="${TOTAL}" data-track-index="11" data-volume="1"></audio>` : ""}
    ${sfxHTML}
    ${transitions.map((t) => `<audio id="tra${t.n}" src="assets/tr/${t.id}.wav" data-start="${t.start}" data-duration="${t.dur}" data-track-index="${80 + t.n}" data-volume="${t.vol}"></audio>`).join("\n    ")}
    <script>
      const tl = gsap.timeline({ paused: true });
      ${js.join("\n      ")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(join(ROOT, "index.html"), html);

// ---------- conform para o DaVinci: tempos de tudo + camadas de grafismo com alpha ----------
writeFileSync(join(ROOT, "build", "conform.json"), JSON.stringify({
  total: TOTAL, voiceEnd: VOICE_END, endStart: END_START, semCartao: NO_END, hookEnd: HOOK_END,
  bwStart: HK.pb ? r(W(HK.pb.palavra) - 0.04) : null, splits, transitions,
  chunks: chunks.map((c) => ({ start: c.start, end: c.end, text: c.tokens.map((t) => t.text.toLowerCase()).join(" ") })),
  sfx,
}, null, 1));
// camadas: cada uma esconde todo o resto e tira vídeo/áudio; fundo transparente
const LAYERS = { panels: "#panel", hook: ".hx", caps: "#caps", end: "#endcard" };
for (const [name, sel] of Object.entries(LAYERS)) {
  const hideAll = ["#shake", "#panel", ".hx", "#scrim", "#caps", "#endcard", ".trv"].filter((x) => x !== sel).join(", ");
  const lh = html
    .replace(/<video id="pic"[^>]*><\/video>/, "")
    .replace(/<video id="tr\d+"[^>]*><\/video>\n?\s*/g, "")
    .replace(/<audio [^>]*><\/audio>\n?\s*/g, "")
    .replace(`html, body { width: ${CW}px; height: ${CH}px; overflow: hidden; background: ${C.fundo}; }`, `html, body { width: ${CW}px; height: ${CH}px; overflow: hidden; background: transparent; }`)
    .replace("</style>", `  ${hideAll} { visibility: hidden !important; }\n    </style>`);
  writeFileSync(join(ROOT, `layer-${name}.html`), lh);
}
// beats para a folha de frames (motor + cenas)
writeFileSync(join(ROOT, "build", "beats.json"), JSON.stringify([
  { t: 0.3, title: "HOOK", note: `zoom ${CAM.hook.zoom}→1,0` },
  ...HK.x.map((x, k) => ({ t: W(x.palavra) + 0.2, title: "HIT", note: `X ${k + 1}` })),
  ...splits.map(([a], k) => ({ t: a + 0.9, title: `Split ${k + 1}`, note: "painel entra" })),
  ...transitions.map((t) => ({ t: t.cut, title: `Transição ${t.n + 1}`, note: "flash no corte" })),
  ...(cenas.beats ? cenas.beats(ctx) : []),
  ...(NO_END ? [] : [{ t: END_START + 0.9, title: "End card", note: (cfg.cartao.linhas || []).join(" ") }]),
].sort((x, y) => x.t - y.t), null, 1));
console.log(`transições: ${transitions.map((t) => `${t.id}@${t.cut.toFixed(2)}`).join(", ")}`);
console.log(`index.html · ${TOTAL}s · ${chunks.length} blocos de legenda · ${sfx.length} sfx · splits ${splits.map(([a, b]) => `${a.toFixed(1)}–${b.toFixed(1)}`).join(", ")}`);
