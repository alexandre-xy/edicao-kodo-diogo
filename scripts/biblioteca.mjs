#!/usr/bin/env node
// Biblioteca de assets gerais (config.json → biblioteca, no SSD). Categorias = mesmas pastas do ASSETS do cliente:
// trilha/, sfx/ (com subpastas livres: whoosh/, risers/…), transicoes/, overlays/.
// Cada subpasta da biblioteca é uma categoria. O projeto nunca aponta para a biblioteca: o que for usado é COPIADO
// para <cliente>/ASSETS/<categoria>/, assim o projeto e o pacote DaVinci funcionam em qualquer PC.
//   node biblioteca.mjs listar [categoria]
//   node biblioteca.mjs copiar --projeto "<raiz>/DATA/projeto.json" <categoria>/<arquivo> [...]
import { readdirSync, statSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { loadConfig } from "./lib/config.mjs";
import { loadProjeto } from "./lib/projeto.mjs";

const conf = loadConfig();
const BIB = conf.biblioteca;
if (!BIB || !existsSync(BIB)) throw new Error(`biblioteca não encontrada: ${BIB} (SSD plugado? ajuste biblioteca em config.local.json)`);
const [cmd, ...rest] = process.argv.slice(2);
const MIDIA = /\.(wav|mp3|aif+|m4a|flac|mov|mp4|webm|png)$/i;

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : MIDIA.test(f) ? [p] : []; });

if (cmd === "listar") {
  const cats = readdirSync(BIB).filter((c) => statSync(join(BIB, c)).isDirectory() && !c.startsWith(".") && (!rest[0] || c === rest[0]));
  for (const c of cats) {
    const fs = walk(join(BIB, c));
    console.log(`\n${c}/ (${fs.length})`);
    for (const f of fs) console.log(`  ${f.slice(join(BIB, c).length + 1).replaceAll("\\", "/")}`);
  }
} else if (cmd === "copiar") {
  const pj = loadProjeto();
  const itens = rest.filter((a, i) => a !== "--projeto" && rest[i - 1] !== "--projeto");
  for (const it of itens) {
    const src = join(BIB, it);
    if (!existsSync(src)) { console.log(`✘ não existe: ${it}`); continue; }
    const dst = join(pj.raiz, "ASSETS", it.split(/[\\/]/)[0], basename(it));
    mkdirSync(dirname(dst), { recursive: true });
    if (!existsSync(dst)) copyFileSync(src, dst);
    console.log(`✔ ASSETS/${it.split(/[\\/]/)[0]}/${basename(it)}`);
  }
} else {
  console.log("uso: biblioteca.mjs listar [categoria] | copiar --projeto <p> <categoria>/<arquivo> ...");
}
