// Receitas do motor "viral" (estilo do tutorial How to Edit VIRAL Reels with AI, medido quadro a quadro).
// Cada receita: (cena, c) => { html, js? } ; usa c.anim(sel, de, para, t) para registrar animações seek-safe.
//   c = { id, sel (contêiner), box:{w,h}, W(i), WE(i), t0, t1, R (ritmo), cores, tipo, anim, set, sfx(cat,t,db?), rnd }
// Posições em px do contêiner: ui → canvas 1080×1920 · meia → painel 1080×960 · cheia → mundo 1080×1920.
// Dados vêm do projeto.json (plano[].dados); tempos por índice de palavra (em, de, ate).

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

export const CSS = (T) => {
  const C = T.cores, ty = T.tipografia;
  return `
    .abs { position: absolute; }
    .pill { position: absolute; background: ${C.pilula}; border: 2px solid ${C.pilulaBorda}; border-radius: 34px; backdrop-filter: blur(10px); }
    .circ { position: absolute; border-radius: 50%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; font: 600 34px/1 "${ty.sans.familia}", sans-serif; }
    .lbl { position: absolute; left: 0; right: 0; text-align: center; font: ${ty.sans.peso} 32px/1.1 "${ty.sans.familia}", sans-serif; color: ${C.branco}; letter-spacing: -0.2px; }
    .ttl { position: absolute; left: 0; right: 0; text-align: center; font-family: "${ty.serif.familia}", serif; font-style: italic; font-weight: ${ty.serif.peso}; color: ${C.acento}; letter-spacing: -0.5px; text-shadow: ${ty.glow}; }
    .card { position: absolute; background: ${C.cartao}; border-radius: 56px; box-shadow: 0 30px 70px rgba(30,30,40,0.14), 0 4px 14px rgba(30,30,40,0.06); }
    .ico { position: absolute; border-radius: 28%; background: linear-gradient(160deg, #6AA2FF 0%, ${C.acento} 55%, #2A5FD8 100%); box-shadow: 0 22px 44px rgba(59,123,246,0.38), inset 0 3px 10px rgba(255,255,255,0.55); }
    .chip { position: absolute; background: ${C.cartao}; border-radius: 22px; padding: 16px 30px; box-shadow: 0 14px 34px rgba(30,30,40,0.12), 0 2px 6px rgba(30,30,40,0.05); color: ${C.tinta}; white-space: nowrap; }
    .mini { position: absolute; background: ${C.cartao}; border-radius: 30px; box-shadow: 0 20px 44px rgba(30,30,40,0.14), 0 3px 8px rgba(30,30,40,0.06); font: 600 22px/1 "${ty.sans.familia}", sans-serif; color: ${C.cinza}; letter-spacing: 1.5px; }
    .dot { position: absolute; border-radius: 50%; }
  `;
};

// ───────── UI sobre o orador (canvas 1080×1920) ─────────

// hook: círculos numerados (vermelhos) que entram um a um
export const circulos = {
  build(sc, c) {
    const d = sc.dados || {}, n = d.n ?? 3, cap = c.T_.capitulo, cor = c.cores[d.cor === "acento" ? "acento" : "erro"];
    const w = cap.largura, h = cap.altura, x0 = (1080 - w) / 2, y0 = d.y ?? cap.y, D = cap.circulo - 8, gap = (w - 2 * 46 - n * D) / (n - 1);
    let html = `<div id="${c.id}" class="pill" style="left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;opacity:0">`;
    for (let k = 0; k < n; k++) {
      const left = 46 + k * (D + gap);
      if (k) html += `<i id="${c.id}l${k}" class="abs" style="left:${left - gap}px;top:${h / 2 - 1.5}px;width:${gap}px;height:3px;background:${cor};opacity:.8;transform-origin:0 50%"></i>`;
      html += `<b id="${c.id}c${k}" class="circ" style="left:${left}px;top:${(h - D) / 2}px;width:${D}px;height:${D}px;border:3px solid ${cor};color:${cor};box-shadow:0 0 18px ${cor}66, inset 0 0 14px ${cor}33;background:${cor}14">${k + 1}</b>`;
    }
    html += `</div>`;
    c.anim(`#${c.id}`, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: c.R.ui, ease: c.R.easeEntra }, c.t0);
    c.sfx("ui", c.t0);
    for (let k = 0; k < n; k++) {
      const t = d.em?.[k] != null ? c.W(d.em[k]) : c.t0 + 0.2 + k * 0.2;
      c.anim(`#${c.id}c${k}`, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.22, ease: "back.out(1.8)" }, t);
      if (k) c.anim(`#${c.id}l${k}`, { scaleX: 0 }, { scaleX: 1, duration: 0.18, ease: "power2.out" }, t - 0.06);
      c.sfx("ui", t);
    }
    c.anim(`#${c.id}`, { opacity: 1 }, { opacity: 0, duration: c.R.ui, ease: c.R.easeSai }, c.t1 - c.R.ui);
    return { html };
  },
};

