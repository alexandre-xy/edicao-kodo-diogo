#!/usr/bin/env node
// Checagem automática da área segura: nenhum texto/grafismo dentro das faixas que a plataforma cobre
// (botões laterais, nome/descrição embaixo, barra de cima). Lê camadas com alpha (layer-caps.mov, layer-ui.mov…),
// onde todo pixel visível é motion ou legenda, e testa TODOS os quadros (amostrados a --fps-teste, padrão 10).
//
//   node zona-segura.mjs <camada.mov> [<camada2.mov> …] [--preset reels|youtube|feed] [--w 1080] [--h 1920]
//        [--topo px] [--base px] [--esq px] [--dir px] [--fps-teste 10] [--saida <pasta>]
//
// Medidas em px do quadro final. Presets (para 1080 de largura; escalam com --w):
//   reels   9:16 → topo 220 · base 420 (≈22%: nome, descrição, áudio) · esq 60 · dir 150 (curtir/comentar/enviar)
//   feed    4:5 / 1:1 → topo 60 · base 120 · esq 60 · dir 60
//   youtube 16:9 → 5% em cada borda (title safe)
// Código de saída 1 quando algum quadro tem pixel dentro da faixa proibida (REPROVADO). Gera <camada>-zona.json + um
// quadro .png do pior momento de cada camada reprovada, com as faixas pintadas, em --saida (padrão: pasta da camada/qa).
// ffmpeg/ffprobe vêm do PATH, ou das variáveis FFMPEG e FFPROBE.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';
const args = process.argv.slice(2);
const VALUED = ['--preset', '--w', '--h', '--topo', '--base', '--esq', '--dir', '--fps-teste', '--saida'];
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const files = args.filter((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
if (!files.length) { console.error('uso: node zona-segura.mjs <camada.mov> [...] [--preset reels|feed|youtube] [--w 1080] [--h 1920]'); process.exit(2); }

const run = (bin, a, o = {}) => {
  const r = spawnSync(bin, a, { maxBuffer: 1 << 30, ...o });
  if (r.error) { console.error(`não consegui rodar ${bin}: ${r.error.message}`); process.exit(2); }
  return r;
};

const preset = opt('preset', 'reels');
const W = Number(opt('w', 1080));
const H = Number(opt('h', preset === 'youtube' ? 1080 : 1920));
const k = W / 1080;
const base = {
  reels: { topo: 220 * k, base: 420 * k, esq: 60 * k, dir: 150 * k },
  feed: { topo: 60 * k, base: 120 * k, esq: 60 * k, dir: 60 * k },
  youtube: { topo: 0.05 * H, base: 0.05 * H, esq: 0.05 * W, dir: 0.05 * W },
}[preset];
if (!base) { console.error(`preset desconhecido: ${preset}`); process.exit(2); }
const zona = {
  topo: Math.round(Number(opt('topo', base.topo))),
  base: Math.round(Number(opt('base', base.base))),
  esq: Math.round(Number(opt('esq', base.esq))),
  dir: Math.round(Number(opt('dir', base.dir))),
};
const fpsTeste = Number(opt('fps-teste', 10));
const t2 = (x) => x.toFixed(2);

let reprovadas = 0;
console.log(`Área segura ${preset} ${W}x${H}: topo ${zona.topo} · base ${zona.base} · esq ${zona.esq} · dir ${zona.dir} px`);
for (const f of files) {
  const src = path.resolve(f);
  if (!fs.existsSync(src)) { console.error(`arquivo não encontrado: ${src}`); process.exit(2); }
  const probe = JSON.parse(run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_streams', src], { encoding: 'utf8' }).stdout || '{}');
  const v = (probe.streams || []).find((s) => s.codec_type === 'video');
  if (!v) { console.error(`${src}: sem vídeo`); process.exit(2); }
  if (!/a|yuva|rgba|argb|bgra|abgr|gbrap|pal8/.test(v.pix_fmt || '')) {
    console.log(`ATENÇÃO   ${path.basename(src)}: ${v.pix_fmt} sem canal alpha — esta checagem só vale para camadas com alpha`);
    continue;
  }
  // alpha em 1/4 da resolução: rápido e ainda pega uma letra encostando na faixa
  const sw = Math.round(W / 4); const sh = Math.round(H / 4); const n = sw * sh;
  const px = run(FFMPEG, ['-v', 'error', '-i', src, '-vf', `fps=${fpsTeste},scale=${W}:${H},format=rgba,alphaextract,scale=${sw}:${sh}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-']).stdout;
  const frames = Math.floor(px.length / n);
  if (!frames) { console.error(`${src}: não consegui ler quadros (ffmpeg falhou)`); process.exit(2); }
  const lim = { topo: zona.topo / 4, base: sh - zona.base / 4, esq: zona.esq / 4, dir: sw - zona.dir / 4 };
  const ruins = []; // { t, px, lados }
  for (let q = 0; q < frames; q++) {
    const o = q * n; let c = 0; const lados = new Set();
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      if (px[o + y * sw + x] < 40) continue;
      if (y < lim.topo) { c++; lados.add('topo'); } else if (y >= lim.base) { c++; lados.add('base'); }
      else if (x < lim.esq) { c++; lados.add('esq'); } else if (x >= lim.dir) { c++; lados.add('dir'); }
    }
    if (c >= 3) ruins.push({ t: q / fpsTeste, px: c, lados: [...lados] });
  }
  // agrupar em trechos contínuos
  const trechos = [];
  for (const r of ruins) {
    const u = trechos[trechos.length - 1];
    if (u && r.t - u.ate <= 1.5 / fpsTeste) { u.ate = r.t; r.lados.forEach((l) => u.lados.add(l)); if (r.px > u.pior.px) u.pior = r; }
    else trechos.push({ de: r.t, ate: r.t, lados: new Set(r.lados), pior: r });
  }
  const outDir = path.resolve(opt('saida', path.join(path.dirname(src), 'qa')));
  fs.mkdirSync(outDir, { recursive: true });
  const nome = path.basename(src, path.extname(src));
  const rel = { arquivo: src, preset, zona, quadrosTestados: frames, reprovado: trechos.length > 0,
    trechos: trechos.map((x) => ({ de: +t2(x.de), ate: +t2(x.ate + 1 / fpsTeste), lados: [...x.lados] })) };
  if (trechos.length) {
    reprovadas++;
    const pior = trechos.reduce((a, b) => (b.pior.px > a.pior.px ? b : a)).pior;
    const png = path.join(outDir, `${nome}-zona-${t2(pior.t)}s.png`);
    const caixa = (x, y, w, h) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=red@0.35:t=fill`;
    // camada por cima de um fundo cinza (o transparente vira cinza) + faixas proibidas em vermelho
    run(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x303030:s=${W}x${H}`, '-ss', t2(pior.t), '-i', src, '-frames:v', '1',
      '-filter_complex', [`[1:v]scale=${W}:${H},format=rgba[l]`, `[0:v][l]overlay=0:0:format=auto,${[
        caixa(0, 0, W, zona.topo), caixa(0, H - zona.base, W, zona.base), caixa(0, 0, zona.esq, H), caixa(W - zona.dir, 0, zona.dir, H),
        'scale=540:-2'].join(',')}`].join(';'), png]);
    rel.quadro = png;
    console.log(`REPROVADO ${path.basename(src)}: ${trechos.slice(0, 8).map((x) => `${t2(x.de)}–${t2(x.ate + 1 / fpsTeste)} s (${[...x.lados].join('/')})`).join(', ')}${trechos.length > 8 ? ' …' : ''}`);
    console.log(`          pior quadro: ${png}`);
  } else {
    console.log(`OK        ${path.basename(src)}: ${frames} quadros testados, nada dentro das faixas`);
  }
  fs.writeFileSync(path.join(outDir, `${nome}-zona.json`), JSON.stringify(rel, null, 1));
}
if (reprovadas) process.exitCode = 1;
