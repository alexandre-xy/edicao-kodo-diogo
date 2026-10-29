// Configuração da máquina: config.json (versionado, padrão para todos os PCs) + config.local.json (só deste PC, fora do git).
// "~" no começo de um caminho = pasta do usuário (C:\Users\<usuário>), então o mesmo config.json serve em qualquer máquina.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { SKILL_DIR } from "./projeto.mjs";

const expand = (v) => (typeof v === "string" && /^~[\\/]/.test(v) ? join(homedir(), v.slice(2)) : v);

export function loadConfig() {
  const base = JSON.parse(readFileSync(join(SKILL_DIR, "config.json"), "utf8"));
  const localFile = join(SKILL_DIR, "config.local.json");
  const local = existsSync(localFile) ? JSON.parse(readFileSync(localFile, "utf8")) : {};
  const conf = { ...base, ...local };
  for (const k of Object.keys(conf)) conf[k] = expand(conf[k]);
  return conf;
}
