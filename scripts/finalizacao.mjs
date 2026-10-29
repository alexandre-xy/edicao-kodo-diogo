#!/usr/bin/env node
// Modo "Apenas Finalização": parte da TIMELINE do editor (FCPXML) em vez de um mp4 já cortado.
//   node finalizacao.mjs ler    --projeto <p> [--gap 1.0]     lê DAVINCI_PROJECT/entrada/*.fcpxml → DATA/blocos.json
//   node finalizacao.mjs montar --projeto <p> --bloco b1       cria DATA/blocos/b1/ (projeto.json + hf/ com picture, voice, edit.json)
//
// Entrada (pasta DAVINCI_PROJECT/entrada/): 1 arquivo .fcpxml (File › Export › Timeline › FCPXML) + 1 render leve
// da MESMA timeline em .mp4 (nome com "mixdown" de preferência; começa no início da timeline).
// Cada trecho de clipes separado por um espaço vazio ≥ --gap s (padrão 1,0) é um VÍDEO (bloco). Os cortes do editor
// são mantidos exatamente: cada clipe do V1 vira um segmento do edit.json; nada é recortado de novo.
// Pré-requisito do montar: transcrição do mixdown inteiro (preparar.mjs + align-words.mjs com fonte.video = mixdown),
// que gera <hf>/build/words.json com tempos = tempos da timeline.
// STATUS: validado ponta a ponta com 1 export real do Resolve (1 vídeo, 10 clipes, rotação/escala) e reimportado no Resolve (out/2026).
//         AINDA NÃO testado com real: vários vídeos na mesma timeline (testado só com XML sintético), clipes compostos/multicam/retime.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { loadProjeto, SKILL_DIR } from "./lib/projeto.mjs";

const cmd = process.argv[2];
const pj = loadProjeto();
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const ENTRADA = pj.P("DAVINCI_PROJECT/entrada");
const BLOCOS = pj.P("DATA/blocos.json");
const r3 = (n) => Math.round(n * 1000) / 1000;

// ---------- XML mínimo ----------
function parseXml(s) {
  s = s.replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g, "");
  const root = { tag: "#", attrs: {}, kids: [] }, st = [root];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) { st.pop(); continue; }
    const attrs = {};
    for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = (a[2] ?? a[3]).replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const n = { tag: m[2], attrs, kids: [] };
    st.at(-1).kids.push(n);
    if (!m[4]) st.push(n);
  }
  return root;
}
const walk = (n, f) => { f(n); n.kids.forEach((k) => walk(k, f)); };
const sec = (v) => { if (!v) return 0; const s = String(v).replace(/s$/, ""); if (s.includes("/")) { const [a, b] = s.split("/"); return +a / +b; } return +s; };
const fromUrl = (u) => decodeURIComponent(u.replace(/^file:\/\/(localhost)?\/?/, "")).replace(/^([A-Za-z]:)?\/?/, (m0) => m0);

