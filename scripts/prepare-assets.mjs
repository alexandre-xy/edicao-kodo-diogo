#!/usr/bin/env node
// Etapa 5 (início) · Prepara <hf>/assets a partir do template e da pasta ASSETS do cliente.
//   node prepare-assets.mjs --projeto <p>
// - fontes e SFX do template  → assets/fonts, assets/sfx
// - trilha do cliente         → assets/music.mp3
// - transições overlay        → assets/tr/tN.mp4 (cobrindo a saída, fps do projeto, SEM timecode) + tN.wav (ganho nivelado)
// - assetsPreparados          → recortes/fades de risers etc. (receita ffmpeg no projeto.json)
// - cria o esqueleto do projeto HyperFrames (package.json, hyperframes.json, meta.json) se não existir
import { execFileSync } from "node:child_process";
import { readdirSync, mkdirSync, copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { loadProjeto } from "./lib/projeto.mjs";

const pj = loadProjeto();
const { cfg, tplDir, hf } = pj;
const A = join(hf, "assets");
for (const d of ["fonts", "sfx", "tr"]) mkdirSync(join(A, d), { recursive: true });
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);

// esqueleto HyperFrames
const pin = cfg.hyperframes.pin;
if (!existsSync(join(hf, "package.json"))) writeFileSync(join(hf, "package.json"), JSON.stringify({ name: cfg.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-"), private: true, type: "module",
  scripts: { dev: `npx --yes hyperframes@${pin} preview`, check: `npx --yes hyperframes@${pin} check`, render: `npx --yes hyperframes@${pin} render` } }, null, 2) + "\n");
if (!existsSync(join(hf, "hyperframes.json"))) writeFileSync(join(hf, "hyperframes.json"), JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true }, authoringSkill: "general-video" }, null, 2) + "\n");
if (!existsSync(join(hf, "meta.json"))) writeFileSync(join(hf, "meta.json"), JSON.stringify({ id: cfg.nome.toLowerCase(), name: cfg.nome }, null, 2) + "\n");

// template
for (const f of readdirSync(join(tplDir, "fontes"))) if (/\.(woff2?|ttf|otf)$/i.test(f)) copyFileSync(join(tplDir, "fontes", f), join(A, "fonts", f));
for (const f of readdirSync(join(tplDir, "sfx"))) if (/\.(mp3|wav)$/i.test(f)) copyFileSync(join(tplDir, "sfx", f), join(A, "sfx", f));

// trilha
if (cfg.trilha?.fonte) copyFileSync(pj.P(cfg.trilha.fonte), join(A, "music.mp3"));

// transições overlay: cobre a saída, fps do projeto, sem timecode (regra do pacote DaVinci)
for (const [id, t] of Object.entries(cfg.transicoes?.arquivos || {})) {
  const src = pj.P(t.fonte);
  ff(["-i", src, "-vf", `scale=${pj.W}:${pj.H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${pj.W}:${pj.H},fps=${pj.fpsStr},format=yuv420p`,
    "-an", "-map_metadata", "-1", "-write_tmcd", "0", "-c:v", "libx264", "-crf", "14", "-g", "6", join(A, "tr", `${id}.mp4`)]);
  ff(["-i", src, "-vn", "-af", `volume=${t.ganhoAudioDb}dB,alimiter=limit=0.89`, "-ar", "48000", join(A, "tr", `${id}.wav`)]);
}

// receitas de assets do cliente (risers etc.)
for (const p of cfg.assetsPreparados || []) {
  const out = join(A, p.destino);
  mkdirSync(dirname(out), { recursive: true });
  ff([...(p.ss != null ? ["-ss", String(p.ss)] : []), ...(p.t != null ? ["-t", String(p.t)] : []), "-i", pj.P(p.fonte), ...(p.af ? ["-af", p.af] : []), "-ar", "48000", out]);
}
console.log(`assets prontos em ${A}`);
