#!/usr/bin/env node
// Etapa 5 · Montagem — MOTOR VIRAL (template com "motor": "viral"). Gera <hf>/index.html a partir de
// build/edit.json (palavras/tempos), do template (style.json) e do plano de cenas (projeto.json → plano[]).
//   node build-comp-viral.mjs --projeto <p>
// Plano de cenas: ver etapas/04-plano-viral.md. Tipos: (implícito) legenda · ui · meia · cheia.
// Movimento medido do vídeo-referência: ver ANALISE-REFERENCIA-MOTION.md (durações em style.json → ritmo).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadProjeto, SKILL_DIR } from "./lib/projeto.mjs";

const pj = loadProjeto();
const { cfg, tpl } = pj;
const ROOT = pj.hf, CW = pj.W, CH = pj.H;
const edit = JSON.parse(readFileSync(join(ROOT, "build", "edit.json"), "utf8"));
const { CSS: recipeCSS, REC: REC0 } = await import(pathToFileURL(join(SKILL_DIR, "grafismos", "viral.mjs")).href);
const { REC_EXTRA } = await import(pathToFileURL(join(SKILL_DIR, "grafismos", "viral-extra.mjs")).href);
const REC = { ...REC0, ...REC_EXTRA };
const r = (n) => Math.round(n * 1000) / 1000;
const T = (n) => r(n).toFixed(3);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const VOICE_END = edit.duration, TOTAL = r(VOICE_END);
const C = tpl.cores, TY = tpl.tipografia, LG = tpl.legenda, LGP = cfg.legenda || {};
const LEAD = cfg.avanco ?? tpl.avanco ?? 0.06;
const R = tpl.ritmo[cfg.ritmo || tpl.metadados?.ritmo || "viral"];
const MT = tpl.meiaTela;

// ---------- palavras ----------
const byIdx = new Map(edit.words.map((w) => [w.i, w]));
const W = (i) => { const w = byIdx.get(i); if (!w) throw new Error("palavra inexistente: " + i); return w.start; };
const WE = (i) => byIdx.get(i).end;

// ---------- animação seek-safe (estado inicial = "de" da animação mais cedo de cada propriedade) ----------
const initMap = new Map(), tw = [];
function anim(sel, from, to, t) {
  const m = initMap.get(sel) ?? new Map(); initMap.set(sel, m);
  for (const [k, v] of Object.entries(from)) if (!m.has(k) || m.get(k).t > t) m.set(k, { t, v });
  tw.push({ t, js: `tl.fromTo(${JSON.stringify(sel)}, ${JSON.stringify(from)}, ${JSON.stringify({ ...to, immediateRender: false })}, ${T(t)});` });
}
const raw = (t, js) => tw.push({ t, js });
// copia imagem do projeto para hf/assets/img (nome ASCII) e devolve o caminho relativo ao index.html
const asset = (rel) => { const src = pj.P(rel), nome = rel.split(/[/]/).pop().normalize("NFD").replace(/[^A-Za-z0-9._-]+/g, "-"); mkdirSync(join(ROOT, "assets", "img"), { recursive: true }); copyFileSync(src, join(ROOT, "assets", "img", nome)); return "assets/img/" + nome; };
const keyReveal = (sel, t, dur) =>
  anim(sel, { "--p": 0, opacity: 0, filter: "blur(5px)", y: 6 }, { "--p": 1.3, opacity: 1, filter: "blur(0px)", y: 0, duration: dur, ease: "none" }, t);

// ---------- som: categorias → família → dB (doutrina do MD de sound design) ----------
const SX = tpl.sfx, FAM = { whoosh: "whoosh", pop: "textura", click: "textura", ui: "textura", impacto: "textura", sucesso: "textura", erro: "textura", hit: "riser", riser: "riser" };
const sfx = [];
const addSfx = (cat, t, db = 0) => {
  const file = SX.mapa[cat]; if (!file) return;
  const base = SX.niveisDb[FAM[cat]] ?? -8;
  sfx.push({ cat, file, t: r(Math.max(t, 0)), vol: +Math.min(Math.pow(10, (base + db + (SX.calibragemDb ?? 0)) / 20), 1).toFixed(3) });
};
let seed = 1337; const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };

// ---------- plano de cenas ----------
// depois = tempo que a cena fica após a última palavra (leitura): UI 0,4 · meia/cheia 0,5 (limitado pelo início da próxima cena)
const DEPOIS = { ui: 0.4, meia: 0.5, cheia: 0.5 };
const plano = (cfg.plano || []).map((s, n) => ({ ...s, n, t0: r(W(s.de) - (s.antes ?? 0.12)), t1: r(WE(s.ate) + (s.depois ?? DEPOIS[s.tipo] ?? 0.15)) })).sort((a, b) => a.t0 - b.t0);
plano.forEach((s, k) => { const nx = plano[k + 1]; if (nx && s.t1 > nx.t0) s.t1 = Math.max(nx.t0, s.t0 + 0.3); s.t0 = Math.max(s.t0, 0); s.t1 = Math.min(s.t1, TOTAL); });
plano.forEach((s, k) => { if (k && s.t0 < plano[k - 1].t1) s.t0 = plano[k - 1].t1; });