if (cmd === "ler") {
  const xmlFile = readdirSync(ENTRADA).find((f) => /\.fcpxml$/i.test(f));
  if (!xmlFile) throw new Error(`coloque o .fcpxml da timeline em ${ENTRADA}`);
  const mixFile = readdirSync(ENTRADA).filter((f) => /\.(mp4|mov)$/i.test(f)).sort((a, b) => /mixdown/i.test(b) - /mixdown/i.test(a))[0];
  if (!mixFile) throw new Error(`coloque o render leve da timeline (mixdown .mp4) em ${ENTRADA}`);
  const root = parseXml(readFileSync(join(ENTRADA, xmlFile), "utf8"));
  const assets = new Map(), formats = new Map();
  let seq = null;
  walk(root, (n) => {
    if (n.tag === "asset") { const mr = n.kids.find((k) => k.tag === "media-rep"); assets.set(n.attrs.id, { name: n.attrs.name, src: n.attrs.src || mr?.attrs.src }); }
    if (n.tag === "format") formats.set(n.attrs.id, n.attrs);
    if (n.tag === "sequence" && !seq) seq = n;
  });
  if (!seq) throw new Error("sem <sequence> no FCPXML");
  const fmt = formats.get(seq.attrs.format);
  const fps = fmt ? (() => { const [a, b] = fmt.frameDuration.replace(/s$/, "").split("/"); return `${b ?? 1}/${a}`; })() : null;
  const seqStart = sec(seq.attrs.tcStart);
  const spine = seq.kids.find((k) => k.tag === "spine");
  const items = [];
  const avisos = [];
  for (const n of spine.kids) {
    if (n.tag === "gap" || !n.attrs.duration) continue;
    if (n.tag === "ref-clip" || n.tag === "mc-clip" || n.tag === "sync-clip") { avisos.push(`${n.tag} "${n.attrs.name}" ignorado (composto): exporte com os clipes achatados`); continue; }
    let ref = n.attrs.ref;
    if (!ref || !assets.has(ref)) { walk(n, (k) => { if (!ref || !assets.has(ref)) if (k.attrs.ref && assets.has(k.attrs.ref)) ref = k.attrs.ref; }); }
    const a = assets.get(ref);
    if (!a) { avisos.push(`clipe "${n.attrs.name}" sem mídia resolvida`); continue; }
    const tr = n.kids.find((k) => k.tag === "adjust-transform")?.attrs || {};
    const num2 = (v, d) => (v ? String(v).trim().split(" ").filter(Boolean).map(Number) : d);
    const sc = num2(tr.scale, [1, 1]), ps = num2(tr.position, [0, 0]);
    items.push({ xf: { scale: sc[0], pos: ps, rot: +(tr.rotation || 0) }, nome: n.attrs.name || a.name, midia: a.src ? fromUrl(a.src) : null, srcIn: sec(n.attrs.start), off: sec(n.attrs.offset) - seqStart, dur: sec(n.attrs.duration) });
  }
  items.sort((p, q) => p.off - q.off);
  const GAP = +arg("--gap", 1.0);
  const blocos = [];
  let end = -Infinity;
  for (const it of items) {
    if (!blocos.length || it.off - end >= GAP) blocos.push({ id: `b${blocos.length + 1}`, nome: it.nome, t0: r3(it.off), t1: 0, clips: [] });
    const b = blocos.at(-1);
    b.clips.push({ xf: it.xf, n: b.clips.length + 1, nome: it.nome, midia: it.midia, srcIn: r3(it.srcIn), off: r3(it.off), dur: r3(it.dur) });
    end = Math.max(end, it.off + it.dur);
    b.t1 = r3(end);
  }
  writeFileSync(BLOCOS, JSON.stringify({ fps, mixdown: join(ENTRADA, mixFile), palavras: join(pj.hf, "build", "words.json"), blocos }, null, 1));
  console.log(`${items.length} clipes · ${blocos.length} blocos (vídeos) · fps ${fps}`);
  for (const b of blocos) console.log(`${b.id}  ${b.t0.toFixed(2)}–${b.t1.toFixed(2)} s  ${(b.t1 - b.t0).toFixed(1)} s  ${b.clips.length} clipes  “${b.nome}”`);
  avisos.forEach((a) => console.log("AVISO:", a));
  process.exit(0);
}