// indicador de capítulo 1-2-3 (+ rótulo e título em serif)
export const capitulo = {
  build(sc, c) {
    const d = sc.dados, cap = c.T_.capitulo, n = d.n, total = d.total ?? 3;
    const w = cap.largura, h = cap.altura, D = cap.circulo - 8, gap = (w - 2 * 46 - total * D) / (total - 1), y0 = cap.y;
    let html = `<div id="${c.id}" style="position:absolute;left:0;top:0;width:1080px;height:1920px;opacity:0"><div class="pill" style="left:${(1080 - w) / 2}px;top:${y0}px;width:${w}px;height:${h}px">`;
    for (let k = 0; k < total; k++) {
      const left = 46 + k * (D + gap);
      if (k) html += `<i class="abs" style="left:${left - gap}px;top:${h / 2 - 1.5}px;width:${gap}px;height:3px;background:rgba(255,255,255,${k < n ? 0.85 : 0.22})"></i>`;
      const done = k < n - 1, act = k === n - 1;
      html += `<b id="${c.id}c${k}" class="circ" style="left:${left}px;top:${(h - D) / 2}px;width:${D}px;height:${D}px;border:3px solid rgba(255,255,255,${done || act ? 0.95 : 0.28});background:${done ? "#fff" : "rgba(255,255,255,0.06)"};color:${done ? "#111" : "rgba(255,255,255,0.35)"};font-size:30px">${k + 1}</b>`;
    }
    html += `</div>`;
    if (d.titulo) {
      html += `<div class="lbl" id="${c.id}r" style="top:${y0 + h + 24}px;font-size:34px;opacity:0">${esc(d.rotulo ?? `Number ${n}:`)}</div>`;
      html += `<div class="ttl" id="${c.id}t" style="top:${y0 + h + 66}px;font-size:60px;line-height:1.1;opacity:0"><span id="${c.id}tt" style="display:inline-block">${esc(d.titulo)}</span></div>`;
    }
    html += `</div>`;
    const tEm = d.em != null ? c.W(d.em) : c.t0 + 0.3;
    c.anim(`#${c.id}`, { opacity: 0 }, { opacity: 1, duration: c.R.ui, ease: c.R.easeEntra }, c.t0);
    c.sfx("ui", c.t0);
    // círculo ativo: apaga → anel → preenchido (≈ 0,27 s)
    const a = `#${c.id}c${n - 1}`;
    c.anim(a, { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)", scale: 1 }, { backgroundColor: "#ffffff", color: "#111111", scale: 1.12, duration: 0.27, ease: "back.out(2.5)" }, c.t0 + 0.2);
    c.anim(a, { scale: 1.12 }, { scale: 1, duration: 0.2, ease: "power2.out" }, c.t0 + 0.5);
    c.sfx("click", c.t0 + 0.28);
    if (d.titulo) {
      c.anim(`#${c.id}r`, { opacity: 0, y: 8, filter: "blur(6px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.2, ease: "power2.out" }, c.t0 + 0.32);
      // título: revelação L→R com máscara suave (mesma técnica da legenda)
      c.anim(`#${c.id}t`, { opacity: 0 }, { opacity: 1, duration: 0.01 }, tEm);
      c.keyReveal(`#${c.id}tt`, tEm, Math.max(0.3, d.titulo.length * 0.03));
    }
    c.anim(`#${c.id}`, { opacity: 1 }, { opacity: 0, duration: c.R.ui, ease: c.R.easeSai }, c.t1 - c.R.ui);
    return { html };
  },
};

// slider "A → B": barra preenche acompanhando a fala; cursor arrasta o botão
export const slider = {
  build(sc, c) {
    const d = sc.dados, cap = c.T_.capitulo, w = 640, h = 150, y0 = cap.y - 10, tr = { l: 44, w: w - 88 };
    const html = `<div id="${c.id}" class="pill" style="left:${(1080 - w) / 2}px;top:${y0}px;width:${w}px;height:${h}px;opacity:0;border-radius:30px">
      <span class="abs" style="left:44px;top:34px;font:500 22px 'Inter';color:rgba(255,255,255,.75)">${esc(d.de)}</span>
      <span class="abs" id="${c.id}b" style="right:44px;top:34px;font:500 22px 'Inter';color:rgba(255,255,255,.45)">${esc(d.para)}</span>
      <i class="abs" style="left:${tr.l}px;top:92px;width:${tr.w}px;height:12px;border-radius:6px;background:rgba(255,255,255,.14)"></i>
      <i class="abs" id="${c.id}f" style="left:${tr.l}px;top:92px;width:${tr.w}px;height:12px;border-radius:6px;background:linear-gradient(90deg,#4B7FE0,${c.cores.acento});transform-origin:0 50%"></i>
      <i class="abs" id="${c.id}k" style="left:${tr.l - 16}px;top:82px;width:32px;height:32px;border-radius:50%;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.45)"></i>
      <svg class="abs" id="${c.id}m" style="left:${tr.l + 6}px;top:106px;width:34px;height:34px;opacity:0" viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L9.8 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>
    </div>`;
    const ta = d.deEm != null ? c.W(d.deEm) : c.t0 + 0.3, tb = d.ateEm != null ? c.WE(d.ateEm) : c.t1 - 0.4;
    c.anim(`#${c.id}`, { opacity: 0 }, { opacity: 1, duration: c.R.ui, ease: c.R.easeEntra }, c.t0);
    c.sfx("ui", c.t0);
    c.anim(`#${c.id}m`, { opacity: 0 }, { opacity: 1, duration: 0.15 }, ta - 0.25);
    c.anim(`#${c.id}f`, { scaleX: 0 }, { scaleX: 1, duration: tb - ta, ease: "power1.inOut" }, ta);
    c.anim(`#${c.id}k`, { x: 0 }, { x: tr.w, duration: tb - ta, ease: "power1.inOut" }, ta);
    c.anim(`#${c.id}m`, { x: 0 }, { x: tr.w, duration: tb - ta, ease: "power1.inOut" }, ta);
    c.anim(`#${c.id}b`, { color: "rgba(255,255,255,.45)" }, { color: c.cores.acento2, duration: 0.2 }, tb - 0.2);
    c.sfx("whoosh", ta, -3);
    c.sfx("click", tb - 0.04, 0); c.sfx("ui", tb + 0.05, -2); // chegada do cursor ao destino
    c.anim(`#${c.id}`, { opacity: 1 }, { opacity: 0, duration: c.R.ui, ease: c.R.easeSai }, c.t1 - c.R.ui);
    return { html };
  },
};

// ───────── meia tela (painel 1080×960) ─────────

// ícone grande que "encolhe" (snap) com contorno, selo e partículas
export const iconeSnap = {
  build(sc, c) {
    const d = sc.dados || {}, tS = d.snapEm != null ? c.W(d.snapEm) : c.t0 + 1.0;
    const cx = 540, cy = 470, parts = 30;
    let dots = "";
    for (let k = 0; k < parts; k++) {
      const ang = c.rnd() * Math.PI * 2, dist = 150 + c.rnd() * 380, sz = 5 + c.rnd() * 6, col = c.rnd() > 0.55 ? c.cores.acento : "#222";
      dots += `<i id="${c.id}p${k}" class="dot" style="left:${cx - sz / 2}px;top:${cy - sz / 2}px;width:${sz}px;height:${sz}px;background:${col};opacity:0"></i>`;
      c.anim(`#${c.id}p${k}`, { x: 0, y: 0 }, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, duration: 1.4, ease: "power3.out" }, tS);
      c.anim(`#${c.id}p${k}`, { opacity: 0 }, { opacity: 0.95, duration: 0.05 }, tS);
      c.anim(`#${c.id}p${k}`, { opacity: 0.95 }, { opacity: 0, duration: 1.2, ease: "power1.in" }, tS + 0.2);
    }
    const html = `<div id="${c.id}" style="position:absolute;left:0;top:0;width:1080px;height:960px">
      <div id="${c.id}o" class="abs" style="left:${cx - 330}px;top:${cy - 330}px;width:660px;height:660px;border-radius:150px;border:2px solid ${c.cores.acento}55;opacity:0"></div>
      <div id="${c.id}g" class="abs" style="left:${cx - 330}px;top:${cy - 330}px;width:660px;height:660px">
        <div class="card" style="left:70px;top:70px;width:520px;height:520px;border-radius:120px"></div>
        <div class="ico" style="left:195px;top:150px;width:270px;height:270px"></div>
        <svg class="abs" style="left:195px;top:150px;width:270px;height:270px" viewBox="0 0 100 100"><path d="M40 30 L72 50 L40 70 Z" fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round"/></svg>
        <i class="abs" style="left:170px;top:452px;width:320px;height:20px;border-radius:10px;background:#E9E7E3"></i>
        <i class="abs" style="left:235px;top:494px;width:190px;height:18px;border-radius:9px;background:#EFEDE9"></i>
      </div>
      <div id="${c.id}s" class="abs" style="left:${cx + 150}px;top:${cy - 330}px;padding:10px 20px;border-radius:24px;background:${c.cores.acento};color:#fff;font:600 24px 'Inter';opacity:0">${esc(d.selo ?? "−25%")}</div>
      ${dots}</div>`;
    c.anim(`#${c.id}g`, { scale: 1.45, opacity: 0 }, { scale: 1.45, opacity: 1, duration: c.R.ui, ease: c.R.easeEntra }, c.t0 + c.R.painel * 0.6);
    c.anim(`#${c.id}g`, { scale: 1.45 }, { scale: 1, duration: c.R.snap, ease: "back.out(2.2)" }, tS);
    c.anim(`#${c.id}o`, { opacity: 0, scale: 1.15 }, { opacity: 1, scale: 1, duration: 0.2, ease: "power2.out" }, tS + 0.05);
    c.anim(`#${c.id}s`, { opacity: 0, scale: 0.4, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: 0.26, ease: "back.out(2)" }, tS + 0.12);
    c.sfx("impacto", tS, -2); c.sfx("click", tS + 0.12);
    return { html };
  },
};

// barra de segmentos: entram em sequência; só um acende
export const barraSegmentos = {
  build(sc, c) {
    const d = sc.dados || {}, n = d.n ?? 9, luz = d.luz ?? 5, W0 = 880, seg = (W0 - 36 - (n - 1) * 12) / n;
    let segs = "";
    for (let k = 0; k < n; k++) segs += `<i id="${c.id}s${k}" class="abs" style="left:${18 + k * (seg + 12)}px;top:28px;width:${seg}px;height:70px;border-radius:18px;background:#E3E1DD;transform-origin:50% 50%;opacity:0"></i>`;
    const html = `<div id="${c.id}" style="position:absolute;left:0;top:0;width:1080px;height:960px">
      <div id="${c.id}w" class="card" style="left:100px;top:395px;width:${W0}px;height:126px;border-radius:44px">${segs}</div>
      <span class="abs" style="left:112px;top:330px;font:600 20px 'Inter';letter-spacing:2px;color:${c.cores.cinza}">${esc(d.rotulo ?? "EFFECT USAGE")}</span>
      <span class="abs" id="${c.id}n" style="right:112px;top:330px;font:600 20px 'Inter';letter-spacing:2px;color:#2457C5">1 / ${n}</span></div>`;
    c.anim(`#${c.id}w`, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: c.R.ui, ease: c.R.easeEntra }, c.t0 + c.R.painel * 0.7);
    const t00 = c.t0 + c.R.painel + 0.1;
    for (let k = 0; k < n; k++) {
      const t = t00 + k * 0.16;
      c.anim(`#${c.id}s${k}`, { opacity: 0, scaleX: 0.25 }, { opacity: 1, scaleX: 1, duration: 0.2, ease: "back.out(1.7)" }, t);
      c.sfx("click", t, -2);
    }
    const tl = d.luzEm != null ? c.W(d.luzEm) : t00 + n * 0.16 + 0.2;
    c.anim(`#${c.id}s${luz}`, { backgroundColor: "#E3E1DD", boxShadow: "0 0 0 0 rgba(59,123,246,0)" }, { backgroundColor: c.cores.acento, boxShadow: "0 0 26px 6px rgba(59,123,246,0.45)", duration: 0.25, ease: "power2.out" }, tl);
    c.anim(`#${c.id}s${luz}`, { scaleY: 1 }, { scaleY: 1.22, duration: 0.2, ease: "power2.out", yoyo: true, repeat: 1 }, tl);
    c.sfx("ui", tl, -1);
    return { html };
  },
};

// quadrados de cor com rótulo (um por palavra-chave)
export const quadradosCor = {
  build(sc, c) {
    const d = sc.dados, it = d.itens, S = 190, gap = 56, tot = it.length * S + (it.length - 1) * gap, x0 = (1080 - tot) / 2;
    let html = `<div id="${c.id}" style="position:absolute;left:0;top:0;width:1080px;height:960px">`;
    it.forEach((q, k) => {
      const x = x0 + k * (S + gap);
      html += `<div id="${c.id}q${k}" class="abs" style="left:${x}px;top:${d.y ?? 380}px;width:${S}px;height:${S + 70}px;opacity:0">
        <i class="abs" style="left:0;top:0;width:${S}px;height:${S}px;border-radius:48px;background:${q.cor};box-shadow:0 20px 40px rgba(30,30,40,0.18)${q.cor.toLowerCase() === "#ffffff" ? ", inset 0 0 0 2px #ECEAE6" : ""}"></i>
        <span class="abs" style="left:-20px;right:-20px;top:${S + 20}px;text-align:center;font:600 17px 'Inter';letter-spacing:2px;color:${c.cores.tinta}">${esc(q.rotulo)}</span>
        <span class="abs" style="left:-20px;right:-20px;top:${S + 46}px;text-align:center;font:500 15px 'Inter';letter-spacing:1px;color:${c.cores.cinza}">${esc(q.sub ?? q.cor.toUpperCase())}</span></div>`;
      const t = c.W(q.em);
      c.anim(`#${c.id}q${k}`, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.32, ease: "back.out(2.4)" }, t);
      c.sfx("pop", t);
    });
    return { html: html + `</div>` };
  },
};

