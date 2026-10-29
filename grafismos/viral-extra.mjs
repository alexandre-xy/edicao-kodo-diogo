// Receitas extras do motor viral (número+lista, cartão de e-mail). Mesma API de viral.mjs.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const CHECK = `<svg viewBox="0 0 24 24" width="62%" height="62%"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// número grande que conta + lista de itens que deslizam (benefícios, preços, resultados) — painel de meia tela
export const numeroLista = {
  build(sc, c) {
    const d = sc.dados, it = d.itens || [], dec = d.decimais ?? 0, pre = d.prefixo ?? "", suf = d.sufixo ?? "";
    const fmt = (x) => pre + x.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    const tN = c.W(d.em), dur = d.duracao ?? 1.0;
    let html = `<div id="${c.id}" style="position:absolute;left:0;top:0;width:1080px;height:960px">
      <span class="abs" id="${c.id}r" style="left:0;right:0;top:150px;text-align:center;font:600 24px 'Inter';letter-spacing:4px;color:${c.cores.cinza};opacity:0">${esc((d.rotulo || "").toUpperCase())}</span>
      <div class="abs" id="${c.id}n" style="left:0;right:0;top:200px;text-align:center;font:700 ${d.tamanho ?? 150}px/1 'Inter';letter-spacing:-4px;color:${c.cores.tinta};opacity:0">${esc(fmt(0))}</div>`;
    it.forEach((x, k) => {
      html += `<div id="${c.id}i${k}" class="abs" style="left:150px;right:150px;top:${(d.yLista ?? 470) + k * 118}px;height:92px;border-radius:46px;background:#fff;box-shadow:0 16px 36px rgba(30,30,40,.12),0 2px 6px rgba(30,30,40,.05);display:flex;align-items:center;padding:0 38px;gap:22px;opacity:0"><i style="width:34px;height:34px;border-radius:50%;background:${c.cores.acento};display:flex;align-items:center;justify-content:center;flex:none">${CHECK}</i><span style="font:600 36px 'Inter';letter-spacing:-0.4px;color:${c.cores.tinta}">${esc(x.texto)}</span></div>`;
      const t = c.W(x.em);
      c.anim(`#${c.id}i${k}`, { opacity: 0, x: -120 }, { opacity: 1, x: 0, duration: 0.38, ease: "power3.out" }, t);
      c.sfx("whoosh", t, -2); c.sfx("ui", t + 0.18, -1);
    });
    html += "</div>";
    c.anim(`#${c.id}r`, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, c.t0 + c.R.painel);
    c.anim(`#${c.id}n`, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.6)" }, tN - 0.05);
    c.raw(tN, `{ const o = { v: 0 }, el = document.getElementById("${c.id}n"); tl.to(o, { v: ${d.valor}, duration: ${dur}, ease: "power2.out", onUpdate() { el.textContent = ${JSON.stringify(pre)} + o.v.toLocaleString("pt-BR", { minimumFractionDigits: ${dec}, maximumFractionDigits: ${dec} }) + ${JSON.stringify(suf)}; } }, ${tN.toFixed(3)}); }`);
    c.sfx("ui", tN, -1);
    return { html };
  },
};