if (cmd === "montar") {
  const id = arg("--bloco");
  const B = JSON.parse(readFileSync(BLOCOS, "utf8"));
  const bl = B.blocos.find((b) => b.id === id);
  if (!bl) throw new Error(`bloco ${id} não existe (rode "ler")`);
  const dir = pj.P(`DATA/blocos/${id}`);
  const hf = join(dir, "hf");
  for (const d of [join(hf, "assets"), join(hf, "build")]) mkdirSync(d, { recursive: true });
  const dur = r3(bl.t1 - bl.t0);
  // projeto do bloco: clone do projeto-base com hf próprio
  const cfg = JSON.parse(JSON.stringify(pj.cfg));
  cfg.raiz = "../../..";
  cfg.nome = `${pj.cfg.nome}_${id}`; cfg.titulo = `${pj.cfg.titulo ?? pj.cfg.nome} — ${bl.nome}`;
  cfg.pastas = { hf: `DATA/blocos/${id}/hf` };
  cfg.cenas = `DATA/blocos/${id}/cenas.mjs`;
  cfg.modo = "finalizacao";
  cfg.trilha = { mixada: true };
  cfg.hook = { x: [] }; cfg.transicoes = { arquivos: {}, ordem: [], viradas: { entradaDeTrechos: [], srcStarts: [], tolerancia: 0.2 } };
  cfg.davinci = { ...(cfg.davinci || {}), versao: `${cfg.davinci?.versao ?? "v1"}_${id}`, evento: `${cfg.titulo}`, projeto: `${pj.cfg.nome.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${id}` };
  cfg.fonte = { ...cfg.fonte, video: B.mixdown, duracao: dur };
  cfg.corte = { ...cfg.corte, trechos: bl.clips.map((c) => ({ id: `c${c.n}`, nota: c.nome })) };
  cfg.grafismos = cfg.grafismos ?? [];
  writeFileSync(join(dir, "projeto.json"), JSON.stringify(cfg, null, 2) + "\n");
  if (!existsSync(join(dir, "cenas.mjs"))) copyFileSync(join(SKILL_DIR, "modelos", "cenas.modelo.mjs"), join(dir, "cenas.mjs"));

  // imagem e voz a partir do mixdown (para a prévia/grafismos; o pacote DaVinci usa as mídias originais do XML)
  const W = pj.W, H = pj.H, fps = pj.fpsStr;
  const ff = (a) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a]);
  ff(["-ss", String(bl.t0), "-t", String(dur), "-i", B.mixdown, "-an", "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},fps=${fps},setsar=1,format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-g", "12", "-bf", "0", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", join(hf, "assets", "picture.mp4")]);
  const raw = join(hf, "build", "voice_raw.wav");
  ff(["-ss", String(bl.t0), "-t", String(dur), "-i", B.mixdown, "-vn", "-ar", "48000", raw]);
  const LN = { I: cfg.saida.loudness, TP: cfg.saida.picoTP, LRA: 7 };
  const m = spawnSync("ffmpeg", ["-hide_banner", "-i", raw, "-af", `loudnorm=I=${LN.I}:TP=${LN.TP}:LRA=${LN.LRA}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const ln = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
  ff(["-i", raw, "-af", `loudnorm=I=${LN.I}:TP=${LN.TP}:LRA=${LN.LRA}:measured_I=${ln.input_i}:measured_TP=${ln.input_tp}:measured_LRA=${ln.input_lra}:measured_thresh=${ln.input_thresh}:offset=${ln.target_offset}:linear=true,aresample=48000`, "-ar", "48000", join(hf, "assets", "voice.wav")]);

  // palavras do bloco (tempos da timeline − t0; índices renumerados a partir de 0)
  const all = JSON.parse(readFileSync(B.palavras, "utf8"));
  const words = all.filter((w) => (w.start + w.end) / 2 >= bl.t0 && (w.start + w.end) / 2 <= bl.t1)
    .map((w, i) => ({ i, text: w.text, start: r3(w.start - bl.t0), end: r3(w.end - bl.t0) }));
  writeFileSync(join(hf, "build", "words.json"), JSON.stringify(words, null, 1));

  // edit.json: um segmento por clipe do editor (cortes mantidos como estão)
  const FPSV = pj.fps;
  const segments = bl.clips.map((c, k) => ({
    keep: `c${c.n}`, join: "hard", jFrames: 0, zoom: 1.0, media: c.midia, xf: c.xf,
    srcStart: c.srcIn, srcEnd: r3(c.srcIn + c.dur),
    tlStart: r3(c.off - bl.t0), tlEnd: r3(c.off - bl.t0 + c.dur), picTlStart: r3(c.off - bl.t0),
  }));
  const tlWords = words.map((w) => ({ ...w, seg: Math.max(0, segments.findIndex((s) => (w.start + w.end) / 2 < s.tlEnd)) }));
  writeFileSync(join(hf, "build", "edit.json"), JSON.stringify({ fps, totalFrames: Math.round(dur * FPSV), duration: dur, segments, words: tlWords }, null, 1));
  console.log(`${id}: ${dur}s · ${segments.length} segmentos · ${words.length} palavras · voz ${ln.input_i} → ${LN.I} LUFS`);
  console.log(`próximos: node scripts/prepare-assets.mjs --projeto "${join(dir, "projeto.json")}" ; preencher grafismos em projeto.json ; build-comp.mjs ; build-fcpxml.mjs`);
}
