#!/usr/bin/env node
// Etapa 1 · Cria a pasta do cliente com a estrutura padrão e um DATA/projeto.json a partir do modelo.
//   node novo-projeto.mjs --nome "<Cliente_Projeto>" [--raiz "<pasta>"] [--template editorial-pictograma] [--modo corte+finalizacao]
// Raiz padrão: config.json → raiz_projetos. Nunca sobrescreve nada que já exista.
import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { SKILL_DIR } from "./lib/projeto.mjs";
import { loadConfig } from "./lib/config.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const conf = loadConfig();
const nome = arg("--nome");
if (!nome) throw new Error('informe --nome "<Cliente_Projeto>"');
const raiz = join(arg("--raiz", conf.raiz_projetos), nome);
const PASTAS = ["FOOTAGE", "ASSETS/trilha", "ASSETS/sfx", "ASSETS/transicoes", "ASSETS/logos", "ASSETS/broll", "REFS", "RENDERS",
  "DAVINCI_PROJECT/entrada", "DAVINCI_PROJECT/saida", "DATA/transcricao", "DATA/cache", "DATA/hf"];
for (const p of PASTAS) mkdirSync(join(raiz, p), { recursive: true });

const pj = join(raiz, "DATA", "projeto.json");
if (!existsSync(pj)) {
  const m = JSON.parse(readFileSync(join(SKILL_DIR, "modelos", "projeto.modelo.json"), "utf8"));
  m.nome = nome; m.titulo = nome;
  m.template = arg("--template", m.template);
  m.modo = arg("--modo", m.modo);
  m.hyperframes.pin = conf.hyperframes_pin;
  writeFileSync(pj, JSON.stringify(m, null, 2) + "\n");
}
const cenas = join(raiz, "DATA", "cenas.mjs");
if (!existsSync(cenas)) copyFileSync(join(SKILL_DIR, "modelos", "cenas.modelo.mjs"), cenas);
console.log(`projeto pronto: ${raiz}\n  → coloque os brutos em FOOTAGE/ (ou o .fcpxml + mixdown em DAVINCI_PROJECT/entrada/) e preencha DATA/projeto.json`);