// ---------- rosto: a legenda NUNCA fica sobre o rosto ----------
// cfg.rosto = [{ de, ate, y0, y1 }]  (s da timeline; px do quadro 1080×1920 SEM recorte: topo do cabelo → queixo). Medir na folha de grade (Etapa 3).
const ROSTO = (cfg.rosto || []).map((f) => ({ t0: f.de, t1: f.ate, y0: f.y0, y1: f.y1 }));
const faceAt = (t) => ROSTO.find((f) => t >= f.t0 && t < f.t1) ?? ROSTO.at(-1) ?? null;
const ANCH = CH * 0.18; // transform-origin do orador (ancora "50% 18%")
const MV = tpl.meiaTela.video, ZONA_META = tpl.meiaTela.zonaLegenda ?? 1170; // topo do rosto na meia tela (espaço p/ legenda acima)
// meia tela com recorte que posiciona o topo do rosto em ZONA_META (deslocamento automático por cena)
plano.forEach((s) => {
  if (s.tipo !== "meia") return;
  const f = faceAt((s.t0 + s.t1) / 2), sc_ = s.escalaVideo ?? MV.escala;
  s.m = { s: sc_, dy: s.deslocaY ?? (f ? Math.round(ZONA_META - (ANCH + (f.y0 - ANCH) * sc_)) : MV.deslocaY) };
});
const boxTransf = (f, s) => (s && s.tipo === "meia" ? { y0: ANCH + (f.y0 - ANCH) * s.m.s + s.m.dy, y1: ANCH + (f.y1 - ANCH) * s.m.s + s.m.dy } : f);
const sceneAt = (t) => plano.find((s) => t >= s.t0 - 1e-6 && t < s.t1 - 1e-6);
const sceneOfWord = (i) => plano.find((s) => i >= s.de && i <= s.ate);


// CSS da legenda (usado na página final e na página de medição de alturas)
const sa = TY.sans, se = TY.serif;
const fontFace = tpl.fontes.map((f) => `@font-face { font-family: "${f.familia}"; font-weight: ${f.peso}; font-style: ${f.estilo}; src: url("assets/fonts/${f.arquivo}"); }`).join("\n      ");
const CAP_CSS = `      .cap { position: absolute; text-align: center; color: ${C.branco}; font-family: "${sa.familia}", sans-serif; font-weight: ${sa.peso}; font-size: ${sa.tamanho}px; line-height: ${sa.entrelinha}; letter-spacing: ${sa.tracking}; text-shadow: 0 2px 10px rgba(0,0,0,.55), 0 0 34px rgba(0,0,0,.38); }
      .cap.claro { color: ${C.tinta}; text-shadow: none; }
      .cap .w { display: inline-block; vertical-align: baseline; }
      .cap .k { font-family: "${se.familia}", serif; font-style: italic; font-weight: ${se.peso}; font-size: ${se.escala}em; line-height: 1; letter-spacing: ${se.tracking}; color: ${C.acento}; text-shadow: ${TY.glow}; }
      .cap .kt { display: inline-block; --p: 0; -webkit-mask-image: linear-gradient(90deg, #000 calc(var(--p) * 100% - 22%), transparent calc(var(--p) * 100%)); mask-image: linear-gradient(90deg, #000 calc(var(--p) * 100% - 22%), transparent calc(var(--p) * 100%)); padding: 0 6px; margin: 0 -6px; }
      .cap .k { margin: 0 16px; }`;
