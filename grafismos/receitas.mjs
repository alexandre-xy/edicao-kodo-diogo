// Receitas de grafismo (HyperFrames registry, arquivos fixados em grafismos/vendor/).
// Cada receita: (item, ctx) => { html, css, js[], sfx[[arquivo, t, vol, dur]] }
//   item = { receita, em: <índice de palavra>, dados: {...}, caixa: [top, altura] }
//   ctx  = { id, t0, t1, W, WE, T, tpl, SFX, box:[top,altura], panelW }
// Nomes pelo que a receita FAZ; o id do registry fica em `origem`.
// Cores/fonte vêm do template (style.json) via variáveis CSS que as receitas já respeitam.
import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), "vendor");
const vend = (id) => readFileSync(join(VENDOR, `${id}.html`), "utf8");
const attr = (o) => JSON.stringify(o).replace(/'/g, "&#39;");

function tokens(tpl) {
  const c = tpl.cores, f = `'${tpl.fontes[0].familia}',Inter,sans-serif`;
  return `--bg:transparent;--fg:${c.painelTexto ?? c.tinta};--accent:${c.vermelho};--accent-2:${c.amarelo};--brand:${c.vermelho};--surface:${c.superficie ?? "#FFFFFF"};--border:${c.grade};--font-body:${f};--font-display:${f};`;
}
const boxStyle = (c, extra = "") => `position:absolute;left:0;top:${c.box[0]}px;width:${c.panelW}px;height:${c.box[1]}px;${extra}`;
// sub-composição elástica (a receita se dimensiona pela caixa) + escala para o formato vertical
function host(origem, c, vars, escala, dur) {
  return `<div id="${c.id}" class="clip" data-composition-id="${origem}" data-composition-src="compositions/components/${origem}.html" data-start="${c.T(c.t0)}" data-duration="${c.T(dur ?? c.t1 - c.t0)}" data-track-index="${c.track}" data-width="${c.panelW}" data-height="${c.box[1]}" style="${boxStyle(c, `transform:scale(${escala});transform-origin:50% 50%;${tokens(c.tpl)}`)}" data-variable-values='${attr(vars)}'></div>`;
}

export const RECEITAS = {
  // "barato" riscado → "caro". origem: strikethrough-replace
  "troca-riscada": {
    origem: "strikethrough-replace",
    build(it, c) {
      const d = it.dados;
      const snippet = vend("strikethrough-replace").replace("<span>Slow</span>", `<span>${d.de}</span>`).replace("<strong>Fast</strong>", `<strong>${d.para}</strong>`)
        .replace("font-size: 58px;", `font-size: ${d.tamanho ?? 150}px;`).replace("gap: 18px;", "gap: 40px;");
      const sel = `#${c.id} .hf-catalog-strikethrough-replace`;
      const tR = c.W(d.riscaEm), tV = c.W(d.revelaEm);
      return {
        html: `<div id="${c.id}" class="clip" data-start="${c.T(c.t0)}" data-duration="${c.T(c.t1 - c.t0)}" data-track-index="${c.track}" style="${boxStyle(c, `display:flex;align-items:center;justify-content:center;${tokens(c.tpl)}`)}">${snippet}</div>`,
        js: [
          `tl.fromTo("${sel} i", { "--hf-strike-progress": 0 }, { "--hf-strike-progress": 1, duration: 0.28, ease: "power2.out" }, ${c.T(tR)});`,
          `tl.fromTo("${sel} strong", { "--hf-replace-opacity": 0, y: 14 }, { "--hf-replace-opacity": 1, y: 0, duration: 0.3, ease: "power2.out" }, ${c.T(tV)});`,
        ],
        sfx: [[c.SFX.click, tR - 0.02, 0.4, 0.4], [c.SFX.pop, tV, 0.35, 0.5]],
      };
    },
  },

  // contas entrando empilhadas, a mais nova no topo, nos tempos exatos da fala.
  // Código próprio no visual do notification-stack: o componente do registry comprime as entradas
  // num intervalo curto (assume ~4 s) e não acompanha falas longas.
  "pilha-de-contas": {
    origem: null,
    build(it, c) {
      const d = it.dados, n = d.itens.length, SLOT = d.passo ?? 140, CH = d.alturaCartao ?? 124, CWD = d.largura ?? 820;
      const col = c.tpl.cores;
      const top = Math.round((c.box[1] - ((n - 1) * SLOT + CH)) / 2);
      const cards = d.itens.map((x, i) => `<div class="pc pc${i}" style="position:absolute;left:${(c.panelW - CWD) / 2}px;top:${top}px;width:${CWD}px;height:${CH}px;border-radius:26px;background:#fff;box-shadow:0 10px 30px rgba(17,17,17,.10),0 0 0 2px ${col.grade};display:flex;align-items:center;gap:30px;padding:0 40px;opacity:0"><i style="width:26px;height:26px;border-radius:50%;background:${col.vermelho};flex:none"></i><div><div style="font-weight:800;font-size:52px;letter-spacing:-0.03em;color:${col.tinta};line-height:1.05">${x.titulo}</div><div style="font-weight:700;font-size:32px;color:#7a8696;margin-top:4px">${x.corpo || ""}</div></div></div>`).join("");
      const js = [];
      d.itens.forEach((x, i) => {
        const t = c.W(x.em);
        js.push(`tl.set("#${c.id} .pc${i}", { opacity: 0, y: -80 }, 0);`);
        js.push(`tl.fromTo("#${c.id} .pc${i}", { opacity: 0, y: -80 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, ${c.T(t)});`);
        for (let j = 0; j < i; j++) js.push(`tl.to("#${c.id} .pc${j}", { y: ${(i - j) * SLOT}, opacity: ${(1 - 0.17 * (i - j)).toFixed(2)}, duration: 0.45, ease: "power3.out" }, ${c.T(t)});`);
      });
      return { html: `<div id="${c.id}" class="clip" data-start="${c.T(c.t0)}" data-duration="${c.T(c.t1 - c.t0)}" data-track-index="${c.track}" style="${boxStyle(c, tokens(c.tpl) + "font-family:" + c.tpl.fontes[0].familia + ",sans-serif")}">${cards}</div>`, js, sfx: d.itens.map((x) => [c.SFX.tick, c.W(x.em), 0.45, 0.4]) };
    },
  },

  // número que conta até o valor. origem: count-up
  "contador": {
    origem: "count-up",
    build(it, c) {
      const d = it.dados;
      const vars = { start: d.inicio ?? 0, end: d.valor, prefix: d.prefixo ?? "", suffix: d.sufixo ?? "%", accent: "green", glow: false };
      const t = c.W(it.em) - 0.1;
      return { arquivo: { duracao: c.t1 - Math.max(t, c.t0) }, html: host("count-up", { ...c, t0: Math.max(t, c.t0) }, vars, d.escala ?? 1.6, c.t1 - Math.max(t, c.t0)), js: [], sfx: [[c.SFX.tick, t + 0.1, 0.4, 0.4], [c.SFX.chime, t + 1.9, 0.25, 1.0]] };
    },
  },

  // check de conclusão (+ rótulo opcional). origem: success-check
  "check": {
    origem: "success-check",
    build(it, c) {
      const d = it.dados;
      const t = c.W(it.em);
      const sel = `#${c.id} .hf-transition-success-check`;
      const rot = d.rotulo ? `<div style="margin-top:${d.rotuloGap ?? 70}px;font-weight:800;font-size:${d.rotuloTamanho ?? 64}px;letter-spacing:-0.03em;color:${c.tpl.cores.tinta};text-align:center">${d.rotulo}</div>` : "";
      return {
        html: `<div id="${c.id}" class="clip" data-start="${c.T(c.t0)}" data-duration="${c.T(c.t1 - c.t0)}" data-track-index="${c.track}" style="${boxStyle(c, `display:flex;flex-direction:column;align-items:center;justify-content:center;${tokens(c.tpl)}`)}"><div style="transform:scale(${d.escala ?? 2.8})">${vend("success-check")}</div>${rot}</div>`,
        js: [
          `tl.fromTo("${sel} svg", { opacity: 0, "--hf-check-scale": 0.72, "--hf-check-rotate": "-18deg", "--hf-check-blur": "7px" }, { opacity: 1, "--hf-check-scale": 1, "--hf-check-rotate": "0deg", "--hf-check-blur": "0px", duration: 0.34, ease: "back.out(1.8)" }, ${c.T(t)});`,
          `tl.fromTo("${sel} path", { "--hf-check-dash": 36 }, { "--hf-check-dash": 0, duration: 0.42, ease: "power2.out" }, ${c.T(t + 0.12)});`,
          ...(d.rotulo ? [`tl.fromTo("#${c.id} > div:last-child", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, ${c.T(t + 0.25)});`] : []),
        ],
        sfx: [[c.SFX.chime, t + 0.1, 0.4, 1.0]],
      };
    },
  },
  // construtora no centro ligada por fios aos corretores (presença/proximidade). origem: avatar-cloud
  "rede-de-presenca": {
    origem: "avatar-cloud",
    build(it, c) {
      const d = it.dados;
      const vars = { avatarCount: d.quantidade ?? 10, showLinks: "yes", label: d.rotulo };
      const co = c.tpl.cores, tons = co.tons ?? [co.vermelho, co.amarelo, co.branco, co.grade, co.papel], ink = co.tinta;
      const boneco = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="37" r="17" fill="' + ink + '"/><path d="M14 104C14 76 30 63 50 63C70 63 86 76 86 104Z" fill="' + ink + '"/><path d="M14 104C14 76 30 63 50 63C70 63 86 76 86 104Z" fill="#fff" opacity=".14"/></svg>';
      const subst = [["<span class=\"ac-kicker\">Community</span>", `<span class="ac-kicker">${d.legenda ?? ""}</span>`]];
      if (d.logo) { // logo do cliente no lugar do texto do hub (raster pequeno é pré-ampliado com lanczos para não serrilhar)
        mkdirSync(join(c.hf, "assets", "logos"), { recursive: true });
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", c.P(d.logo), "-vf", `scale=iw*${d.logoAmpliar ?? 4}:ih*${d.logoAmpliar ?? 4}:flags=lanczos,format=rgba`, join(c.hf, "assets", "logos", "logo_hub.png")]);
        subst.push(["labelElement.textContent = label;", `labelElement.innerHTML = '<img src="assets/logos/logo_hub.png" alt="logo" style="display:block;height:${d.logoAltura ?? 8}cqh;width:auto;margin:0 auto">';`]);
      }
      if ((d.estilo ?? "bonecos") === "bonecos") {
        subst.push(["avatar.textContent = lettermarks[index];", "avatar.innerHTML = '" + boneco.replace(/'/g, "\\'") + "';"]);
        subst.push(["</style>", `.ac-avatar { overflow: hidden; padding: 0; } .ac-avatar svg { width: 100%; height: 100%; display: block; }\n` + tons.map((t, i) => `.ac-avatar[data-tone="${i}"] { --ac-color: ${t}; }`).join(" ") + "\n</style>"]);
      }
      return { arquivo: { duracao: c.t1 - c.t0, subst }, html: host("avatar-cloud", c, vars, d.escala ?? 1.15), js: [], sfx: [[c.SFX.whoosh, c.t0 - 0.05, 0.2, 0.6], [c.SFX.pop, c.t0 + 0.35, 0.3, 0.5], [c.SFX.chime, c.t0 + 1.3, 0.25, 1.0]] };
    },
  },

  // cartão que cai e recebe um brilho (recompensa/payoff). origem: gloss-sweep
  "cartao-destaque": {
    origem: "gloss-sweep",
    build(it, c) {
      const d = it.dados;
      const t = Math.max(c.W(it.em) - 0.1, c.t0);
      const vars = { text: d.texto, accent: "green", sweep_angle: d.angulo ?? 25 };
      const co = c.tpl.cores;
      const cp = co.cartao ?? { surface: "#B5131D", surfaceBright: co.vermelho, edge: co.tinta, label: "#FFFFFF" };
      const subst = [["#123b2c", cp.surface], ["#1a513c", cp.surfaceBright], ["#39d98a", cp.edge], ["#ecfff5", cp.label],
        ["white-space: nowrap;", "white-space: normal;"], ["text-overflow: ellipsis;", ""], ["max-width: 62cqw;", "max-width: 72cqw;"], ["font-size: clamp(8cqmin, 15cqmin, 18cqmin);", "font-size: 9.5cqmin;"], ["line-height: 1;", "line-height: 1.08;"]];
      return { arquivo: { duracao: c.t1 - t, subst }, html: host("gloss-sweep", { ...c, t0: t }, vars, d.escala ?? 1.6, c.t1 - t), js: [], sfx: [[c.SFX.impacto, t + 0.15, 0.3, 1.0], [c.SFX.chime, t + 0.6, 0.3, 1.0]] };
    },
  },
};
