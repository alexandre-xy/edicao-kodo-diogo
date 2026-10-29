// Carrega o projeto (DATA/projeto.json) e o template da skill. Todos os scripts usam isto:
//   node <script> --projeto "<raiz do cliente>/DATA/projeto.json"   (ou variável KODO_PROJETO)
import { readFileSync, existsSync, linkSync, copyFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadProjeto(argv = process.argv) {
  const i = argv.indexOf("--projeto");
  const p = i > 0 ? argv[i + 1] : process.env.KODO_PROJETO;
  if (!p) throw new Error('informe --projeto "<raiz>/DATA/projeto.json" (ou a variável KODO_PROJETO)');
  const file = resolve(p);
  const cfg = JSON.parse(readFileSync(file, "utf8"));
  const raiz = resolve(dirname(file), cfg.raiz ?? "..");
  const P = (rel) => (isAbsolute(rel) ? rel : join(raiz, rel));
  const [num, den] = String(cfg.saida.fps).split("/").map(Number);
  const fpsNum = num, fpsDen = den || 1;
  const tplDir = join(SKILL_DIR, "templates", cfg.template);
  if (!existsSync(join(tplDir, "style.json"))) throw new Error(`template não encontrado: ${tplDir}`);
  const tpl = JSON.parse(readFileSync(join(tplDir, "style.json"), "utf8"));
  const hf = P(cfg.pastas?.hf ?? "DATA/hf");
  return {
    cfg, file, raiz, P, tpl, tplDir,
    data: P("DATA"), hf, build: join(hf, "build"),
    src: P(cfg.fonte.video),
    fpsNum, fpsDen, fps: fpsNum / fpsDen, fpsStr: `${fpsNum}/${fpsDen}`,
    W: cfg.saida.largura, H: cfg.saida.altura,
    flag: (name) => argv.includes(name),
  };
}

// arquivos grandes: hardlink (não ocupa espaço extra; mesmo volume) com cópia como reserva
export function linkOrCopy(src, dst) {
  mkdirSync(dirname(dst), { recursive: true });
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) return;
  try { linkSync(src, dst); } catch { copyFileSync(src, dst); }
}

export const r3 = (n) => Math.round(n * 1000) / 1000;
