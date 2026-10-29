#!/usr/bin/env node
// Etapa 0 · Verifica o ambiente da máquina (só leitura) e diz o que falta.
//   node ambiente.mjs
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { SKILL_DIR } from "./lib/projeto.mjs";
import { loadConfig } from "./lib/config.mjs";

const conf = loadConfig();
const res = [];
const ok = (nome, cond, dica) => res.push({ nome, ok: !!cond, dica });
const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000, shell: process.platform === "win32" }).trim(); } catch { return null; } };

ok("Node ≥ 20", Number(process.versions.node.split(".")[0]) >= 20, "atualize o Node");
ok("ffmpeg", run("ffmpeg", ["-version"]), "winget install Gyan.FFmpeg");
ok("ffprobe", run("ffprobe", ["-version"]), "vem com o ffmpeg");
const pin = conf.hyperframes_pin;
const npx = "npx";
ok(`HyperFrames ${pin}`, (run(npx, ["--yes", `hyperframes@${pin}`, "--version"]) || "").includes(pin), `npx --yes hyperframes@${pin} --version`);
const wcli = process.env.HYPERFRAMES_WHISPER_PATH || conf.whisper_cli;
const pyT = conf.python_transcricao;
ok("transcrição na GPU (faster-whisper)", pyT && existsSync(pyT) && run(pyT, ["-c", "import faster_whisper"]) !== null, "ver etapas/00-ambiente.md (venv-transcricao)");
ok("whisper.cpp (whisper-cli) — reserva sem GPU", wcli && existsSync(wcli), "baixar whisper-bin-x64.zip (ggml-org) e definir HYPERFRAMES_WHISPER_PATH");
const mdir = join(homedir(), ".cache", "hyperframes", "whisper", "models");
ok("modelo Whisper large-v3", existsSync(join(mdir, "ggml-large-v3.bin")), "baixa na 1ª transcrição (~3 GB)");
const pk = join(homedir(), ".cache", "hyperframes");
ok("Parakeet", existsSync(pk) && JSON.stringify(readdirSync(pk)).toLowerCase().includes("parakeet") || (run(npx, ["--yes", `hyperframes@${pin}`, "models", "list"]) || "").toLowerCase().includes("parakeet"), "npx hyperframes models install parakeet");
ok("@hyperframes/core (carve)", existsSync(join(conf.carve_core, "node_modules", "@hyperframes", "core")), `npm i --prefix "${conf.carve_core}" @hyperframes/core@${pin}`);
ok("raiz dos projetos acessível", existsSync(conf.raiz_projetos), `plugue o SSD (ou fixe a letra dele) ou ajuste raiz_projetos em ${join(SKILL_DIR, "config.local.json")}`);
ok("biblioteca de assets (SSD)", conf.biblioteca && existsSync(conf.biblioteca), `crie ${conf.biblioteca} (trilha/, sfx/, transicoes/, overlays/) ou ajuste biblioteca em config.local.json`);;
const pyV = conf.python_voz; // opcional: só avisa
if (pyV && !existsSync(pyV)) console.log("· locução por IA (Chatterbox) não instalada — opcional, ver etapas/00-ambiente.md");
for (const t of readdirSync(join(SKILL_DIR, "templates"))) ok(`template ${t}`, existsSync(join(SKILL_DIR, "templates", t, "style.json")), "style.json ausente");

for (const r of res) console.log(`${r.ok ? "✔" : "✘"} ${r.nome}${r.ok ? "" : `  → ${r.dica}`}`);
const falta = res.filter((r) => !r.ok).length;
console.log(falta ? `\n${falta} pendência(s).` : "\nAmbiente pronto.");
process.exitCode = falta ? 1 : 0;