// ---------- legenda ----------
const KEY = new Set();
for (const x of LGP.chaves || []) { if (typeof x === "string" && x.includes("-")) { const [a, b] = x.split("-").map(Number); for (let i = a; i <= b; i++) KEY.add(i); } else KEY.add(+x); }
const REPLACE = LGP.substituir || {}, PUNCT = LGP.pontuacao || {};
const tokens = [], seen = new Set();
for (const w of edit.words) {
  if (seen.has(w.i) || sceneOfWord(w.i)?.semLegenda) continue; seen.add(w.i);
  const rep = w.i in REPLACE ? REPLACE[w.i] : w.text; if (rep === null) continue;
  tokens.push({ text: rep + (w.i in PUNCT ? PUNCT[w.i] : ""), t: w.start, end: w.end, seg: w.seg, key: KEY.has(w.i), i: w.i });
}
const chunks = []; let cur = null;
for (const tk of tokens) {
  const prev = cur?.tokens.at(-1), len = cur ? cur.tokens.reduce((a, x) => a + x.text.length + 1, 0) : 0;
  const brk = !cur || tk.seg !== prev.seg || /[.?!]$/.test(prev.text) || tk.t - prev.end > LG.pausaQuebra || len + tk.text.length > (sceneOfWord(tk.i)?.maxChars ?? LG.maxChars) || (sceneOfWord(tk.i)?.quebras || []).includes(tk.i) || sceneOfWord(tk.i)?.n !== sceneOfWord(prev.i)?.n;
  if (brk) { cur = { tokens: [], frase: !prev || /[.?!]$/.test(prev.text) || tk.t - prev.end > LG.pausaQuebra || tk.seg !== prev.seg || sceneOfWord(tk.i)?.n !== sceneOfWord(prev.i)?.n }; chunks.push(cur); }
  cur.tokens.push(tk);
}
const perScene = new Map();
const revealDur = (tk) => (tk.key ? Math.max(LG.serifMin, tk.text.length * LG.serifPorLetra) : LG.sansEntra);
chunks.forEach((c, i) => {
  c.start = r(c.tokens[0].t - LG.antecipa);
  for (let k = 1; k < c.tokens.length; k++) c.tokens[k].t = Math.max(c.tokens[k].t, c.tokens[k - 1].t + LG.minEntrePalavras);
  const sc = sceneOfWord(c.tokens[0].i); c.sc = sc;
  const idx = perScene.get(sc?.n ?? -1) ?? 0; perScene.set(sc?.n ?? -1, idx + 1); c.k = idx;
});
// LEITURA: o bloco só sai depois de ficar inteiro na tela por `holdMin` (0,5 s). Se o próximo começar antes, ele é atrasado
// (até `holdAtrasoMax`); passando disso, o bloco anterior é cortado e a revelação do fim acelera.
const HOLD = LG.holdMin ?? 0.5, ATRASO = LG.holdAtrasoMax ?? 0.45;
chunks.forEach((c, i) => {
  const last = c.tokens.at(-1), natural = Math.min(last.end + LG.segura, TOTAL);
  let end = Math.max(natural, last.t + revealDur(last) + HOLD);
  const nx = chunks[i + 1];
  if (nx) {
    const nStart = nx.tokens[0].t - LG.antecipa;
    if (end > nStart) {
      const atraso = end - nStart;
      if (atraso <= ATRASO) { nx.start = r(end); nx.tokens.forEach((tk, k) => { tk.t = Math.max(tk.t, nx.start + 0.02 + k * LG.minEntrePalavras); }); }
      else { end = nStart; }
    }
  }
  const nc = plano.find((s) => s.tipo === "cheia" && s.t0 > last.t && s.t0 < end);
  if (nc) end = Math.max(nc.t0 + 0.02, last.t + 0.3);
  c.end = r(Math.min(end, TOTAL));
});


