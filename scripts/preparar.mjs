#!/usr/bin/env node
// Etapa 2 · Preparação técnica (1x por projeto).
//   node preparar.mjs --projeto <p> [--transcrever]
// 1) inspeciona a fonte (VFR, HEVC, HDR, timecode, áudio) → DATA/relatorio_tecnico.json
// 2) extrai WAV PCM 16 kHz mono → transcricao.audio16k (nunca MP3)
// 3) --transcrever: Whisper large-v3 (texto) + Parakeet (tempos) via HyperFrames CLI → transcricao.whisper / .parakeet
// Conformar VFR/HDR, sincronizar áudio externo e VAD ainda são manuais (não validados) — o relatório avisa.
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadProjeto, SKILL_DIR } from "./lib/projeto.mjs";
import { loadConfig } from "./lib/config.mjs";

const pj = loadProjeto();
const { cfg } = pj;
const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries",
  "stream=index,codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,pix_fmt,color_transfer,color_primaries,sample_rate,channels:stream_tags=timecode:format=duration:format_tags=timecode",
  "-of", "json", pj.src], { encoding: "utf8" }));
const v = probe.streams.find((s) => s.codec_type === "video");
const a = probe.streams.find((s) => s.codec_type === "audio");
const frac = (f) => { const [n, d] = String(f).split("/").map(Number); return d ? n / d : n; };
const alertas = [];
if (v && Math.abs(frac(v.r_frame_rate) - frac(v.avg_frame_rate)) > 0.01) alertas.push(`VFR suspeito (r=${v.r_frame_rate}, média=${v.avg_frame_rate}) → conformar para CFR ${pj.fpsStr}`);
if (v && Math.abs(frac(v.r_frame_rate) - pj.fps) > 0.01) alertas.push(`fps da fonte ${v.r_frame_rate} ≠ fps do projeto ${pj.fpsStr}`);
if (v && /hevc|h265/i.test(v.codec_name)) alertas.push("HEVC/H.265: decodificação pesada; considerar proxy");
if (v && /(arib-std-b67|smpte2084)/.test(v.color_transfer || "")) alertas.push(`HDR (${v.color_transfer}) → decidir SDR/tonemap antes do corte`);
const tc = probe.format?.tags?.timecode || v?.tags?.timecode;
if (tc) alertas.push(`timecode embutido ${tc} (ok na fonte; no pacote DaVinci a mídia sai sem timecode)`);
if (!a) alertas.push("sem trilha de áudio na fonte (vídeo sem fala = fora do escopo v1, ou áudio externo a sincronizar)");
const rel = { fonte: pj.src, duracao: +probe.format.duration, video: v, audio: a, alertas, gerado: new Date().toISOString() };
writeFileSync(join(pj.data, "relatorio_tecnico.json"), JSON.stringify(rel, null, 2));

const LANG = String(cfg.briefing?.idioma || "pt-BR").slice(0, 2).toLowerCase(); // idioma da fala (briefing.idioma)
const wav = pj.P(cfg.transcricao.audio16k);
mkdirSync(dirname(wav), { recursive: true });
if (!existsSync(wav)) execFileSync("ffmpeg", ["-v", "error", "-y", "-i", pj.src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

if (pj.flag("--transcrever")) {
  const conf = loadConfig();
  const env = { ...process.env, HYPERFRAMES_WHISPER_PATH: process.env.HYPERFRAMES_WHISPER_PATH || conf.whisper_cli };
  const tmp = join(pj.data, "cache", "asr");
  for (const [eng, extra, dst] of [["whisper", ["-m", "large-v3", "-l", LANG], cfg.transcricao.whisper], ["parakeet", ["-l", LANG], cfg.transcricao.parakeet]]) {
    const d = join(tmp, eng);
    mkdirSync(d, { recursive: true });
    copyFileSync(wav, join(d, "audio.wav"));
    execFileSync("npx", ["--yes", `hyperframes@${cfg.hyperframes.pin}`, "transcribe", "audio.wav", "-e", eng, ...extra, "-d", ".", "--json"], { cwd: d, env, shell: process.platform === "win32", stdio: ["ignore", "pipe", "inherit"] });
    copyFileSync(join(d, "transcript.json"), pj.P(dst));
  }
}
console.log(`relatório: ${join(pj.data, "relatorio_tecnico.json")}\nalertas: ${alertas.length ? "\n - " + alertas.join("\n - ") : "nenhum"}`);