// ───────── tela cheia (mundo 1080×1920; a câmera = transform do mundo) ─────────

// cartão com imagem (ou placeholder) + câmera que acompanha o texto
export const cartaoFoto = {
  build(sc, c) {
    const d = sc.dados || {}, p = d.cartao || { x: 540, y: 960, w: 380, h: 700, rot: -2 };
    const img = d.imagem ? `<img src="${esc(d.imagem)}" style="width:100%;height:100%;object-fit:cover;border-radius:22px">` : `<div style="width:100%;height:100%;border-radius:22px;background:linear-gradient(160deg,#C9744A,#7B3F2A)"></div>`;
    const html = `<div id="${c.id}" class="abs" style="left:${p.x - p.w / 2}px;top:${p.y - p.h / 2}px;width:${p.w}px;height:${p.h}px;background:#fff;border-radius:30px;padding:10px;box-shadow:0 34px 70px rgba(30,30,40,.22), 0 4px 12px rgba(30,30,40,.08);opacity:0">${img}</div>`;
    const t = c.t0 + c.R.iris * 0.6;
    c.anim(`#${c.id}`, { opacity: 0, scale: 0.35, rotation: p.rot - 6 }, { opacity: 1, scale: 0.5, rotation: p.rot, duration: 0.45, ease: "power3.out" }, t);
    c.anim(`#${c.id}`, { scale: 0.5 }, { scale: 1, duration: 0.7, ease: "power3.inOut" }, t + 0.45);
    c.sfx("whoosh", t, -1);
    return { html };
  },
};

