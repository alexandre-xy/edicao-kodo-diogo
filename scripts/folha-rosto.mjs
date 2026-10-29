#!/usr/bin/env node
// Etapa 3 · Folha de grade para medir o ROSTO do orador (regra: a legenda nunca cobre o rosto).
//   node folha-rosto.mjs --projeto <p> [--fps 1]
// Gera <hf>/build/folha-rosto.jpg: 1 quadro/s do picture.mp4 com linhas a cada 10% da altura e o tempo em cada quadro.
// Leia a folha e preencha no projeto.json: "rosto": [{ "de": s, "ate": s, "y0": px, "y1": px }]
//   y0 = topo do cabelo, y1 = queixo, em px do quadro 1080×1920 (10% = 192 px). Um item por enquadramento/plano (muda no corte).
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadProjeto } from "./lib/projeto.mjs";

const pj = loadProjeto();
const i = process.argv.indexOf("--fps"), fps = i > 0 ? process.argv[i + 1] : "1";
const out = join(pj.hf, "build", "folha-rosto.jpg");
const vf = `fps=${fps},scale=270:480,drawgrid=w=270:h=48:t=1:c=yellow@0.55,drawtext=text='%{pts\:hms}':fontcolor=white:fontsize=14:x=4:y=4:box=1:boxcolor=black@0.6,tile=9x4`;
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(pj.hf, "assets", "picture.mp4"), "-vf", vf, "-frames:v", "1", out]);
console.log("folha:", out, "\nlinhas amarelas a cada 10% da altura (192 px). Preencha projeto.json → rosto[]");