// cartão de e-mail (assunto digitado, anexo, botão enviar) — chamada para ação por e-mail (tela cheia)
export const emailCard = {
  build(sc, c) {
    const d = sc.dados, cx = 540, cy = d.y ?? 820, W0 = 880, H0 = 560;
    const mask = "linear-gradient(90deg,#000 calc(var(--p) * 100% - 22%),transparent calc(var(--p) * 100%))";
    const html = `<div id="${c.id}" class="card" style="left:${cx - W0 / 2}px;top:${cy - H0 / 2}px;width:${W0}px;height:${H0}px;border-radius:44px;opacity:0">
      <div class="abs" style="left:44px;top:34px;display:flex;gap:10px"><i style="width:14px;height:14px;border-radius:50%;background:#ECEAE6"></i><i style="width:14px;height:14px;border-radius:50%;background:#ECEAE6"></i><i style="width:14px;height:14px;border-radius:50%;background:#ECEAE6"></i></div>
      <span class="abs" style="right:44px;top:28px;font:600 22px 'Inter';letter-spacing:3px;color:${c.cores.cinza}">${esc((d.titulo ?? "NOVO E-MAIL").toUpperCase())}</span>
      <i class="abs" style="left:44px;right:44px;top:92px;height:2px;background:#EFEDE9"></i>
      <span class="abs" style="left:44px;top:128px;font:500 32px 'Inter';color:${c.cores.cinza}">${esc(d.rotuloAssunto ?? "Assunto:")}</span>
      <span class="abs" style="left:206px;top:112px;font:600 52px/1.2 'Inter';letter-spacing:-0.8px;color:${c.cores.tinta};white-space:nowrap"><span id="${c.id}s" style="display:inline-block;--p:0;-webkit-mask-image:${mask};mask-image:${mask}">${esc(d.assunto)}</span></span>
      <i class="abs" style="left:44px;right:44px;top:208px;height:2px;background:#EFEDE9"></i>
      <i class="abs" style="left:44px;top:250px;width:560px;height:20px;border-radius:10px;background:#EFEDE9"></i>
      <i class="abs" style="left:44px;top:292px;width:700px;height:20px;border-radius:10px;background:#F3F1EE"></i>
      <i class="abs" style="left:44px;top:334px;width:430px;height:20px;border-radius:10px;background:#F3F1EE"></i>
      <div id="${c.id}a" class="abs" style="left:44px;top:420px;padding:16px 28px;border-radius:24px;background:#F3F1EE;display:flex;align-items:center;gap:14px;font:600 28px 'Inter';color:${c.cores.tinta};opacity:0"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M16.5 6.5l-7.8 7.8a2.2 2.2 0 003.1 3.1l8-8a4.2 4.2 0 00-6-6l-8.1 8.1a6.2 6.2 0 008.8 8.8l6.4-6.4" fill="none" stroke="${c.cores.acento}" stroke-width="2" stroke-linecap="round"/></svg>${esc(d.anexo ?? "Currículo.pdf")}</div>
      <div id="${c.id}b" class="abs" style="right:44px;top:410px;padding:20px 44px;border-radius:30px;background:${c.cores.acento};color:#fff;font:600 30px 'Inter';box-shadow:0 14px 30px rgba(59,123,246,.35)">${esc(d.botao ?? "Enviar")}</div></div>`;
    const t = d.emCard != null ? c.W(d.emCard) : c.t0 + c.R.iris * 0.8;
    c.anim(`#${c.id}`, { opacity: 0, scale: 0.86, y: 50 }, { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(1.5)" }, t);
    c.sfx("whoosh", t - 0.04, -1); c.sfx("impacto", t + 0.1, -3);
    const tA = c.W(d.emAnexo), tS = c.W(d.emAssunto), tE = d.emEnviar != null ? c.W(d.emEnviar) : c.WE(d.emAssunto) + 0.4;
    c.anim(`#${c.id}a`, { opacity: 0, y: 18, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "back.out(1.8)" }, tA); c.sfx("pop", tA);
    c.anim(`#${c.id}s`, { "--p": 0 }, { "--p": 1.3, duration: Math.max(0.5, d.assunto.length * 0.045), ease: "none" }, tS); c.sfx("click", tS);
    c.anim(`#${c.id}b`, { scale: 1 }, { scale: 1.12, duration: 0.14, ease: "power2.out" }, tE);
    c.anim(`#${c.id}b`, { scale: 1.12 }, { scale: 1, duration: 0.2, ease: "power2.inOut" }, tE + 0.14);
    c.sfx("ui", tE); c.sfx("sucesso", tE + 0.2, -2);
    return { html };
  },
};

export const REC_EXTRA = { "numero-lista": numeroLista, "email-card": emailCard };

// ───────── escudo (herói vetorial) + chips ✕ que "batem" nele: conceito de segurança/proteção (tela cheia) ─────────
const SHIELD = (acento) => `<svg viewBox="0 0 200 240" width="100%" height="100%" style="overflow:visible;filter:drop-shadow(0 30px 40px rgba(20,40,110,.30))">
  <defs>
    <linearGradient id="shg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7DB0FF"/><stop offset=".5" stop-color="${acento}"/><stop offset="1" stop-color="#1F4FC8"/></linearGradient>
    <linearGradient id="shh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <path d="M100 10C130 28 160 34 186 36V112C186 172 152 212 100 234 48 212 14 172 14 112V36C40 34 70 28 100 10Z" fill="url(#shg)"/>
  <path d="M100 10C130 28 160 34 186 36V112C186 128 184 142 180 154 140 120 70 112 14 104V36C40 34 70 28 100 10Z" fill="url(#shh)" opacity=".55"/>
  <rect x="66" y="108" width="68" height="56" rx="14" fill="#fff"/>
  <path d="M80 108V92a20 20 0 0140 0v16" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/>
  <circle cx="100" cy="134" r="8" fill="${acento}"/><rect x="97" y="136" width="6" height="16" rx="3" fill="${acento}"/>
</svg>`;

export const escudoChips = {
  build(sc, c) {
    const d = sc.dados, it = d.itens || [], cx = 540, cy = d.y ?? 780, S = d.tamanho ?? 440;
    let html = `<div id="${c.id}" style="position:absolute;left:0;top:0;width:1080px;height:1920px">
      <i id="${c.id}h" class="abs" style="left:${cx - S * 0.9}px;top:${cy - S * 0.9}px;width:${S * 1.8}px;height:${S * 1.8}px;border-radius:50%;border:2px solid ${c.cores.acento}33;opacity:0"></i>
      <i id="${c.id}e" class="abs" style="left:${cx - S * 0.45}px;top:${cy + S * 0.62}px;width:${S * 0.9}px;height:46px;border-radius:50%;background:radial-gradient(closest-side,rgba(30,30,40,.22),transparent);opacity:0"></i>
      <div id="${c.id}s" class="abs" style="left:${cx - S / 2}px;top:${cy - S * 0.6}px;width:${S}px;height:${S * 1.2}px;opacity:0">${SHIELD(c.cores.acento)}</div>`;
    it.forEach((q, k) => {
      const sz = q.tam ?? 38, mk = Math.round(sz * 1.15);
      html += `<div id="${c.id}c${k}" class="chip" style="left:${q.x}px;top:${q.y}px;font:700 ${sz}px 'Inter';letter-spacing:1px;opacity:0"><i style="display:inline-flex;align-items:center;justify-content:center;width:${mk}px;height:${mk}px;border-radius:50%;background:${c.cores.erro};margin-right:14px;vertical-align:middle"><svg viewBox="0 0 24 24" width="60%" height="60%"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg></i>${esc(q.texto)}</div>`;
    });
    html += `</div>`;
    const t = c.t0 + c.R.iris * 0.8;
    c.anim(`#${c.id}s`, { opacity: 0, scale: 0.35, rotation: -14 }, { opacity: 1, scale: 1.08, rotation: 0, duration: c.R.objeto * 0.55, ease: "power3.out" }, t);
    c.anim(`#${c.id}s`, { scale: 1.08 }, { scale: 1, duration: 0.3, ease: "power2.inOut" }, t + c.R.objeto * 0.55);
    c.anim(`#${c.id}e`, { opacity: 0 }, { opacity: 1, duration: 0.3 }, t + 0.1);
    c.sfx("impacto", t, 0); c.sfx("whoosh", t - 0.05, -1);
    it.forEach((q, k) => {
      const tk = c.W(q.em);
      c.anim(`#${c.id}c${k}`, { opacity: 0, scale: 0.5, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.8)" }, tk);
      c.anim(`#${c.id}s`, { x: 0 }, { x: 10, duration: 0.05, ease: "none", yoyo: true, repeat: 3 }, tk + 0.12);
      c.anim(`#${c.id}h`, { opacity: 0, scale: 0.85 }, { opacity: 0.9, scale: 1.02, duration: 0.2, ease: "power2.out" }, tk + 0.1);
      c.anim(`#${c.id}h`, { opacity: 0.9 }, { opacity: 0, duration: 0.5, ease: "power1.in" }, tk + 0.3);
      c.sfx("erro", tk, -3);
    });
    return { html };
  },
};

// logo do cliente em "ícone de app" (quadrado arredondado) que pipoca com brilho — fechamento/CTA (ui ou cheia)
export const logoTile = {
  build(sc, c) {
    const d = sc.dados, S = d.tam ?? 240, y0 = d.y ?? 1180, src = c.asset(d.imagem);
    const html = `<div id="${c.id}" class="abs" style="left:${(1080 - S) / 2}px;top:${y0}px;width:${S}px;height:${S}px;opacity:0">
      <i id="${c.id}g" class="abs" style="left:-30px;top:-30px;width:${S + 60}px;height:${S + 60}px;border-radius:${Math.round(S * 0.3)}px;border:2px solid ${c.cores.acento}55;opacity:0"></i>
      <div class="abs" style="left:0;top:0;width:${S}px;height:${S}px;border-radius:${Math.round(S * 0.23)}px;overflow:hidden;box-shadow:0 26px 54px rgba(10,10,40,.45),0 0 0 2px rgba(255,255,255,.12)"><img src="${src}" style="width:100%;height:100%;object-fit:cover"></div></div>`;
    const t = d.em != null ? c.W(d.em) : c.t0 + 0.2;
    c.anim(`#${c.id}`, { opacity: 0, scale: 0.4, y: 40 }, { opacity: 1, scale: 1.08, y: 0, duration: 0.34, ease: "power3.out" }, t);
    c.anim(`#${c.id}`, { scale: 1.08 }, { scale: 1, duration: 0.25, ease: "power2.inOut" }, t + 0.34);
    c.anim(`#${c.id}g`, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }, t + 0.2);
    c.sfx("impacto", t, -2); c.sfx("sucesso", t + 0.25, -3);
    return { html };
  },
};

REC_EXTRA["escudo-chips"] = escudoChips;
REC_EXTRA["logo"] = logoTile;