// objeto central (imagem ou esfera) + 2 cartões de apoio + halo (regra dos 3 objetos)
export const objetoCentral = {
  build(sc, c) {
    const d = sc.dados || {}, cx = 540, cy = d.y ?? 900, D = 560;
    const obj = d.imagem ? `<img src="${esc(d.imagem)}" style="width:100%;height:100%;object-fit:contain">`
      : `<div style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 36% 30%,#fff 0%,#EDEBE7 32%,#B9BCC4 100%);box-shadow:inset -30px -40px 80px rgba(60,70,100,.25)"><div style="position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:radial-gradient(circle at 40% 35%,#7FB0FF,${c.cores.acento} 55%,#1B3F94);box-shadow:0 0 40px rgba(59,123,246,.45)"></div></div>`;
    const miniTL = `<div class="mini" id="${c.id}a" style="left:${cx - 450}px;top:${cy - 300}px;width:310px;height:170px;padding:22px 26px;transform:rotate(-4deg);opacity:0"><span>${esc(d.cartaA ?? "TIMELINE")}</span><i class="abs" style="left:26px;top:70px;width:110px;height:26px;border-radius:8px;background:${c.cores.acento}"></i><i class="abs" style="left:146px;top:70px;width:70px;height:26px;border-radius:8px;background:${c.cores.acento2}"></i><i class="abs" style="left:226px;top:70px;width:58px;height:26px;border-radius:8px;background:${c.cores.acento}"></i><i class="abs" style="left:46px;top:108px;width:170px;height:22px;border-radius:7px;background:#DCDAD6"></i><i class="abs" style="left:228px;top:108px;width:56px;height:22px;border-radius:7px;background:#E6E4E0"></i></div>`;
    const bars = Array.from({ length: 22 }, (_, k) => `<i class="abs" style="left:${28 + k * 11}px;top:${100 - 4 - Math.abs(Math.sin(k * 0.6)) * 44}px;width:6px;height:${8 + Math.abs(Math.sin(k * 0.6)) * 44}px;border-radius:3px;background:${k % 3 ? c.cores.acento : c.cores.acento2}"></i>`).join("");
    const miniWave = `<div class="mini" id="${c.id}b" style="left:${cx + 130}px;top:${cy + 190}px;width:330px;height:150px;padding:20px 26px;transform:rotate(-4deg);opacity:0"><span>${esc(d.cartaB ?? "SOUND FX")}</span><i class="abs" style="right:24px;top:22px;width:20px;height:20px;border-radius:50%;background:${c.cores.acento}"></i><div class="abs" style="left:0;top:0;width:100%;height:100%">${bars}</div></div>`;
    const html = `<div id="${c.id}" style="position:absolute;left:0;top:0;width:1080px;height:1920px">
      <i id="${c.id}h" class="abs" style="left:${cx - 400}px;top:${cy - 400}px;width:800px;height:800px;border-radius:50%;border:2px solid ${c.cores.acento}33;opacity:0"></i>
      <i id="${c.id}e" class="abs" style="left:${cx - 230}px;top:${cy + D / 2 - 10}px;width:460px;height:50px;border-radius:50%;background:radial-gradient(closest-side,rgba(30,30,40,.22),transparent);opacity:0"></i>
      <div id="${c.id}o" class="abs" style="left:${cx - D / 2}px;top:${cy - D / 2}px;width:${D}px;height:${D}px;opacity:0;filter:drop-shadow(0 0 60px rgba(59,123,246,.22))">${obj}</div>
      ${miniTL}${miniWave}</div>`;
    const t = c.t0 + c.R.iris * 0.8;
    c.anim(`#${c.id}o`, { opacity: 0, scale: 0.35, rotation: -40 }, { opacity: 1, scale: 1.05, rotation: 0, duration: c.R.objeto * 0.5, ease: "power3.out" }, t);
    c.anim(`#${c.id}o`, { scale: 1.05 }, { scale: 0.85, duration: c.R.objeto * 0.6, ease: "power2.inOut" }, t + c.R.objeto * 0.5);
    c.anim(`#${c.id}e`, { opacity: 0 }, { opacity: 1, duration: 0.3 }, t + 0.1);
    c.sfx("impacto", t, 0); c.sfx("whoosh", t - 0.05, -1);
    const tA = d.emA != null ? c.W(d.emA) : t + 0.9, tB = d.emB != null ? c.W(d.emB) : tA + 0.35;
    c.anim(`#${c.id}a`, { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.32, ease: "power3.out" }, tA); c.sfx("whoosh", tA, -2);
    c.anim(`#${c.id}b`, { opacity: 0, x: 80, y: 40 }, { opacity: 1, x: 0, y: 0, duration: 0.32, ease: "power3.out" }, tB); c.sfx("whoosh", tB, -2);
    const tH = d.emHalo != null ? c.W(d.emHalo) : c.t1 - 1.0;
    c.anim(`#${c.id}h`, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1.1, duration: 0.5, ease: "power2.out" }, tH);
    c.anim(`#${c.id}h`, { opacity: 1 }, { opacity: 0, duration: 0.5, ease: "power1.in" }, tH + 0.5);
    return { html };
  },
};