// ---------- alturas reais dos blocos de legenda (Chrome headless): evita sobreposição ao rosto/UI ----------
const SCALES = [1, 0.88, 0.77, 0.68];
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => p && existsSync(p));
const HMEAS = new Map();
function medirAlturas() {
  if (!CHROME) return;
  const items = [];
  chunks.forEach((c, ci) => { c.tokens.forEach((tk, k) => { tk.show = (LGP.capitalizar !== false && k === 0 && c.frase) ? tk.text[0].toUpperCase() + tk.text.slice(1) : tk.text; }); SCALES.forEach((s, si) => {
    items.push(`<div class="cap" data-m="${ci}|${si}" style="left:0;top:0;width:${LG.larguraMax}px;font-size:${Math.round(TY.sans.tamanho * s)}px;visibility:hidden">${c.tokens.map((tk) => tk.key ? `<span class="w k"><span class="kt">${esc(tk.show)}</span></span>` : `<span class="w">${esc(tk.show)}</span>`).join(" ")}</div>`);
  }); });
  const page = `<!doctype html><meta charset="utf-8"><style>${fontFace.replaceAll('url("assets/', `url("file:///${ROOT.replace(/\\/g, "/")}/assets/`)}
${CAP_CSS}
body{margin:0}</style><body>${items.join("")}<pre id="o"></pre><script>document.fonts.ready.then(()=>setTimeout(()=>{const o={};document.querySelectorAll("[data-m]").forEach(d=>{o[d.dataset.m]=Math.round(d.getBoundingClientRect().height)});document.getElementById("o").textContent="HM"+JSON.stringify(o)+"HM";},300))</script></body>`;
  const file = join(ROOT, "build", "medir.html"); writeFileSync(file, page);
  const out = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--allow-file-access-from-files", "--virtual-time-budget=6000", "--dump-dom", "file:///" + file.replace(/\\/g, "/")], { encoding: "utf8", maxBuffer: 1 << 26 }).stdout || "";
  const m = out.match(/HM({.*?})HM/s);
  if (m) for (const [k, v] of Object.entries(JSON.parse(m[1]))) HMEAS.set(k, v);
}
mkdirSync(join(ROOT, "build"), { recursive: true });
medirAlturas();
console.log(HMEAS.size ? `legenda: ${HMEAS.size} alturas medidas no Chrome` : "legenda: medição indisponível (usando estimativa)");

// posição e modo de cada bloco
const capsTop = [], capsWorld = new Map();
const sansPx = TY.sans.tamanho;
chunks.forEach((c, ci) => {
  const sc = c.sc, tipo = sc?.tipo ?? "legenda";
  let x = 540, y = LG.posicao.legenda.y, larg = LG.larguraMax, claro = false, esc_ = sc?.escalaTexto ?? 1;
  let base = null;
  if (tipo === "ui") base = sc.legendaBase ?? (tpl.capitulo.y - 56);
  if (tipo === "meia") y = sc.legendaY ?? LG.posicao.meia.y;
  if (tipo === "cheia") { const b = sc.blocos?.[c.k] ?? {}; x = b.x ?? 540; y = b.y ?? 850; larg = b.larg ?? 940; claro = true; esc_ = sc.escalaTexto ?? LG.escalaCheia ?? 1.5; }
  // regra do ROSTO (por trecho de enquadramento): a legenda nunca cobre o rosto → abaixo do queixo (peito) → acima da cabeça → reduz o texto.
  // Se o bloco atravessa um corte de enquadramento, ele muda de posição junto com o corte.
  c.tops = null;
  if (tipo !== "cheia" && ROSTO.length) {
    const FACE_PAD = LG.rostoFolga ?? 40, LIM_BAIXO = LG.limiteBaixo ?? 1600, LIM_TOPO = LG.limiteTopo ?? 180;
    const uiTop = tipo === "ui" ? tpl.capitulo.y - 18 : 99999, paneTop = tipo === "meia" ? 985 : LIM_TOPO;
    const estimativa = (e) => { const cw = sansPx * e * 0.52; let L = 1, w = 0; for (const tk of c.tokens) { const ww = (tk.text.length + 1) * cw * (tk.key ? 2.0 : 1); if (w + ww > larg && w > 0) { L++; w = 0; } w += ww; } return L * sansPx * e * 1.3 + (c.tokens.some((t) => t.key) ? sansPx * e * 0.9 : 0); };
    const altura = (e) => { const si = SCALES.findIndex((s) => Math.abs((sc?.escalaTexto ?? 1) * s - e) < 0.02); const h = si >= 0 ? HMEAS.get(`${ci}|${si}`) : null; return h != null ? h + 6 : estimativa(e); };
    const cuts = [...new Set([c.start, ...ROSTO.map((f) => f.t0).filter((t) => t > c.start + 0.05 && t < c.end - 0.05), c.end])].sort((p, q) => p - q);
    const ivs = cuts.slice(0, -1).map((t, i) => ({ a: t, b: cuts[i + 1] }));
    const place = (iv, e) => {
      const faces = [iv.a + 0.01, (iv.a + iv.b) / 2].map((t) => { const fc = faceAt(t); return fc ? boxTransf(fc, sceneAt(t)) : null; }).filter(Boolean);
      const f0 = Math.min(...faces.map((fc) => fc.y0)) - FACE_PAD, f1 = Math.max(...faces.map((fc) => fc.y1)) + FACE_PAD, Hh = altura(e);
      const top0 = base != null ? base - Hh : y;
      if (top0 + Hh <= f0 || top0 >= f1) return top0;                             // já livre do rosto
      if (tipo !== "meia" && f1 + Hh <= Math.min(LIM_BAIXO, uiTop)) return f1;     // abaixo do queixo
      if (f0 - Hh >= paneTop) return f0 - Hh;                                       // acima da cabeça
      return null;
    };
    let tops;
    for (let tent = 0; tent < 5; tent++) { tops = ivs.map((iv) => place(iv, esc_)); if (tops.every((t) => t != null)) break; esc_ *= 0.88; }
    c.tops = ivs.map((iv, i) => ({ t: iv.a, top: Math.round(tops[i] ?? (base != null ? base - altura(esc_) : y)) }));
    base = null; y = c.tops[0].top;
  }
  c.tokens.forEach((tk, k) => { tk.show = (LGP.capitalizar !== false && k === 0 && c.frase) ? tk.text[0].toUpperCase() + tk.text.slice(1) : tk.text; });
  const html = `<div class="cap${claro ? " claro" : ""}" id="cap${ci}" style="left:${x - larg / 2}px;${base != null ? `bottom:${CH - base}px` : `top:${y}px`};width:${larg}px;opacity:0;font-size:${Math.round(sansPx * esc_)}px">${c.tokens.map((tk, k) =>
    tk.key ? `<span class="w k" id="cap${ci}w${k}"><span class="kt">${esc(tk.show)}</span></span>` : `<span class="w" id="cap${ci}w${k}">${esc(tk.show)}</span>`).join(" ")}</div>`;
  if (tipo === "cheia") { const a = capsWorld.get(sc.n) ?? []; a.push(html); capsWorld.set(sc.n, a); } else capsTop.push(html);
  anim(`#cap${ci}`, { opacity: 0 }, { opacity: 1, duration: 0 }, c.start);
  if (c.tops) c.tops.slice(1).forEach((p, i) => anim(`#cap${ci}`, { y: c.tops[i].top - c.tops[0].top }, { y: p.top - c.tops[0].top, duration: 0.01 }, p.t));
  anim(`#cap${ci}`, { opacity: 1 }, { opacity: 0, duration: 0.15, ease: "power1.in" }, c.end - 0.15);
  c.tokens.forEach((tk, k) => {
    const sel = `#cap${ci}w${k}`;
    if (tk.key) {
      anim(sel, { opacity: 1 }, { opacity: 1, duration: 0.01 }, tk.t - 0.02);
      keyReveal(`${sel} .kt`, tk.t, Math.max(LG.serifMin, tk.text.length * LG.serifPorLetra));
    } else anim(sel, { opacity: 0, y: 8, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: LG.sansEntra, ease: "power2.out" }, tk.t);
  });
});

