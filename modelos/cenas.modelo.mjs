// Cenas (grafismos específicos deste vídeo) — lidas por scripts/build-comp.mjs.
// Sem grafismos de split? Deixe assim: o motor monta legenda, hook, transições, cartão e áudio normalmente.

export const grupos = []; // ids (ex.: "#gB") dos grupos SVG que começam invisíveis

// SVG do painel do split (largura W x altura H do template). fig(id, x, y, escala) desenha o boneco AIGA.
export function svg({ fig, RED, INK, W, H }) {
  return `<svg id="pict" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"></svg>`;
}

// Coreografia. W(i)/WE(i) = início/fim da palavra i na timeline. Helpers: panelIn/panelOut(t), pop/show/hide(sel, t),
// tick/whoosh(t), addSfx(arquivo, t, vol, dur), js.push(linha GSAP), splits.push([a, b]).
export function timeline(ctx) {}

// marcos extras para a folha de frames: [{ t, title, note }]
export function beats(ctx) { return []; }
