#!/usr/bin/env node
// Junta o texto do Whisper large-v3 (mais fiel à fala) com os tempos do Parakeet (mais precisos)
// e trava as bordas das palavras nos silêncios reais do áudio (o áudio tem gate: pausa = silêncio digital).
// Saída: <hf>/build/words.json  [{ i, text, start, end }] (índices do Whisper) + silences.json.
//   node align-words.mjs --projeto <DATA/projeto.json>
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadProjeto } from "./lib/projeto.mjs";

const pj = loadProjeto();
const T = pj.cfg.transcricao;
const AUDIO = pj.P(T.audio16k); // WAV PCM 16 kHz mono (Etapa 2) — nunca MP3 em etapa que mede tempo
const whisper = JSON.parse(readFileSync(pj.P(T.whisper), "utf8"));
const parakeet = JSON.parse(readFileSync(pj.P(T.parakeet), "utf8"));
const DUR = T.duracao ?? 77.3;
mkdirSync(pj.build, { recursive: true });

// silêncios (energia < −50 dB por ≥ 150 ms)
const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", AUDIO, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
const s = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
const env = [];
for (let i = 0; i + 160 <= s.length; i += 160) {
  let a = 0;
  for (let j = i; j < i + 160; j++) a += s[j] * s[j];
  env.push(10 * Math.log10(a / 160 / 32768 / 32768 + 1e-12));
}
const sil = [];
for (let i = 0, st = null; i <= env.length; i++) {
  const q = i < env.length && env[i] < -50;
  if (q && st === null) st = i;
  if (!q && st !== null) { if (i - st >= 15) sil.push([st / 100, i / 100]); st = null; }
}

// alinhamento por programação dinâmica (Needleman–Wunsch) sobre palavras normalizadas
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
const sim = (a, b) => {
  a = norm(a); b = norm(b);
  if (a === b) return 2;
  if (a.length > 2 && b.length > 2 && (a.startsWith(b.slice(0, 3)) || b.startsWith(a.slice(0, 3)))) return 1;
  if ((a === "ta" && b === "esta") || (a === "pra" && b === "por") || (a === "tu" && b === "voce")) return 1;
  return -1;
};
const W = whisper.length, P = parakeet.length, GAP = -1;
const D = Array.from({ length: W + 1 }, () => new Float64Array(P + 1));
for (let i = 1; i <= W; i++) D[i][0] = i * GAP;
for (let j = 1; j <= P; j++) D[0][j] = j * GAP;
for (let i = 1; i <= W; i++) for (let j = 1; j <= P; j++)
  D[i][j] = Math.max(D[i - 1][j - 1] + sim(whisper[i - 1].text, parakeet[j - 1].text), D[i - 1][j] + GAP, D[i][j - 1] + GAP);
const match = new Array(W).fill(null);
for (let i = W, j = P; i > 0 && j > 0; ) {
  if (D[i][j] === D[i - 1][j - 1] + sim(whisper[i - 1].text, parakeet[j - 1].text)) {
    if (sim(whisper[i - 1].text, parakeet[j - 1].text) > 0) match[i - 1] = parakeet[j - 1];
    i--; j--;
  } else if (D[i][j] === D[i - 1][j] + GAP) i--;
  else j--;
}

// tempos: casados vêm do Parakeet; não casados são interpolados entre vizinhos casados
const out = whisper.map((w, i) => ({ i, text: w.text, start: match[i]?.start ?? null, end: match[i]?.end ?? null }));
for (let i = 0; i < W; i++) {
  if (out[i].start !== null) continue;
  let a = i; while (a < W && out[a].start === null) a++;
  const prevEnd = i > 0 ? out[i - 1].end : 0, nextStart = a < W ? out[a].start : DUR;
  const n = a - i, step = Math.max(nextStart - prevEnd, 0.08 * n) / n;
  for (let k = 0; k < n; k++) { out[i + k].start = prevEnd + k * step; out[i + k].end = prevEnd + (k + 1) * step; }
}
// trava nas bordas dos silêncios: nada começa ou termina dentro de um silêncio
for (const w of out) {
  for (const [a, b] of sil) {
    if (w.start >= a && w.start < b) w.start = b;
    if (w.end > a && w.end <= b) w.end = a;
  }
  if (w.end <= w.start) w.end = w.start + 0.06;
}
for (let i = 1; i < W; i++) if (out[i].start < out[i - 1].start) out[i].start = out[i - 1].end;

writeFileSync(join(pj.build, "words.json"), JSON.stringify(out.map((w) => ({ ...w, start: +w.start.toFixed(3), end: +w.end.toFixed(3) })), null, 1));
writeFileSync(join(pj.build, "silences.json"), JSON.stringify(sil));
console.log(`casadas ${match.filter(Boolean).length}/${W} · silêncios ${sil.length}`);
if (process.argv.includes("--verbose")) console.log(out.map((w) => `${w.i}:${w.text}[${w.start.toFixed(2)}${match[w.i] ? "" : "*"}]`).join(" ")); // lista completa só com --verbose (economia de tokens)