// ---------- cenas ----------
let sceneHTML = "", panelsHTML = "", uiHTML = "";
const dimIv = [];
const gridBg = `background-color:${C.claro};background-image:linear-gradient(${C.grade} 2px,transparent 2px),linear-gradient(90deg,${C.grade} 2px,transparent 2px),linear-gradient(115deg,transparent 0%,${C.claroSombra}99 22%,transparent 44%,${C.claroSombra}88 62%,transparent 84%);background-size:64px 64px,64px 64px,100% 100%;`;
let camReset = []; // reposições de #cam depois de um painel coberto por tela cheia
const camEv = []; // eventos do recorte do orador: {a,b,y0,s0,y1,s1,ease}  (px/escala) — usados pelo build-fcpxml-viral

plano.forEach((sc, k) => {
  const id = `s${sc.n}`, nxt = plano[k + 1], gapNext = nxt ? nxt.t0 - sc.t1 : 9;
  const rec = REC[sc.receita]; if (!rec) throw new Error(`receita desconhecida: ${sc.receita} (cena ${sc.n})`);
  const ctx = { id, sc, W: (i) => W(i) - LEAD, WE, t0: sc.t0, t1: sc.t1, R, cores: C, T_: tpl, rnd, anim, raw, asset, keyReveal, sfx: addSfx, tipo: sc.tipo };
  const out = rec.build(sc, ctx);
  if (sc.tipo === "ui") {
    uiHTML += out.html;
    const last = dimIv.at(-1);
    if (last && sc.t0 - last[1] < 0.4) last[1] = sc.t1; else dimIv.push([sc.t0, sc.t1]);
  } else if (sc.tipo === "meia") {
    const hp = MT.alturaPainel;
    panelsHTML += `<div id="pn${sc.n}" class="abs" style="left:0;top:0;width:${CW}px;height:${hp}px;overflow:hidden;${gridBg}box-shadow:0 20px 50px rgba(0,0,0,.25);opacity:0">${out.html}</div>`;
    const ent = sc.entrada ?? "painel", prevCheia = plano[k - 1]?.tipo === "cheia" && sc.t0 - plano[k - 1].t1 < 0.4;
    anim(`#pn${sc.n}`, { opacity: 0, y: -hp }, { opacity: 1, y: 0, duration: R.painel, ease: R.easeEntra }, sc.t0);
    anim("#cam", { y: 0, scale: 1 }, { y: sc.m.dy, scale: sc.m.s, duration: R.painel, ease: R.easeEntra }, sc.t0);
    camEv.push({ a: sc.t0, b: r(sc.t0 + R.painel), y0: 0, s0: 1, y1: sc.m.dy, s1: sc.m.s, ease: R.easeEntra });
    addSfx("whoosh", sc.t0 - 0.06);
    const toCheia = nxt?.tipo === "cheia" && gapNext < 1.0; // a tela cheia cobre o painel: nada de saída (evita revelar o orador/preto entre cenas)
    sc.toCheia = toCheia;
    if (toCheia) camReset.push(nxt.t0 + (nxt.entrada === "corte" ? 0 : nxt.entrada === "iris" ? R.iris : R.painel) + 0.02);
    else {
      anim(`#pn${sc.n}`, { y: 0 }, { y: -hp, duration: R.painel, ease: R.easeSai }, sc.t1 - R.painel);
      anim("#cam", { y: sc.m.dy, scale: sc.m.s }, { y: 0, scale: 1, duration: R.painel, ease: R.easeSai }, sc.t1 - R.painel);
      camEv.push({ a: r(sc.t1 - R.painel), b: sc.t1, y0: sc.m.dy, s0: sc.m.s, y1: 0, s1: 1, ease: R.easeSai });
      addSfx("whoosh", sc.t1 - R.painel - 0.04, -2);
    }
    anim(`#pn${sc.n}`, { opacity: 1 }, { opacity: 0, duration: 0 }, toCheia ? nxt.t0 + R.painel + 0.05 : sc.t1 + 0.001);
  } else if (sc.tipo === "cheia") {
    const world = `<div id="wd${sc.n}" class="abs" style="left:0;top:0;width:${CW}px;height:${CH}px;transform-origin:540px 960px">${out.html}${(capsWorld.get(sc.n) || []).join("")}</div>`;
    sceneHTML += `<div id="fl${sc.n}" class="abs" style="left:0;top:0;width:${CW}px;height:${CH}px;overflow:hidden;${gridBg}opacity:0">${world}</div>`;
    const ent = sc.entrada ?? (plano[k - 1]?.tipo === "meia" && sc.t0 - plano[k - 1].t1 < 1.0 ? "wipe" : "iris");
    if (ent === "iris") {
      anim(`#fl${sc.n}`, { opacity: 0 }, { opacity: 1, duration: 0.001 }, sc.t0);
      anim(`#fl${sc.n}`, { clipPath: "circle(0% at 50% 48%)" }, { clipPath: "circle(120% at 50% 48%)", duration: R.iris, ease: "power2.inOut" }, sc.t0);
      addSfx("whoosh", sc.t0 - 0.03, -1);
    } else if (ent === "wipe") {
      anim(`#fl${sc.n}`, { opacity: 0 }, { opacity: 1, duration: 0.001 }, sc.t0);
      anim(`#fl${sc.n}`, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: R.painel, ease: "power2.inOut" }, sc.t0);
      addSfx("whoosh", sc.t0 - 0.04, -1);
    } else anim(`#fl${sc.n}`, { opacity: 0, clipPath: "inset(0% 0% 0% 0%)" }, { opacity: 1, clipPath: "inset(0% 0% 0% 0%)", duration: 0.01 }, sc.t0);
    anim(`#fl${sc.n}`, { opacity: 1 }, { opacity: 0, duration: 0 }, sc.t1);
    // câmera: segue o texto (ease in/out), estado anterior → próximo
    let prev = { x: 0, y: 0, scale: 1 };
    (sc.camera || []).forEach((kf) => {
      const t = (kf.em != null ? W(kf.em) : sc.t0 + (kf.t ?? 0)) - 0.05, to = { x: kf.x ?? prev.x, y: kf.y ?? prev.y, scale: kf.escala ?? prev.scale };
      anim(`#wd${sc.n}`, prev, { ...to, duration: kf.dur ?? R.camera, ease: R.easeCamera }, t);
      addSfx("whoosh", t, -4);
      prev = to;
    });
  }
  sc._out = out;
});
// reposição da câmera do orador depois de painel coberto por tela cheia
camReset.forEach((t) => { anim("#cam", { y: 0, scale: 1 }, { y: 0, scale: 1, duration: 0.01 }, t); camEv.push({ a: r(t), b: r(t), y0: 0, s0: 1, y1: 0, s1: 1, ease: "none" }); });