// chips flutuantes (marcas/itens) ao redor do texto central
export const chipsFlutuantes = {
  build(sc, c) {
    const it = sc.dados.itens;
    let html = `<div id="${c.id}" style="position:absolute;left:0;top:0;width:1080px;height:1920px">`;
    it.forEach((q, k) => {
      const f = q.estilo === "serif" ? `font:italic 600 ${q.tam ?? 40}px 'Playfair Display'` : `font:700 ${q.tam ?? 26}px 'Inter';letter-spacing:1.5px`;
      const mkS = Math.round((q.tam ?? 26) * 1.15), mkBg = q.marca === "x" ? c.cores.erro : c.cores.acento;
      const mkP = q.marca === "x" ? `<path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>` : `<path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      const mk = q.marca ? `<i style="display:inline-flex;align-items:center;justify-content:center;width:${mkS}px;height:${mkS}px;border-radius:50%;background:${mkBg};margin-right:14px;vertical-align:middle"><svg viewBox="0 0 24 24" width="60%" height="60%">${mkP}</svg></i>` : "";
      html += `<div id="${c.id}c${k}" class="chip" style="left:${q.x}px;top:${q.y}px;${f};color:${q.cor ?? c.cores.tinta};opacity:0">${mk}${esc(q.texto)}</div>`;
      const t = c.W(q.em);
      c.anim(`#${c.id}c${k}`, { opacity: 0, scale: 0.6, y: 24 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.8)" }, t);
      c.sfx(q.marca === "x" ? "erro" : "pop", t, q.marca === "x" ? -3 : -1);
      c.anim(`#${c.id}c${k}`, { y: 0 }, { y: (k % 2 ? 1 : -1) * 14, duration: c.t1 - t, ease: "sine.inOut" }, t + 0.3);
      if (sc.dados.saiEm != null) c.anim(`#${c.id}c${k}`, { opacity: 1 }, { opacity: 0, duration: 0.3, ease: "power1.in" }, c.W(sc.dados.saiEm) + k * 0.02);
    });
    return { html: html + `</div>` };
  },
};

// cena só de texto (legenda em modo claro, posições em plano[].blocos)
export const texto = { build() { return { html: "" }; } };

export const REC = { texto, circulos, capitulo, slider, "icone-snap": iconeSnap, "barra-segmentos": barraSegmentos, "quadrados-cor": quadradosCor, "cartao-foto": cartaoFoto, "objeto-central": objetoCentral, "chips-flutuantes": chipsFlutuantes };
