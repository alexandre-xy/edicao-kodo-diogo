#!/usr/bin/env node
// Estima o deslocamento da câmera (o plano não é fixo) em relação ao frame de referência (t = 20 s),
// comparando a faixa de fundo à esquerda (parede + placa) em baixa resolução.
// Uso: trackOffset(t) → { dx, dy } em pixels do 4K. Usado pelo build-edit para mover o desfoque da logo.
import { execFileSync } from "node:child_process";

import { loadProjeto } from "./lib/projeto.mjs";
// parâmetros em projeto.json → disfarce.rastreio { ref_t, regiao: [x, y, w, h] (em 1/8 da fonte), busca }
const pj = loadProjeto();
const SRC = pj.src;
const TR = pj.cfg.disfarce.rastreio;
const LW = Math.round(pj.cfg.fonte.largura / 8), LH = Math.round(pj.cfg.fonte.altura / 8), K = pj.cfg.fonte.largura / LW;
const REF_T = TR.ref_t;
const [RX, RY, RW, RH] = TR.regiao;
const SEARCH = TR.busca;

function gray(t) {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", SRC, "-frames:v", "1", "-vf", `scale=${LW}:${LH},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 });
  return new Uint8Array(buf.buffer, buf.byteOffset, LW * LH);
}
const ref = gray(REF_T);
// gradiente simples para não depender de exposição
const grad = (img) => {
  const g = new Float32Array(LW * LH);
  for (let y = 1; y < LH - 1; y++) for (let x = 1; x < LW - 1; x++) {
    const i = y * LW + x;
    g[i] = Math.abs(img[i + 1] - img[i - 1]) + Math.abs(img[i + LW] - img[i - LW]);
  }
  return g;
};
const gref = grad(ref);

export function trackOffset(t) {
  const g = grad(gray(t));
  let best = { cost: Infinity, dx: 0, dy: 0 };
  for (let dy = -SEARCH; dy <= SEARCH; dy++) for (let dx = -SEARCH; dx <= SEARCH; dx++) {
    let c = 0, n = 0;
    for (let y = RY; y < RY + RH; y += 2) {
      const yy = y + dy;
      if (yy < 1 || yy >= LH - 1) continue;
      for (let x = RX; x < RX + RW; x += 2) {
        const xx = x + dx;
        if (xx < 1 || xx >= LW - 1) continue;
        c += Math.abs(gref[y * LW + x] - g[yy * LW + xx]);
        n++;
      }
    }
    c /= n || 1;
    if (c < best.cost) best = { cost: c, dx, dy };
  }
  return { dx: Math.round(best.dx * K), dy: Math.round(best.dy * K), cost: +best.cost.toFixed(1) };
}

if (process.argv[1] && process.argv[1].endsWith("track-bg.mjs")) {
  for (const t of process.argv.slice(2).filter((a) => /^[d.]+$/.test(a)).map(Number)) console.log(t, JSON.stringify(trackOffset(t)));
}