plano.filter((s) => s.tipo === "cheia").forEach((s) => { anim("#capband", { opacity: 1 }, { opacity: 0, duration: 0.05 }, s.t0); anim("#capband", { opacity: 0 }, { opacity: 1, duration: 0.2 }, s.t1); });
// escurecimento (gradiente de baixo + desfoque) durante as cenas com UI
const ES = tpl.escurecer;
dimIv.forEach(([a, b]) => {
  anim("#dim", { opacity: 0 }, { opacity: 1, duration: ES.entra, ease: "power2.out" }, a);
  if (b < TOTAL - 0.4) anim("#dim", { opacity: 1 }, { opacity: 0, duration: ES.sai, ease: "power2.in" }, b - ES.sai);
});


// ---------- música: só sob o orador (legenda/ui); some nas cenas de animação (meia/cheia) ----------
const TRI = { ...(tpl.trilha || {}), ...(cfg.trilha || {}) };
const HAS_MUSIC = !!TRI.fonte && !TRI.mixada;
let musicAttr = "";
if (HAS_MUSIC) {
  const src = join(ROOT, "assets", "music.mp3"), dst = join(ROOT, "assets", "music_bed.wav"), ini = TRI.inicio ?? 0;
  const m = spawnSync("ffmpeg", ["-hide_banner", "-ss", String(ini), "-t", String(TOTAL), "-i", src, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const I = parseFloat([...m.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1)?.[1] ?? "-14");
  const gain = (TRI.lufs ?? -26) - I;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(ini), "-t", String(TOTAL), "-i", src, "-af", `volume=${gain.toFixed(2)}dB,afade=t=in:d=0.4,afade=t=out:st=${r(TOTAL - 1.2)}:d=1.2`, "-ar", "48000", dst]);
  const low = TRI.sobAnimacaoDb != null ? Math.pow(10, TRI.sobAnimacaoDb / 20) : 0;
  const iv = plano.filter((s) => s.tipo === "meia" || s.tipo === "cheia").map((s) => [Math.max(s.t0 - 0.05, 0), s.t1]).sort((a, b) => a[0] - b[0]);
  const mer = []; for (const x of iv) { const l = mer.at(-1); if (l && x[0] - l[1] < (TRI.juntarAte ?? 1.0)) l[1] = Math.max(l[1], x[1]); else mer.push([...x]); }
  const pts = [{ t: 0, v: 1 }];
  for (const [a, b] of mer) { const t1 = Math.max(a - 0.12, pts.at(-1).t + 0.05); pts.push({ t: r(t1), v: 1 }, { t: r(a + 0.18), v: low }, { t: r(Math.max(b - 0.1, a + 0.25)), v: low }, { t: r(b + 0.35), v: 1 }); }
  musicAttr = ` data-automation="${JSON.stringify({ version: 1, lanes: [{ target: "volume", points: pts }] }).replace(/"/g, "&quot;")}"`;
  console.log(`trilha: ${gain.toFixed(1)} dB (alvo ${TRI.lufs ?? -26} LUFS) · off em ${mer.length} trechos de animação`);
}

