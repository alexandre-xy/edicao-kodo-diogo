#!/usr/bin/env node
// Checagem de entrega de um vídeo renderizado (etapa final da edicao-kodo), sem dependências além de ffmpeg/ffprobe.
// Adaptado de tools/qa.mjs e tools/pops.mjs de github.com/Mort1d/motion-graphics-skills (MIT, ver LICENSE-mort1d.txt).
//
// Verifica: codec / tamanho / fps / duração, áudio, loudness integrado e true peak, trechos pretos ou congelados,
// silêncios longos, quadros vazios (buraco entre grafismos), quadros soltos de 1 frame (pops) e se o começo se mexe.
// Gera uma folha de 24 quadros do arquivo final e um qa.json ao lado do vídeo.
//
//   node qa.mjs <video.mp4> [--w 1080] [--h 1920] [--fps 30] [--dur 63.2] [--lufs -14] [--saida <pasta>]
//
// Código de saída 1 quando há REPROVADO. ATENÇÃO são coisas para olhar, podem ser intencionais.
// ffmpeg/ffprobe vêm do PATH, ou das variáveis FFMPEG e FFPROBE.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';
const args = process.argv.slice(2);
const VALUED = ['--w', '--h', '--fps', '--dur', '--lufs', '--saida'];
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const file = args.find((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]));
if (!file) { console.error('uso: node qa.mjs <video.mp4> [--w 1080] [--h 1920] [--fps 30] [--dur 63.2] [--lufs -14]'); process.exit(2); }
const src = path.resolve(file);
if (!fs.existsSync(src)) { console.error(`arquivo não encontrado: ${src}`); process.exit(2); }

const wantW = Number(opt('w', 1080));
const wantH = Number(opt('h', 1920));
const wantFps = opt('fps') ? Number(opt('fps')) : null;
const wantDur = opt('dur') ? Number(opt('dur')) : null;
const target = Number(opt('lufs', -14));
const name = path.basename(src, path.extname(src));
const outDir = path.resolve(opt('saida', path.join(path.dirname(src), 'qa')));

const rows = [];
const add = (level, what, detail) => rows.push({ level, what, detail });
const run = (bin, a, o = {}) => {
  const r = spawnSync(bin, a, { maxBuffer: 1 << 30, ...o });
  if (r.error) { console.error(`não consegui rodar ${bin}: ${r.error.message} (está no PATH? ou defina ${bin === FFMPEG ? 'FFMPEG' : 'FFPROBE'})`); process.exit(2); }
  return r;
};