// ---------- HTML ----------
const durCache = new Map();
const sfxDur = (f) => { if (!durCache.has(f)) { try { durCache.set(f, Math.min(+execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", join(ROOT, "assets", "sfx", f)], { encoding: "utf8" }).trim() || 1, 3)); } catch { durCache.set(f, 1); } } return r(durCache.get(f)); };
const sfxHTML = sfx.map((s, k) => `<audio id="sfx${k}" src="assets/sfx/${s.file}" data-start="${s.t}" data-duration="${sfxDur(s.file)}" data-track-index="${20 + k}" data-volume="${s.vol}"></audio>`).join("\n    ");
const init = [];
for (const [sel, m] of initMap) init.push(`gsap.set(${JSON.stringify(sel)}, ${JSON.stringify(Object.fromEntries([...m].map(([k, v]) => [k, v.v])))});`);
tw.sort((a, b) => a.t - b.t);
const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${CW}, height=${CH}" />
    <title>${esc(cfg.titulo)}</title>
    <script src="${tpl.gsap}"></script>
    <style>
      ${fontFace}
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${CW}px; height: ${CH}px; overflow: hidden; background: ${C.fundo}; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "${sa.familia}", sans-serif; }
      #vwrap, #dim, #uis, #caps, #panels, #scenes { position: absolute; left: 0; top: 0; width: ${CW}px; height: ${CH}px; pointer-events: none; }
      #cam { position: absolute; inset: 0; transform-origin: ${MT.video.ancora}; }
      #pic { position: absolute; left: 0; top: 0; width: ${CW}px; height: ${CH}px; object-fit: cover; }
      #dim { opacity: 0; }
      #capband { position: absolute; left: 0; right: 0; top: 780px; height: 520px; background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.34) 45%, rgba(0,0,0,.34) 62%, rgba(0,0,0,0)); pointer-events: none; }
      #dimg { position: absolute; left: 0; right: 0; top: ${ES.de}px; bottom: 0; background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,${ES.opacidade}) 55%, rgba(0,0,0,${ES.opacidade})); }
      #dimb { position: absolute; left: 0; right: 0; top: ${ES.de + 120}px; bottom: 0; backdrop-filter: blur(${ES.desfoque}px); -webkit-mask-image: linear-gradient(to bottom, transparent, #000 45%); mask-image: linear-gradient(to bottom, transparent, #000 45%); }
      ${CAP_CSS}
      ${recipeCSS(tpl)}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${CW}" data-height="${CH}" data-fps="${pj.fpsStr}">
      <div id="vwrap"><div id="cam">
        <video id="pic" class="clip" src="assets/picture.mp4" data-start="0" data-duration="${VOICE_END}" data-track-index="0" muted playsinline></video>
      </div></div>
      <div id="capband"></div>
      <div id="dim"><div id="dimg"></div><div id="dimb"></div></div>
      <div id="panels">${panelsHTML}</div>
      <div id="scenes">${sceneHTML}</div>
      <div id="uis">${uiHTML}</div>
      <div id="caps">
        ${capsTop.join("\n        ")}
      </div>
    </div>
    <audio id="voice" src="assets/voice.wav" data-start="0" data-duration="${VOICE_END}" data-track-index="10" data-volume="1"></audio>
    ${HAS_MUSIC ? `<audio id="music" src="assets/music_bed.wav" data-start="0" data-duration="${TOTAL}" data-track-index="11" data-volume="1"${musicAttr}></audio>` : ""}
    ${sfxHTML}
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      ${init.join("\n      ")}
      ${tw.map((x) => x.js).join("\n      ")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(join(ROOT, "index.html"), html);
mkdirSync(join(ROOT, "build"), { recursive: true });
writeFileSync(join(ROOT, "build", "beats.json"), JSON.stringify(plano.map((s) => ({ t: r(s.t0 + 0.6), title: `${s.tipo} · ${s.receita}`, note: s.id ?? "" })), null, 1));

// ---------- camadas para o DaVinci (alpha) + conform ----------
const LAY = { degrade: ["#dim"], faixa: ["#capband"], fundo: ["#panels", "#scenes"], ui: ["#uis"], caps: ["#caps"] };
const ALLSEL = ["#vwrap", "#capband", "#dim", "#panels", "#scenes", "#uis", "#caps"];
for (const [name, keep] of Object.entries(LAY)) {
  const hide = ALLSEL.filter((x) => !keep.includes(x)).join(", ");
  const lh = html
    .replace(/<video id="pic"[^>]*><\/video>/, "")
    .replace(/<audio [^>]*><\/audio>\n?\s*/g, "")
    .replace(`html, body { width: ${CW}px; height: ${CH}px; overflow: hidden; background: ${C.fundo}; }`, `html, body { width: ${CW}px; height: ${CH}px; overflow: hidden; background: transparent; }`)
    .replace("</style>", () => `  ${hide} { visibility: hidden !important; }\n    </style>`);
  writeFileSync(join(ROOT, `layer-${name}.html`), lh);
}
const layers = {
  // degradê: um clipe por trecho de UI (o mesmo intervalo em que o motor liga/desliga #dim)
  degrade: dimIv.map(([a, b]) => ({ a: r(Math.max(a, 0)), b: r(Math.min(b < TOTAL - 0.4 ? b + 0.05 : TOTAL, TOTAL)) })),
  // faixa escura da legenda: some nas telas cheias; um clipe por trecho contínuo fora delas
  faixa: (() => { const out = []; let a = 0; for (const s of plano.filter((p) => p.tipo === "cheia")) { if (s.t0 - 0.05 - a > 0.2) out.push({ a: r(a), b: r(s.t0 - 0.05 + 0.05) }); a = s.t1; } if (TOTAL - a > 0.2) out.push({ a: r(a), b: TOTAL }); return out; })(),
  fundo: plano.filter((s) => s.tipo === "meia" || s.tipo === "cheia").map((s) => { const nx = plano[plano.indexOf(s) + 1]; return { n: s.n, nome: `${s.tipo} · ${s.receita}`, a: r(Math.max(s.t0 - 0.05, 0)), b: r(Math.min((s.toCheia && nx ? nx.t0 + R.painel + 0.1 : s.t1 + 0.05), TOTAL)) }; }),
  ui: plano.filter((s) => s.tipo === "ui").map((s) => ({ n: s.n, nome: `ui · ${s.receita}`, a: r(Math.max(s.t0 - 0.05, 0)), b: r(Math.min(s.t1 + 0.2, TOTAL)) })),
  caps: chunks.filter((c) => c.sc?.tipo !== "cheia").map((c) => ({ a: c.start, b: c.end, texto: c.tokens.map((t) => t.show ?? t.text).join(" ") })),
};
writeFileSync(join(ROOT, "build", "conform.json"), JSON.stringify({
  total: TOTAL, motor: "viral", fps: pj.fpsStr, cenas: plano.map((s) => ({ tipo: s.tipo, receita: s.receita, t0: s.t0, t1: s.t1, m: s.m ?? null })),
  cam: camEv.sort((p, q) => p.a - q.a), layers, rostoZona: MV, ancora: ANCH,
  music: HAS_MUSIC ? { file: "music_bed.wav", points: JSON.parse(musicAttr.slice(musicAttr.indexOf("=\"") + 2, -1).replace(/&quot;/g, "\"")).lanes[0].points } : null,
  sfx: sfx.map((s) => ({ ...s, dur: sfxDur(s.file) })),
  chunks: chunks.map((c) => ({ start: c.start, end: c.end, text: c.tokens.map((t) => t.show ?? t.text).join(" ") })),
}, null, 1));
console.log(`index.html · ${TOTAL}s · ${plano.length} cenas · ${chunks.length} blocos de legenda · ${sfx.length} sfx`);