// ---- container ----------------------------------------------------------------------------------------------------
const probe = JSON.parse(run(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', src], { encoding: 'utf8' }).stdout || '{}');
if (!probe.format) { console.error(`não consegui ler ${src}`); process.exit(2); }
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
if (!v) { console.error('o arquivo não tem vídeo'); process.exit(2); }
const dur = Number(probe.format.duration);
const fps = v.r_frame_rate.split('/').map(Number).reduce((x, y) => x / y);
const avg = (v.avg_frame_rate || '0/1').split('/').map(Number).reduce((x, y) => (y ? x / y : 0));

add(v.codec_name === 'h264' && v.pix_fmt === 'yuv420p' ? 'OK' : 'REPROVADO', 'vídeo', `${v.codec_name} ${v.pix_fmt} ${v.profile ?? ''} (redes pedem h264 yuv420p)`);
add(v.width === wantW && v.height === wantH ? 'OK' : 'REPROVADO', 'tamanho', `${v.width}x${v.height} (esperado ${wantW}x${wantH})`);
if (wantFps) add(Math.abs(fps - wantFps) < 0.01 ? 'OK' : 'REPROVADO', 'fps', `${fps.toFixed(3)} (esperado ${wantFps})`);
else add('INFO', 'fps', `${fps.toFixed(3)}`);
if (avg && Math.abs(avg - fps) > 0.05) add('ATENÇÃO', 'fps variável', `média ${avg.toFixed(3)} ≠ nominal ${fps.toFixed(3)}: arquivo VFR, pode dessincronizar no DaVinci`);
if (wantDur) add(Math.abs(dur - wantDur) <= 0.1 ? 'OK' : 'ATENÇÃO', 'duração', `${dur.toFixed(2)} s (esperado ${wantDur} s)`);
else add('INFO', 'duração', `${dur.toFixed(2)} s`);
if (!a) add('REPROVADO', 'áudio', 'o arquivo não tem trilha de áudio');
else add(a.codec_name === 'aac' && Number(a.sample_rate) === 48000 && a.channels === 2 ? 'OK' : 'ATENÇÃO', 'áudio', `${a.codec_name} ${a.sample_rate} Hz ${a.channels} canais ${Math.round((a.bit_rate || 0) / 1000)} kb/s (esperado aac 48 kHz estéreo)`);
add('INFO', 'arquivo', `${(probe.format.size / 1048576).toFixed(1)} MB, ${Math.round(probe.format.bit_rate / 1000)} kb/s`);

// ---- uma passada: preto, congelado, loudness, silêncio --------------------------------------------------------------
const fc = ['[0:v]blackdetect=d=0.5:pix_th=0.08,freezedetect=n=-60dB:d=2[vo]'];
if (a) fc.push('[0:a]ebur128=peak=true,silencedetect=n=-50dB:d=1.5[ao]');
const log = run(FFMPEG, ['-hide_banner', '-nostats', '-i', src, '-filter_complex', fc.join(';'), '-map', '[vo]', ...(a ? ['-map', '[ao]'] : []), '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
const t2 = (x) => `${x.toFixed(2)}`;
for (const m of log.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) {
  const [s, e] = [Number(m[1]), Number(m[2])];
  add(s < 0.05 || e > dur - 0.3 ? 'INFO' : 'ATENÇÃO', 'preto', `${t2(s)}–${t2(e)} s quase preto${s < 0.05 ? ' (início)' : e > dur - 0.3 ? ' (final)' : ''}`);
}
const fs0 = [...log.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
const fe0 = [...log.matchAll(/freeze_end: ([\d.]+)/g)].map((m) => Number(m[1]));
fs0.forEach((s, i) => {
  const e = fe0[i] ?? dur;
  add(s > dur - 4 ? 'INFO' : 'ATENÇÃO', 'congelado', `${t2(s)}–${t2(e)} s sem nenhum pixel mudar por ${(e - s).toFixed(1)} s (num talking head isso quase sempre é erro)`);
});
if (a) {
  const sum = log.slice(log.lastIndexOf('Summary:'));
  const I = Number(sum.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]);
  const LRA = Number(sum.match(/LRA:\s+([\d.]+) LU/)?.[1]);
  const TP = Number(sum.match(/True peak:\s+Peak:\s+(-?[\d.inf]+) dBFS/)?.[1]);
  add(I >= target - 1.5 && I <= target + 1.5 ? 'OK' : 'ATENÇÃO', 'loudness', `${I} LUFS integrado (alvo ${target}), LRA ${LRA} LU`);
  add(TP <= -1 ? 'OK' : TP <= 0 ? 'ATENÇÃO' : 'REPROVADO', 'true peak', `${TP} dBTP (manter ≤ -1)`);
  for (const m of log.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)) {
    const [s, e] = [Number(m[1]), Number(m[2])];
    add(s > dur - 2 ? 'INFO' : 'ATENÇÃO', 'silêncio', `${t2(s)}–${t2(e)} s abaixo de -50 dB (pausa esquecida no corte?)`);
  }
}

// ---- quadro a quadro em miniatura: quadros vazios, pops, começo parado ------------------------------------------------
{
  const sw = 96;
  const shh = Math.max(2, Math.round((sw * v.height) / v.width / 2) * 2);
  const px = run(FFMPEG, ['-v', 'error', '-i', src, '-vf', `scale=${sw}:${shh}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']).stdout;
  const n = sw * shh;
  const frames = Math.floor(px.length / (n * 3));
  const grey = Buffer.alloc(frames * n);
  for (let i = 0; i < frames * n; i++) grey[i] = Math.round(0.299 * px[3 * i] + 0.587 * px[3 * i + 1] + 0.114 * px[3 * i + 2]);
  const diff = (i, j) => { let d = 0; for (let k = 0, x = i * n, y = j * n; k < n; k++) d += Math.abs(grey[x + k] - grey[y + k]); return d / n; };

  // quadros vazios: quase tudo da cor dominante (buraco entre um grafismo e o próximo)
  const flat = [];
  for (let f = 0; f < frames; f++) {
    const o = f * n * 3; const hist = new Map();
    for (let i = 0; i < n; i++) { const k = ((px[o + 3 * i] >> 4) << 8) | ((px[o + 3 * i + 1] >> 4) << 4) | (px[o + 3 * i + 2] >> 4); hist.set(k, (hist.get(k) || 0) + 1); }
    let bk = 0; let bn = -1; for (const [k, c] of hist) if (c > bn) { bn = c; bk = k; }
    const bg = [((bk >> 8) & 15) * 16 + 8, ((bk >> 4) & 15) * 16 + 8, (bk & 15) * 16 + 8];
    let on = 0;
    for (let i = 0; i < n; i++) if (Math.abs(px[o + 3 * i] - bg[0]) + Math.abs(px[o + 3 * i + 1] - bg[1]) + Math.abs(px[o + 3 * i + 2] - bg[2]) > 60) on++;
    flat.push(on / n < 0.004);
  }
  const runs = [];
  for (let f = 0; f < frames;) {
    if (!flat[f]) { f++; continue; }
    let e = f; while (e < frames && flat[e]) e++;
    if (e - f >= 2 && f / fps > 0.5 && e / fps < dur - 0.5) runs.push([f / fps, e / fps]);
    f = e;
  }
  if (runs.length) add('ATENÇÃO', 'quadro vazio', `${runs.slice(0, 6).map(([s, e]) => `${t2(s)}–${t2(e)} s`).join(', ')}${runs.length > 6 ? ' …' : ''}: tela lisa, provável buraco entre cenas`);
  else add('OK', 'quadro vazio', 'nenhum trecho de tela lisa no meio do vídeo');

  // pops: um quadro diferente dos dois vizinhos, que são parecidos entre si (grafismo que pisca, cena entrando 1 frame antes)
  const pops = [];
  for (let k = 1; k < frames - 1; k++) {
    const into = diff(k - 1, k); if (into < 4) continue;
    const out = diff(k, k + 1); if (out < 4) continue;
    if (diff(k - 1, k + 1) < 0.35 * Math.min(into, out)) { pops.push(k / fps); k++; }
  }
  if (pops.length) add('ATENÇÃO', 'pops', `quadro solto em ${pops.slice(0, 8).map((t) => `${t.toFixed(3)} s`).join(', ')}${pops.length > 8 ? ' …' : ''}: conferir quadro a quadro`);
  else add('OK', 'pops', 'nenhum quadro solto de 1 frame');

  // o começo se mexe? maior trecho parado no primeiro 1,5 s
  const first = Math.min(frames - 1, Math.round(1.5 * fps));
  let still = 0; let cur = 0; let at = 0;
  for (let k = 1; k <= first; k++) {
    cur = diff(k, k - 1) > 0.1 ? 0 : cur + 1;
    if (cur > still) { still = cur; at = (k - cur) / fps; }
  }
  add(still / fps <= 0.5 ? 'OK' : 'ATENÇÃO', 'gancho', still / fps <= 0.5
    ? `o começo se mexe (maior trecho parado no 1,5 s inicial: ${(still / fps).toFixed(2)} s)`
    : `nada se mexe por ${(still / fps).toFixed(2)} s a partir de ${at.toFixed(2)} s: no feed a pessoa passa direto`);
}

// ---- folha de quadros do arquivo final ------------------------------------------------------------------------------
fs.mkdirSync(outDir, { recursive: true });
const cells = 24;
const sheet = path.join(outDir, `${name}-folha.png`);
const tw = v.width >= v.height ? 320 : 200;
run(FFMPEG, ['-v', 'error', '-y', '-i', src, '-vf', `fps=${cells}/${dur.toFixed(3)},scale=${tw}:-2,tile=6x${Math.ceil(cells / 6)}:padding=4:color=0x202020`, '-frames:v', '1', sheet]);
if (fs.existsSync(sheet)) add('INFO', 'folha', sheet);

// ---- relatório ------------------------------------------------------------------------------------------------------
const fails = rows.filter((x) => x.level === 'REPROVADO').length;
const warns = rows.filter((x) => x.level === 'ATENÇÃO').length;
fs.writeFileSync(path.join(outDir, `${name}-qa.json`), JSON.stringify({ arquivo: src, reprovado: fails, atencao: warns, itens: rows }, null, 1));
console.log(`QA ${src}`);
for (const r of rows) console.log(`${r.level.padEnd(9)} ${r.what.padEnd(13)} ${r.detail}`);
console.log(fails ? `${fails} REPROVADO, ${warns} ATENÇÃO` : `nada reprovado${warns ? `, ${warns} ATENÇÃO para olhar` : ''}`);
if (fails) process.exitCode = 1;
